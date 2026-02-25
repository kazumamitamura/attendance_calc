"use client";

import {
  getBufferStatus,
  getBufferStatusColors,
} from "@/lib/dashboard-status";

interface BufferProgressBarProps {
  /** 条件達成までの日数（必要日数 − 実際の登校）。負なら超過達成 */
  bufferDays: number;
  /** 予定日数（プログレスバーの最大幅用） */
  scheduledDays: number;
  /** 必要日数 */
  requiredDays: number;
}

export function BufferProgressBar({
  bufferDays,
  scheduledDays,
  requiredDays,
}: BufferProgressBarProps) {
  const status = getBufferStatus(bufferDays);
  const colors = getBufferStatusColors(status);
  const actual = requiredDays + bufferDays;
  const displayPercent =
    requiredDays > 0
      ? Math.min(100, Math.max(0, Math.round((100 * actual) / requiredDays)))
      : 0;

  const label =
    bufferDays > 0
      ? `あと ${bufferDays} 日休むとアウト`
      : bufferDays === 0
        ? "ギリギリ達成ライン"
        : `不足 ${-bufferDays} 日`;

  return (
    <div
      className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${colors.text}`}>
          条件達成までの日数
        </span>
        <span className={`text-lg font-bold tabular-nums ${colors.text}`}>
          {label}
        </span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        必要: {requiredDays} 日 / 予定: {scheduledDays} 日
      </p>
    </div>
  );
}
