/**
 * 授業曜日ベースのカレンダー算出
 * 指定期間内の「特定曜日」の日数をカウントし、祝日を除外する。
 */

import { getHolidaysForYear } from "./japanese-holidays";

/** 曜日 0=日, 1=月, ..., 6=土 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** YYYY-MM-DD に変換（ローカル日） */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 期間内で指定曜日の日数をカウントする（祝日除外オプション付き）。
 * @param start 開始日（含む）
 * @param end 終了日（含む）
 * @param dayOfWeek 曜日 (1=月 ... 5=金 を想定。0,6 も可)
 * @param excludeHolidays 祝日を除外するか
 */
export function countWeekdaysInRange(
  start: Date,
  end: Date,
  dayOfWeek: Weekday,
  excludeHolidays: boolean = true
): number {
  if (start > end) return 0;
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(0, 0, 0, 0);
  let count = 0;
  const cursor = new Date(startTime);
  const holidaysByYear: Record<number, Set<string>> = {};
  const getHolidays = (year: number) => {
    if (!holidaysByYear[year]) holidaysByYear[year] = getHolidaysForYear(year);
    return holidaysByYear[year];
  };
  while (cursor.getTime() <= endTime) {
    if (cursor.getDay() === dayOfWeek) {
      if (excludeHolidays) {
        const key = toDateString(cursor);
        if (!getHolidays(cursor.getFullYear()).has(key)) count++;
      } else {
        count++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * 年間の指定曜日日数（祝日除外）
 */
export function countWeekdaysInYear(year: number, dayOfWeek: Weekday, excludeHolidays: boolean = true): number {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return countWeekdaysInRange(start, end, dayOfWeek, excludeHolidays);
}

/**
 * 学期期間を「開始日・終了日」で指定して曜日カウント
 */
export function countWeekdaysInTerm(
  termStart: Date,
  termEnd: Date,
  dayOfWeek: Weekday,
  excludeHolidays: boolean = true
): number {
  return countWeekdaysInRange(termStart, termEnd, dayOfWeek, excludeHolidays);
}
