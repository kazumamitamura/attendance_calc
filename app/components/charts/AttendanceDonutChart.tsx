"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { getBufferStatus } from "@/lib/dashboard-status";

interface AttendanceDonutChartProps {
  actual: number;
  required: number;
  scheduled: number;
  /** 残り余裕日数（actual - required）。未指定なら色分けなし */
  bufferDays?: number;
}

const COLORS = { achieved: "#38bdf8", shortfall: "#e2e8f0", surplus: "#a5f3fc" };
const SHORTFALL_COLORS = { safe: "#e2e8f0", warning: "#6ee7b7", danger: "#f9a8d4" };

export function AttendanceDonutChart({
  actual,
  required,
  scheduled,
  bufferDays = 0,
}: AttendanceDonutChartProps) {
  const achieved = Math.min(actual, required);
  const shortfall = Math.max(0, required - actual);
  const surplus = Math.max(0, actual - required);
  const status = shortfall > 0 ? getBufferStatus(bufferDays) : "safe";
  const shortfallFill =
    shortfall > 0 ? SHORTFALL_COLORS[status] : COLORS.shortfall;
  const data = [
    { name: "達成", value: achieved, fill: COLORS.achieved },
    { name: "不足", value: shortfall, fill: shortfallFill },
    { name: "余裕", value: surplus, fill: COLORS.surplus },
  ].filter((d) => d.value > 0);

  if (required <= 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-sm text-zinc-500">数値を入力してください</span>
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
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden
      >
        <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {actual} <span className="text-zinc-400">/</span> {required}
        </span>
        <span className="text-xs text-zinc-500">登校日 / 必要日数</span>
      </div>
    </div>
  );
}
