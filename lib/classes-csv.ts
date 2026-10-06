/**
 * 授業一括登録CSVの解析
 *
 * 新形式（期間パターン、同一授業名は最大5行までまとめる）:
 *   A: 授業名, B: 出席実績, C: 開始, D: 終了,
 *   E: 曜日①, F: 時限①, G: 曜日②, H: 時限②, I: 曜日③, J: 時限③, K: 曜日④, L: 時限④
 *   開始・終了は 4月1日 / 4/1 / 2026-04-01 など。空欄は 4/1〜3/31（通年）。
 *
 * 旧形式（通年1パターン、1行=1授業）:
 *   A: 授業名, B: 出席実績, C〜J: 曜日①・時限① … 曜日④・時限④
 *
 * ヘッダーあり/なし両対応。
 */

import Papa from "papaparse";
import {
  MAX_SCHEDULE_PATTERNS,
  SLOTS_PER_PATTERN,
  createDefaultPattern,
  emptySlotArray,
  type SchedulePattern,
} from "@/lib/schedule-patterns";

const WEEKDAY_MAP: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
};

function parseWeekdayCell(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = WEEKDAY_MAP[s];
  if (n !== undefined) return n;
  const num = parseInt(s, 10);
  if (Number.isInteger(num) && num >= 0 && num <= 6) return num;
  return null;
}

function parsePeriodCell(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isInteger(n) || n < 1 || n > 6) return null;
  return n;
}

function parseAttendanceCell(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

export function parseMonthDayCell(value: unknown): { month: number; day: number } | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }

  m = s.match(/\d{4}[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }

  m = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }

  return null;
}

function isHeaderRow(row: string[]): boolean {
  const joined = row.slice(0, 8).map((c) => String(c ?? "").trim().toLowerCase()).join(" ");
  const a = (row[0] ?? "").trim().toLowerCase();
  const b = (row[1] ?? "").trim().toLowerCase();
  return (
    /授業|名前|name|class/.test(a) ||
    /出席|曜日|開始/.test(b) ||
    /開始|終了|start|end/.test(joined) ||
    (row[2] ?? "").trim() === "曜日"
  );
}

function hasDateHeader(row: string[]): boolean {
  const joined = row.map((c) => String(c ?? "")).join(" ");
  return /開始|終了/.test(joined);
}

function parseSlotPair(
  row: string[],
  weekdayCol: number,
  periodCol: number
): { weekday: number | null; period: number | null } {
  return {
    weekday: parseWeekdayCell(row?.[weekdayCol]) ?? null,
    period: parsePeriodCell(row?.[periodCol]) ?? null,
  };
}

function slotsFromColumns(row: string[], weekdayStartCol: number): Pick<SchedulePattern, "weekdays" | "periods"> {
  const weekdays = emptySlotArray();
  const periods = emptySlotArray();
  for (let i = 0; i < SLOTS_PER_PATTERN; i++) {
    const pair = parseSlotPair(row, weekdayStartCol + i * 2, weekdayStartCol + i * 2 + 1);
    weekdays[i] = pair.weekday;
    periods[i] = pair.period;
  }
  return { weekdays, periods };
}

function patternFromDatedRow(row: string[]): SchedulePattern {
  const start = parseMonthDayCell(row?.[2]);
  const end = parseMonthDayCell(row?.[3]);
  const { weekdays, periods } = slotsFromColumns(row, 4);
  return {
    startMonth: start?.month ?? 4,
    startDay: start?.day ?? 1,
    endMonth: end?.month ?? 3,
    endDay: end?.day ?? 31,
    weekdays,
    periods,
  };
}

function patternFromLegacyRow(row: string[]): SchedulePattern {
  const { weekdays, periods } = slotsFromColumns(row, 2);
  return {
    ...createDefaultPattern(),
    weekdays,
    periods,
  };
}

function isDatedRow(row: string[], fileHasDateHeader: boolean): boolean {
  if (fileHasDateHeader) return true;
  return parseMonthDayCell(row?.[2]) != null || parseMonthDayCell(row?.[3]) != null;
}

export interface ParsedClassRow {
  name: string;
  /** 授業出席日数（現在の出席時数の初期値）。未入力・不正は 0 */
  attendanceCount: number;
  patterns: SchedulePattern[];
}

/**
 * 授業登録CSVを解析。期間付きは同一授業名を最大5パターンにまとめる。
 * 旧形式（C列が曜日）は1行=1授業の通年パターンとして扱う。
 */
export function parseClassesCsv(csvText: string): ParsedClassRow[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = (parsed.data ?? []) as string[][];
  const hasHeader = rows.length > 0 && isHeaderRow(rows[0]);
  const fileHasDateHeader = hasHeader && hasDateHeader(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const datedByName = new Map<string, ParsedClassRow>();
  const result: ParsedClassRow[] = [];

  for (const row of dataRows) {
    const name = String(row?.[0] ?? "").trim();
    if (!name) continue;

    const attendanceCount = parseAttendanceCell(row?.[1]);

    if (isDatedRow(row, fileHasDateHeader)) {
      const pattern = patternFromDatedRow(row);
      const existing = datedByName.get(name);
      if (existing) {
        if (existing.patterns.length < MAX_SCHEDULE_PATTERNS) {
          existing.patterns.push(pattern);
        }
        if (existing.attendanceCount === 0 && attendanceCount > 0) {
          existing.attendanceCount = attendanceCount;
        }
      } else {
        const created: ParsedClassRow = { name, attendanceCount, patterns: [pattern] };
        datedByName.set(name, created);
        result.push(created);
      }
    } else {
      result.push({
        name,
        attendanceCount,
        patterns: [patternFromLegacyRow(row)],
      });
    }
  }

  return result;
}

/** Excel向け UTF-8 BOM 付きひな形 */
export function getClassesCsvTemplate(): string {
  return (
    "\uFEFF" +
    [
      "授業名,出席実績,開始,終了,曜日①,時限①,曜日②,時限②,曜日③,時限③,曜日④,時限④",
      "数学I,0,4月1日,9月30日,月,1,木,2,,,,",
      "数学I,,10月1日,3月31日,火,1,金,2,,,,",
      "国語,0,4月1日,10月15日,水,3,,,,,,",
      "国語,,10月16日,12月31日,水,4,,,,,,",
      "国語,,1月1日,3月31日,金,2,,,,,,",
    ].join("\n") +
    "\n"
  );
}
