"use client";

import { useState } from "react";
import {
  countWeekdaysInYear,
  countWeekdaysInTerm,
  type Weekday,
} from "@/lib/calendar";

const WEEKDAY_LABELS: { value: Weekday; label: string }[] = [
  { value: 0, label: "日" },
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
];

function parseDateInput(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function CalendarWeekdayCount() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(String(currentYear));
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>(1);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [useTerm, setUseTerm] = useState(false);
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");

  const y = Number(year) || currentYear;
  const start = useTerm ? parseDateInput(termStart) : null;
  const end = useTerm ? parseDateInput(termEnd) : null;
  const useTermRange = useTerm && start && end && start <= end;

  const count = useTermRange
    ? countWeekdaysInTerm(start!, end!, dayOfWeek, excludeHolidays)
    : countWeekdaysInYear(y, dayOfWeek, excludeHolidays);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        授業曜日のカレンダー算出
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        曜日を選ぶと、年間のその曜日の日数をカウント。祝日は除外できます。
      </p>

      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={useTerm}
          onChange={(e) => setUseTerm(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          学期期間で指定
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        {!useTerm && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              年
            </label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}
        {useTerm && (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                開始日
              </label>
              <input
                type="date"
                value={termStart}
                onChange={(e) => setTermStart(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                終了日
              </label>
              <input
                type="date"
                value={termEnd}
                onChange={(e) => setTermEnd(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            曜日
          </label>
          <div className="mt-1 flex gap-1">
            {WEEKDAY_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDayOfWeek(value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  dayOfWeek === value
                    ? "border-zinc-500 bg-zinc-200 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-600 dark:text-zinc-100"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={excludeHolidays}
            onChange={(e) => setExcludeHolidays(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            祝日を除外
          </span>
        </label>
      </div>

      <div className="mt-6 rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-800/80">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {useTermRange
            ? `${termStart} ～ ${termEnd} の「${WEEKDAY_LABELS.find((w) => w.value === dayOfWeek)?.label}」曜日の日数`
            : `${y}年の「${WEEKDAY_LABELS.find((w) => w.value === dayOfWeek)?.label}」曜日の日数`}
          {excludeHolidays ? "（祝日除く）" : ""}
        </span>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {count} 日
        </p>
      </div>
    </section>
  );
}
