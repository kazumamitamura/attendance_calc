/**
 * 国民の祝日（日本）
 * 祝日法に基づく日付。振替休日・休日でない祝日は含めず、祝日のみ。
 * 必要に応じて祝日APIに差し替え可能。
 */

/** YYYY-MM-DD 形式の祝日日付リスト（重複・振替は1日1エントリ） */
const HOLIDAYS_BY_YEAR: Record<number, string[]> = {
  2024: [
    "2024-01-01", "2024-01-08", "2024-02-11", "2024-02-12", "2024-02-23",
    "2024-03-20", "2024-04-29", "2024-05-03", "2024-05-04", "2024-05-05", "2024-05-06",
    "2024-07-15", "2024-08-11", "2024-09-16", "2024-09-22", "2024-09-23",
    "2024-10-14", "2024-11-03", "2024-11-04", "2024-11-23",
  ],
  2025: [
    "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24",
    "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05", "2025-05-06",
    "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23", "2025-09-24",
    "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
  ],
  2026: [
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23",
    "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
    "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
    "2026-10-12", "2026-11-03", "2026-11-23",
  ],
};

/** 日付文字列 YYYY-MM-DD を Date の 0:00 UTC として解釈し、ローカル日で YYYY-MM-DD を返す */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 指定年の祝日一覧を返す（YYYY-MM-DD のセット）。
 * 未定義の年は空セット。
 */
export function getHolidaysForYear(year: number): Set<string> {
  const list = HOLIDAYS_BY_YEAR[year];
  return new Set(list ?? []);
}

/**
 * 指定期間の祝日一覧を返す（YYYY-MM-DD の配列）。
 */
export function getHolidaysInRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const set = getHolidaysForYear(y);
    for (const d of set) {
      const date = new Date(d + "T00:00:00");
      if (date >= start && date <= end) result.push(d);
    }
  }
  return result;
}

/**
 * 日付が祝日かどうか
 */
export function isHoliday(date: Date): boolean {
  const key = toLocalDateString(date);
  const year = date.getFullYear();
  return getHolidaysForYear(year).has(key);
}
