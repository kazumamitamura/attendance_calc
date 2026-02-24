"use client";

import { useState } from "react";
import { calcRequiredDays } from "@/lib/required-days";

export function RequiredDaysCalc() {
  const [scheduledDays, setScheduledDays] = useState<string>("");
  const [actualDays, setActualDays] = useState<string>("");
  const [specialConsideration, setSpecialConsideration] = useState(false);

  const scheduled = Number(scheduledDays) || 0;
  const actual = Number(actualDays) || 0;
  const result =
    scheduled > 0
      ? calcRequiredDays(scheduled, actual, specialConsideration)
      : null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        必須日数の自動計算
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        予定日数×2/3（特別配慮時は1/2）で必要登校日数を算出。小数点は切り上げ。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            特別な配慮の生徒
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={specialConsideration}
            onClick={() => setSpecialConsideration((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
              specialConsideration
                ? "border-emerald-500 bg-emerald-500"
                : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                specialConsideration ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-zinc-500">
            {specialConsideration ? "1/2で計算" : "2/3で計算"}
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            予定日数
          </label>
          <input
            type="number"
            min={0}
            value={scheduledDays}
            onChange={(e) => setScheduledDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            実際の登校日数
          </label>
          <input
            type="number"
            min={0}
            value={actualDays}
            onChange={(e) => setActualDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {result && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-800/80">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              必要な登校日数
            </span>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {result.required} 日
            </p>
          </div>
          <div className="rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-800/80">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              不足日数
            </span>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {result.shortfall} 日
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
