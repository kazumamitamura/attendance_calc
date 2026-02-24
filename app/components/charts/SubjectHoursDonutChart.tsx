"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface SubjectHoursItem {
  name: string;
  adjustedHours: number;
}

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#84cc16", "#f97316",
];

interface SubjectHoursDonutChartProps {
  subjects: SubjectHoursItem[];
}

export function SubjectHoursDonutChart({ subjects }: SubjectHoursDonutChartProps) {
  const data = subjects
    .filter((s) => s.name.trim() !== "" || s.adjustedHours > 0)
    .map((s) => ({ name: s.name || "未設定", value: s.adjustedHours }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0 || total <= 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-sm text-zinc-500">科目と時数を入力してください</span>
      </div>
    );
  }

  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden
      >
        <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {Number.isInteger(total) ? total : total.toFixed(1)}
        </span>
        <span className="text-xs text-zinc-500">合計 時数</span>
      </div>
    </div>
  );
}
