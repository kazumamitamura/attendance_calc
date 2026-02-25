/**
 * 年間行事予定CSVの読み込みと解析
 * A列: 日付 (YYYY-MM-DD / YYYY/MM/DD), B列: 内容。B列が空白の日のみ「授業実施日」とする。
 */

import Papa from "papaparse";

export interface ValidSchoolDay {
  /** YYYY-MM-DD */
  dateStr: string;
  /** 0=日, 1=月, ..., 6=土 */
  dayOfWeek: number;
  date: Date;
}

/**
 * 日付文字列をパース（YYYY-MM-DD / YYYY/MM/DD）
 */
function parseDateStr(str: string): Date | null {
  const normalized = String(str).trim().replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * B列（内容）が空白かどうか
 */
function isContentEmpty(value: unknown): boolean {
  const s = typeof value === "string" ? value : String(value ?? "");
  return s.trim() === "";
}

/**
 * CSVテキストを解析し、授業実施日（B列が空白の日）のみ抽出する
 */
export function parseScheduleCsv(csvText: string): ValidSchoolDay[] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const result: ValidSchoolDay[] = [];
  const rows = parsed.data ?? [];

  for (const row of rows) {
    const dateRaw = row[0];
    const content = row[1];
    if (dateRaw == null || dateRaw === "") continue;
    if (!isContentEmpty(content)) continue;

    const date = parseDateStr(dateRaw);
    if (!date) continue;

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const dayOfWeek = date.getDay();

    result.push({ dateStr, dayOfWeek, date });
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

/**
 * 授業実施日のリストから、指定曜日（0-6）の日数をカウント
 * weekdays: 例 [1, 3] = 月・水 → 月曜と水曜の合計
 */
export function countClassDays(
  validDays: ValidSchoolDay[],
  weekdays: number[]
): number {
  const set = new Set(weekdays.filter((w) => w >= 0 && w <= 6));
  return validDays.filter((d) => set.has(d.dayOfWeek)).length;
}
