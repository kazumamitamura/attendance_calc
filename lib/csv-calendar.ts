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
 * 「MM月 DD日」形式から Date を生成（ソート・今日比較用。年は現在年で補完）
 * 残り授業日数はこの Date と「今日の0時」を比較して今日以降をカウントする
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
 * - A列で日付・曜日を取得。C列(1限)〜H列(6限)を独立にチェックし、「授業」の列を activePeriods に格納
 * - いずれかの時限が「授業」である行のみ結果に含める
 */
export function parseScheduleCsv(csvText: string): ValidSchoolDay[] {
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
      const colIndex = p + 1; // C=2(1限), D=3(2限), ..., H=7(6限)
      const cell = row[colIndex];
      if (isPeriodClass(cell)) activePeriods.push(p);
    }
    if (activePeriods.length === 0) continue;

    const dateForSort = parseMonthDayForSort(dateRaw) ?? new Date(0);
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

/** 今日の0時0分（ローカル）。残り授業日数は「この日以降」の日程をカウントする */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 「今日（new Date()）以降」の授業日数のみを、曜日・時限スロットに基づいてカウント（残り授業日数）
 * マスターCSVのA列は現在年で補完した Date と startOfToday で比較し、d.date >= startOfToday のものをカウント
 */
export function countFutureClassSlots(
  validDays: ValidSchoolDay[],
  slots: ClassSlot[]
): number {
  const startOfToday = getStartOfToday();
  const futureDays = validDays.filter((d) => d.date >= startOfToday);
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
