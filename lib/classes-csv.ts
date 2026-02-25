/**
 * 授業一括登録CSVの解析
 * A列: 授業名, B列: 授業出席日数,
 * C列: 曜日①, D列: 時限①, E列: 曜日②, F列: 時限②, G列: 曜日③, H列: 時限③, I列: 曜日④, J列: 時限④
 * ヘッダーあり/なし両対応。
 */

import Papa from "papaparse";

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

/** 時限セルを 1〜6 に。空欄・不正は null */
function parsePeriodCell(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isInteger(n) || n < 1 || n > 6) return null;
  return n;
}

/** B列を数値に。空欄・数値以外は 0 */
function parseAttendanceCell(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

function isHeaderRow(row: string[]): boolean {
  const a = (row[0] ?? "").trim().toLowerCase();
  const b = (row[1] ?? "").trim().toLowerCase();
  return (
    /授業|名前|name|class/.test(a) ||
    /出席|曜日/.test(b) ||
    (row[2] ?? "").trim() === "曜日"
  );
}

export interface ParsedClassRow {
  name: string;
  /** 授業出席日数（現在の出席時数の初期値）。未入力・不正は 0 */
  attendanceCount: number;
  /** 曜日①〜④（0-6 または null） */
  weekdays: (number | null)[];
  /** 時限①〜④（1-6 または null）。同じインデックスが1スロット */
  periods: (number | null)[];
}

/**
 * 授業登録CSVを解析。A=授業名, B=授業出席日数, C,D=曜日①・時限①, E,F=曜日②・時限②, G,H=曜日③・時限③, I,J=曜日④・時限④
 */
export function parseClassesCsv(csvText: string): ParsedClassRow[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = (parsed.data ?? []) as string[][];
  const dataRows = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  const result: ParsedClassRow[] = [];

  for (const row of dataRows) {
    const name = String(row?.[0] ?? "").trim();
    if (!name) continue;

    const attendanceCount = parseAttendanceCell(row?.[1]);
    const weekdays: (number | null)[] = [];
    const periods: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const colW = 2 + i * 2; // C, E, G, I
      const colP = 3 + i * 2; // D, F, H, J
      weekdays.push(parseWeekdayCell(row?.[colW]) ?? null);
      periods.push(parsePeriodCell(row?.[colP]) ?? null);
    }
    result.push({ name, attendanceCount, weekdays, periods });
  }

  return result;
}
