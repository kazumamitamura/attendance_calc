/**
 * 年間行事予定CSVの読み込みと解析
 * A列: 日付, B列: 内容, C〜H列: 1限〜6限。
 * 各時限列に「授業」（trim 完全一致）が入力されている場合、その日のその時限を稼働として記録する。
 */

import Papa from "papaparse";

export interface ValidSchoolDay {
  /** 表示用（A列のトリム済み値） */
  dateStr: string;
  /** 0=日, 1=月, ..., 6=土。A列の (月)〜(日) から直接抽出 */
  dayOfWeek: number;
  date: Date;
  /** その日に稼働している時限の配列（1〜6）。C列=1限〜H列=6限で「授業」の列 */
  activePeriods: number[];
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
 * 「MM月 DD日」形式から Date を生成（ソート・比較用）。
 * academicYear 指定時: 4〜12月＝対象年度、1〜3月＝対象年度+1（学校年度）。
 * 未指定時: いずれも現在の西暦年（後方互換）。
 */
function parseMonthDayWithAcademicYear(str: string, academicYear?: number): Date | null {
  const match = String(str).trim().match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return null;
  const month1Based = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year =
    academicYear != null
      ? month1Based >= 4
        ? academicYear
        : academicYear + 1
      : new Date().getFullYear();
  const date = new Date(year, month1Based - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** セルが「授業」かどうか（trim 完全一致）。未定義・null・空は false */
function isPeriodClass(value: unknown): boolean {
  return String(value ?? "").trim() === "授業";
}

/**
 * 行がヘッダー行かどうか（1行目で「日付」「内容」などのキーワードを含むが曜日括弧を含まない）
 */
function isHeaderRow(row: unknown): boolean {
  const first = Array.isArray(row) ? (row as string[])[0] : undefined;
  const a = String(first ?? "").trim();
  return /日付|内容|date|content/i.test(a) && !/\([月火水木金土日]\)/.test(a);
}

/**
 * CSVテキストを解析し、各日ごとに「稼働している時限」を保持するリストを返す
 * - academicYear を渡すと、A列の月に応じて西暦を付与（4〜12月＝対象年度、1〜3月＝対象年度+1）
 */
export function parseScheduleCsv(csvText: string, academicYear?: number): ValidSchoolDay[] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const rows: string[][] = Array.isArray(parsed.data) ? (parsed.data as string[][]) : [];
  const dataRows =
    rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;

  const result: ValidSchoolDay[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || !Array.isArray(row)) continue;

    const dateRaw = String(row[0] ?? "").trim();
    if (!dateRaw) continue;

    const dayOfWeek = parseWeekdayFromString(dateRaw);
    if (dayOfWeek === null) continue;

    const activePeriods: number[] = [];
    for (let p = 1; p <= 6; p++) {
      const colIndex = p + 1;
      const cell = row[colIndex];
      if (isPeriodClass(cell)) activePeriods.push(p);
    }
    if (activePeriods.length === 0) continue;

    const dateForSort = parseMonthDayWithAcademicYear(dateRaw, academicYear) ?? new Date(0);
    result.push({
      dateStr: dateRaw,
      dayOfWeek,
      date: dateForSort,
      activePeriods,
    });
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

/** 現在の学校年度（4月〜翌3月）。例: 2026年2月 → 2025 */
export function getCurrentAcademicYear(): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? y : y - 1;
}

/** 授業の1スロット = 曜日 + 時限のペア */
export interface ClassSlot {
  weekday: number;
  period: number;
}

/**
 * 曜日・時限のペアごとに、マスター上で「その曜日かつその時限が稼働」の日数を合算する（二次元マッチング）
 * 例: スロットが [木1限, 木2限] → 木曜のうち1限=授業の日数 + 木曜のうち2限=授業の日数
 */
export function countClassSlotsWithDuplicates(
  validDays: ValidSchoolDay[],
  slots: ClassSlot[]
): number {
  let total = 0;
  for (const slot of slots) {
    const { weekday, period } = slot;
    if (period < 1 || period > 6) continue;
    for (const d of validDays) {
      if (d.dayOfWeek === weekday && d.activePeriods.includes(period)) {
        total += 1;
      }
    }
  }
  return total;
}

/** 基準日文字列 YYYY-MM-DD をその日の0時0分（ローカル）の Date に。無効・未指定時は今日の0時 */
function getReferenceDateStart(refDateStr: string | undefined): Date {
  if (refDateStr && /^\d{4}-\d{2}-\d{2}$/.test(refDateStr.trim())) {
    const [y, m, d] = refDateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 「基準日」以降の授業日数のみを、曜日・時限スロットに基づいてカウント（残り授業日数）
 * referenceDateStr: YYYY-MM-DD。未指定・無効時は今日を使用
 */
export function countFutureClassSlots(
  validDays: ValidSchoolDay[],
  slots: ClassSlot[],
  referenceDateStr?: string
): number {
  const refStart = getReferenceDateStart(referenceDateStr);
  const futureDays = validDays.filter((d) => d.date >= refStart);
  let total = 0;
  for (const slot of slots) {
    const { weekday, period } = slot;
    if (period < 1 || period > 6) continue;
    for (const d of futureDays) {
      if (d.dayOfWeek === weekday && d.activePeriods.includes(period)) {
        total += 1;
      }
    }
  }
  return total;
}

/**
 * 授業実施日のリストから、指定曜日（0-6）の「日数」（その日に1限以上稼働がある日を1日としてカウント）
 */
export function countClassDays(
  validDays: ValidSchoolDay[],
  weekdays: number[]
): number {
  const set = new Set(weekdays.filter((w) => w >= 0 && w <= 6));
  return validDays.filter((d) => set.has(d.dayOfWeek)).length;
}
