/**
 * 授業の期間別時間割（前期・後期、一時的な変更など）
 * 最大5パターン。各パターンは 開始月日〜終了月日 + 曜日・時限（最大4セット）。
 * 日付は学校年度（4月〜翌3月）で解釈する。
 */

import { isSchoolDayOnOrAfterReference, schoolDayYmd, type ClassSlot, type ValidSchoolDay } from "@/lib/csv-calendar";

export const MAX_SCHEDULE_PATTERNS = 5;
export const SLOTS_PER_PATTERN = 4;

export interface SchedulePattern {
  /** 1〜12 */
  startMonth: number;
  startDay: number;
  /** 1〜12 */
  endMonth: number;
  endDay: number;
  /** 曜日①〜④（0-6 または null） */
  weekdays: (number | null)[];
  /** 時限①〜④（1-6 または null） */
  periods: (number | null)[];
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: "日",
  1: "月",
  2: "火",
  3: "水",
  4: "木",
  5: "金",
  6: "土",
};

export function emptySlotArray(): (number | null)[] {
  return [null, null, null, null];
}

export function createDefaultPattern(): SchedulePattern {
  return {
    startMonth: 4,
    startDay: 1,
    endMonth: 3,
    endDay: 31,
    weekdays: emptySlotArray(),
    periods: emptySlotArray(),
  };
}

export function isSamePeriod(a: SchedulePattern, b: SchedulePattern): boolean {
  return (
    a.startMonth === b.startMonth &&
    a.startDay === b.startDay &&
    a.endMonth === b.endMonth &&
    a.endDay === b.endDay
  );
}

export function applyPeriodToPattern(pattern: SchedulePattern, period: SchedulePattern): SchedulePattern {
  return {
    ...pattern,
    startMonth: period.startMonth,
    startDay: period.startDay,
    endMonth: period.endMonth,
    endDay: period.endDay,
  };
}

/** 同じ期間なら上書き、違う期間なら追加（最大5） */
export function upsertPatterns(existing: SchedulePattern[], incoming: SchedulePattern[]): SchedulePattern[] {
  const next = existing.map((p) => ({
    ...p,
    weekdays: [...(p.weekdays ?? emptySlotArray())],
    periods: [...(p.periods ?? emptySlotArray())],
  }));
  for (const p of incoming) {
    const incomingPattern = {
      ...p,
      weekdays: [...(p.weekdays ?? emptySlotArray())],
      periods: [...(p.periods ?? emptySlotArray())],
    };
    const idx = next.findIndex((e) => isSamePeriod(e, incomingPattern));
    if (idx >= 0) {
      next[idx] = incomingPattern;
    } else if (next.length < MAX_SCHEDULE_PATTERNS) {
      next.push(incomingPattern);
    }
  }
  return next;
}

export function consolidateClassesByName<T extends { id: string; name: string; patterns: SchedulePattern[] }>(
  list: T[]
): T[] {
  const order: string[] = [];
  const map = new Map<string, T>();
  for (const item of list) {
    const existing = map.get(item.name);
    if (!existing) {
      map.set(item.name, { ...item, patterns: [...(item.patterns ?? [])] });
      order.push(item.name);
    } else {
      existing.patterns = upsertPatterns(existing.patterns ?? [], item.patterns ?? []);
    }
  }
  return order.map((name) => map.get(name)!);
}

/** 学校年度の月日を Date にする。4〜12月＝対象年度、1〜3月＝対象年度+1 */
export function academicDateFromMonthDay(
  month: number,
  day: number,
  academicYear: number
): Date {
  const m = Math.min(12, Math.max(1, month || 1));
  const year = m >= 4 ? academicYear : academicYear + 1;
  const lastDay = new Date(year, m, 0).getDate();
  const d = Math.min(lastDay, Math.max(1, day || 1));
  return new Date(year, m - 1, d);
}

function startOfDayTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isDateInPattern(
  date: Date,
  pattern: SchedulePattern,
  academicYear: number
): boolean {
  const start = academicDateFromMonthDay(pattern.startMonth, pattern.startDay, academicYear);
  const end = academicDateFromMonthDay(pattern.endMonth, pattern.endDay, academicYear);
  const t = startOfDayTime(date);
  const a = start.getTime();
  const b = end.getTime();
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

function ymdLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isYmdInPattern(ymd: string, pattern: SchedulePattern, academicYear: number): boolean {
  const start = ymdLocal(academicDateFromMonthDay(pattern.startMonth, pattern.startDay, academicYear));
  const end = ymdLocal(academicDateFromMonthDay(pattern.endMonth, pattern.endDay, academicYear));
  if (start <= end) return ymd >= start && ymd <= end;
  return ymd >= start || ymd <= end;
}

/** 期間が重なる場合は配列の先頭パターンを優先 */
export function findPatternForDate(
  date: Date,
  patterns: SchedulePattern[],
  academicYear: number
): SchedulePattern | null {
  for (const p of patterns) {
    if (isDateInPattern(date, p, academicYear)) return p;
  }
  return null;
}

export function findPatternForSchoolDay(
  day: ValidSchoolDay,
  patterns: SchedulePattern[],
  academicYear: number
): SchedulePattern | null {
  const ymd = schoolDayYmd(day, academicYear);
  for (const p of patterns) {
    if (isYmdInPattern(ymd, p, academicYear)) return p;
  }
  return null;
}

export function toSlots(
  weekdays: (number | null)[] | undefined,
  periods: (number | null)[] | undefined
): ClassSlot[] {
  const w = weekdays ?? [];
  const p = periods ?? [];
  const slots: ClassSlot[] = [];
  const len = Math.min(w.length, p.length, SLOTS_PER_PATTERN);
  for (let i = 0; i < len; i++) {
    const weekday = w[i];
    const period = p[i];
    if (weekday != null && weekday >= 0 && weekday <= 6 && period != null && period >= 1 && period <= 6) {
      slots.push({ weekday, period });
    }
  }
  return slots;
}

export function hasAnySlot(pattern: SchedulePattern): boolean {
  return toSlots(pattern.weekdays, pattern.periods).length > 0;
}

function countSlotsOnDay(day: ValidSchoolDay, slots: ClassSlot[]): number {
  let n = 0;
  for (const slot of slots) {
    if (day.dayOfWeek === slot.weekday && day.activePeriods.includes(slot.period)) n += 1;
  }
  return n;
}

export function countClassSlotsForPatterns(
  validDays: ValidSchoolDay[],
  patterns: SchedulePattern[],
  academicYear: number
): number {
  let total = 0;
  for (const day of validDays) {
    const pattern = findPatternForSchoolDay(day, patterns, academicYear);
    if (!pattern) continue;
    total += countSlotsOnDay(day, toSlots(pattern.weekdays, pattern.periods));
  }
  return total;
}

export function countFutureClassSlotsForPatterns(
  validDays: ValidSchoolDay[],
  patterns: SchedulePattern[],
  academicYear: number,
  referenceDateStr?: string
): number {
  return countClassSlotsForPatterns(
    validDays.filter((d) => isSchoolDayOnOrAfterReference(d, referenceDateStr, academicYear)),
    patterns,
    academicYear
  );
}

export function formatSlots(
  weekdays: (number | null)[] | undefined,
  periods: (number | null)[] | undefined
): string {
  const parts: string[] = [];
  const w = weekdays ?? [];
  const p = periods ?? [];
  for (let i = 0; i < SLOTS_PER_PATTERN; i++) {
    const weekday = w[i];
    const period = p[i];
    if (weekday != null && period != null && period >= 1 && period <= 6) {
      parts.push(`${WEEKDAY_LABELS[weekday]}・${period}限`);
    }
  }
  return parts.length > 0 ? parts.join("、") : "—";
}

export function formatPatternRange(pattern: SchedulePattern): string {
  return `${pattern.startMonth}/${pattern.startDay}〜${pattern.endMonth}/${pattern.endDay}`;
}

export function formatPatternsDisplay(patterns: SchedulePattern[] | undefined): string {
  if (!patterns || patterns.length === 0) return "—";
  return patterns
    .map((p) => `${formatPatternRange(p)}：${formatSlots(p.weekdays, p.periods)}`)
    .join("\n");
}
