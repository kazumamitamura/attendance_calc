"use client";

import { useState } from "react";
import { AttendanceDashboardSimple } from "./AttendanceDashboardSimple";
import { ClassHoursFromCsv } from "./ClassHoursFromCsv";

export function MainContentWithDashboard() {
  const [specialConsideration, setSpecialConsideration] = useState(false);

  return (
    <div className="space-y-6">
      {/* 全体統括：特別な配慮（1/2）トグル - 最上部に1つだけ */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/30">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          特別な配慮が必要な生徒（2分の1対応）
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={specialConsideration}
          onClick={() => setSpecialConsideration(!specialConsideration)}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
            specialConsideration
              ? "border-sky-500 bg-sky-500"
              : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              specialConsideration ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {specialConsideration ? "1/2 で計算" : "2/3 で計算"}
        </span>
      </div>

      <AttendanceDashboardSimple
        specialConsideration={specialConsideration}
        onSpecialConsiderationChange={setSpecialConsideration}
      />
      <ClassHoursFromCsv
        specialConsideration={specialConsideration}
        onSpecialConsiderationChange={setSpecialConsideration}
      />
    </div>
  );
}
