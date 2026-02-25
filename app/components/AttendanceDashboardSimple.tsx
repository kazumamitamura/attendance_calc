"use client";

import { useState } from "react";
import { calcRequiredDays } from "@/lib/required-days";
import { AttendanceDonutChart } from "./charts/AttendanceDonutChart";
import { BufferProgressBar } from "./charts/BufferProgressBar";

interface AttendanceDashboardSimpleProps {
  specialConsideration: boolean;
  onSpecialConsiderationChange: (value: boolean) => void;
}

export function AttendanceDashboardSimple({
  specialConsideration,
  onSpecialConsiderationChange,
}: AttendanceDashboardSimpleProps) {
  const [scheduledDays, setScheduledDays] = useState<string>("");
  const [actualDays, setActualDays] = useState<string>("");

  const scheduled = Number(scheduledDays) || 0;
  const actual = Number(actualDays) || 0;
  const result =
    scheduled > 0
      ? calcRequiredDays(scheduled, actual, specialConsideration)
      : null;
  const bufferDays = result ? actual - result.required : 0;
  const requiredDays = result?.required ?? 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        全体の登校日数を管理
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        予定日数・現在の登校日数と達成率、残り余裕を確認します。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            予定日数
          </label>
          <input
            type="number"
            min={0}
            value={scheduledDays}
            onChange={(e) => setScheduledDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            現在の登校日数
          </label>
          <input
            type="number"
            min={0}
            value={actualDays}
            onChange={(e) => setActualDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            達成率
          </h3>
          <AttendanceDonutChart
            actual={actual}
            required={requiredDays}
            scheduled={scheduled}
            bufferDays={bufferDays}
          />
        </div>
        <div className="flex flex-col justify-center gap-4">
          {result && (
            <BufferProgressBar
              bufferDays={bufferDays}
              scheduledDays={scheduled}
              requiredDays={requiredDays}
            />
          )}
        </div>
      </div>
    </section>
  );
}
