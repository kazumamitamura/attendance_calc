/**
 * 年間行事予定CSVの読み込みと解析
 * A列: 日付（例: 04月 01日(火) または YYYY-MM-DD）, B列: 内容。B列が空白の日のみ「授業実施日」とする。
 */

import Papa from "papaparse";

export interface ValidSchoolDay {
  /** 表示用（A列のトリム済み値または YYYY-MM-DD） */
  dateStr: string;
  /** 0=日, 1=月, ..., 6=土。A列の (月)〜(日) から直接抽出 */
  dayOfWeek: number;
  date: Date;
}

/** (日)(月)(火)(水)(木)(金)(土) を検索して曜日コード 0〜6 を返す。見つからなければ null */
function parseWeekdayFromString(str: string): number | null {
  const s = String(str).trim();
  const match = s.match(/\((日|月|火|水|木|金|土)\)/);
  if (!match) return null;
  const map: Record<string, number> = {
    日: 0,
    月: 1,
    火: 2,
    水: 3,
    木: 4,
    金: 5,
    土: 6,
  };
  return map[match[1]] ?? null;
}

/**
 * 「MM月 DD日」形式から Date を生成（ソート用。年は現在年を使用）
 */
function parseMonthDayForSort(str: string): Date | null {
  const match = String(str).trim().match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return null;
  const month = parseInt(match[1], 10) - 1;
  const day = parseInt(match[2], 10);
  const year = new Date().getFullYear();
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * B列（内容）が空白かどうか
 * 半角・全角スペースのみのセルも空白とみなす
 */
function isContentEmpty(value: unknown): boolean {
  const s = String(value ?? "").trim();
  const normalized = s.replace(/\s/g, "").replace(/\u3000/g, "");
  return normalized === "";
}

/**
 * 行がヘッダー行かどうか（1行目で「日付」「内容」などのキーワードを含むが曜日括弧を含まない）
 */
function isHeaderRow(row: unknown[]): boolean {
  const a = String((row as string[])[0] ?? "").trim();
  return /日付|内容|date|content/i.test(a) && !/\([月火水木金土日]\)/.test(a);
}

/**
 * CSVテキストを解析し、授業実施日（B列が空白の日）のみ抽出する
 * - 曜日は A列の (月)〜(日) を直接抽出（Date は使わない）
 * - B列は trim のうえ半角・全角スペースのみも空白とみなす
 * - 1行目がヘッダーの場合はスキップ（インデックスで安全に取得）
 */
export function parseScheduleCsv(csvText: string): ValidSchoolDay[] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const rows = (parsed.data ?? []) as string[][];
  const dataRows = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;

  const result: ValidSchoolDay[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const dateRaw = String(row?.[0] ?? "").trim();
    const content = String(row?.[1] ?? "").trim();

    if (!dateRaw) continue;
    if (!isContentEmpty(content)) continue;

    const dayOfWeek = parseWeekdayFromString(dateRaw);
    if (dayOfWeek === null) continue;

    const dateForSort = parseMonthDayForSort(dateRaw) ?? new Date(0);
    const dateStr = dateRaw;

    result.push({
      dateStr,
      dayOfWeek,
      date: dateForSort,
    });
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

/**
 * 授業実施日のリストから、選択された曜日配列（重複あり）に従い総授業時数をカウント
 * 同じ曜日を複数回選んだ場合、その曜日の出現回数 × 選択回数で加算する
 * 例: 木・木 で CSV の木曜が 18 日 → 18 + 18 = 36
 */
export function countClassDaysWithDuplicates(
  validDays: ValidSchoolDay[],
  weekdays: (number | null)[]
): number {
  const byDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of validDays) {
    byDay[d.dayOfWeek] = (byDay[d.dayOfWeek] ?? 0) + 1;
  }
  let total = 0;
  for (const w of weekdays) {
    if (w !== null && w >= 0 && w <= 6) total += byDay[w] ?? 0;
  }
  return total;
}

/**
 * 授業実施日のリストから、指定曜日（0-6）の日数をカウント（重複は1回として扱う）
 * weekdays: 例 [1, 3] = 月・水 → 月曜と水曜の合計
 */
export function countClassDays(
  validDays: ValidSchoolDay[],
  weekdays: number[]
): number {
  const set = new Set(weekdays.filter((w) => w >= 0 && w <= 6));
  return validDays.filter((d) => set.has(d.dayOfWeek)).length;
}
