"use client";

import { useState } from "react";
import { calcAdjustedHours } from "@/lib/subject-hours";

export function SubjectAdjustmentForm() {
  const [subjectName, setSubjectName] = useState("");
  const [plannedHours, setPlannedHours] = useState<string>("");
  const [minusHours, setMinusHours] = useState<string>("");
  const [exchangeHours, setExchangeHours] = useState<string>("");

  const planned = Number(plannedHours) || 0;
  const minus = Number(minusHours) || 0;
  const exchange = Number(exchangeHours) || 0;
  const adjusted = calcAdjustedHours({
    planned_hours: planned,
    minus_hours: minus,
    exchange_hours: exchange,
  });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        授業の変更・休講の調整
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        予定時数から休講分を引き、交換授業の増減を足し引きして修正時数を出します。
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            科目名（任意）
          </label>
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="例: 数学I"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              予定時数
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={plannedHours}
              onChange={(e) => setPlannedHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              休講で減らす時数
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={minusHours}
              onChange={(e) => setMinusHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              交換授業の増減
            </label>
            <input
              type="number"
              step={0.5}
              value={exchangeHours}
              onChange={(e) => setExchangeHours(e.target.value)}
              placeholder="正で追加・負で削減"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          修正された授業時数
        </span>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
          {adjusted} 時数
        </p>
      </div>
    </section>
  );
}
