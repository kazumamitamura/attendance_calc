"use client";

import { useState } from "react";
import { calcRequiredDays } from "@/lib/required-days";
import { calcAdjustedHours } from "@/lib/subject-hours";
import { AttendanceDonutChart } from "./charts/AttendanceDonutChart";
import {
  SubjectHoursDonutChart,
  type SubjectHoursItem,
} from "./charts/SubjectHoursDonutChart";
import { BufferProgressBar } from "./charts/BufferProgressBar";

export interface SubjectRow {
  name: string;
  plannedHours: number;
  minusHours: number;
  exchangeHours: number;
}

function toSubjectHoursItem(row: SubjectRow): SubjectHoursItem {
  return {
    name: row.name || "未設定",
    adjustedHours: calcAdjustedHours({
      planned_hours: row.plannedHours,
      minus_hours: row.minusHours,
      exchange_hours: row.exchangeHours,
    }),
  };
}

export function AttendanceVisualDashboard() {
  const [scheduledDays, setScheduledDays] = useState<string>("");
  const [actualDays, setActualDays] = useState<string>("");
  const [specialConsideration, setSpecialConsideration] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { name: "", plannedHours: 0, minusHours: 0, exchangeHours: 0 },
  ]);

  const scheduled = Number(scheduledDays) || 0;
  const actual = Number(actualDays) || 0;
  const result =
    scheduled > 0
      ? calcRequiredDays(scheduled, actual, specialConsideration)
      : null;
  const bufferDays = result ? actual - result.required : 0;
  const requiredDays = result?.required ?? 0;

  const updateSubject = (
    index: number,
    field: keyof SubjectRow,
    value: string | number
  ) => {
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addSubject = () => {
    setSubjects((prev) => [
      ...prev,
      { name: "", plannedHours: 0, minusHours: 0, exchangeHours: 0 },
    ]);
  };

  const removeSubject = (index: number) => {
    if (subjects.length <= 1) return;
    setSubjects((prev) => prev.filter((_, i) => i !== index));
  };

  const subjectChartItems = subjects.map(toSubjectHoursItem);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        ビジュアルダッシュボード
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        登校日数・授業時数の達成状況を一目で確認。余裕日数で色が変わります。
      </p>

      {/* 入力: 登校日数 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            現在の登校日数
          </label>
          <input
            type="number"
            min={0}
            value={actualDays}
            onChange={(e) => setActualDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              特別な配慮
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={specialConsideration}
              onClick={() => setSpecialConsideration((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                specialConsideration
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  specialConsideration ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* グラフ行: ドーナツ + 余裕プログレス */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            全体の登校日数 達成率
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

      {/* 授業時数: 入力 + ドーナツ */}
      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          各授業の時数（修正後）
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          科目ごとに予定・休講・交換を入力すると合計と内訳を表示します。
        </p>
        <div className="mt-3 space-y-2">
          {subjects.map((s, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50"
            >
              <input
                type="text"
                placeholder="科目名"
                value={s.name}
                onChange={(e) => updateSubject(i, "name", e.target.value)}
                className="w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="予定"
                value={s.plannedHours || ""}
                onChange={(e) =>
                  updateSubject(i, "plannedHours", Number(e.target.value) || 0)
                }
                className="w-16 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-zinc-400">−</span>
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="休講"
                value={s.minusHours || ""}
                onChange={(e) =>
                  updateSubject(i, "minusHours", Number(e.target.value) || 0)
                }
                className="w-16 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-zinc-400">+</span>
              <input
                type="number"
                step={0.5}
                placeholder="交換"
                value={s.exchangeHours || ""}
                onChange={(e) =>
                  updateSubject(
                    i,
                    "exchangeHours",
                    Number(e.target.value) || 0
                  )
                }
                className="w-16 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                ={" "}
                {calcAdjustedHours({
                  planned_hours: s.plannedHours,
                  minus_hours: s.minusHours,
                  exchange_hours: s.exchangeHours,
                })}{" "}
                時数
              </span>
              <button
                type="button"
                onClick={() => removeSubject(i)}
                disabled={subjects.length <= 1}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 disabled:opacity-40 dark:hover:bg-zinc-700"
                aria-label="削除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSubject}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            + 科目を追加
          </button>
        </div>
        <div className="mt-4">
          <SubjectHoursDonutChart subjects={subjectChartItems} />
        </div>
      </div>
    </section>
  );
}
