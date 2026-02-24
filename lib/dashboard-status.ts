/**
 * ダッシュボードの警告レベルと色
 * 残り余裕日数: 緑(安全) → 黄(注意) → 赤(アウト)
 */

export type BufferStatus = "safe" | "warning" | "danger";

/** 余裕日数がこの値以下で「注意」、0以下で「アウト」 */
const WARNING_THRESHOLD = 3;

export function getBufferStatus(bufferDays: number): BufferStatus {
  if (bufferDays <= 0) return "danger";
  if (bufferDays <= WARNING_THRESHOLD) return "warning";
  return "safe";
}

export function getBufferStatusColors(status: BufferStatus): {
  bg: string;
  text: string;
  bar: string;
  border: string;
} {
  switch (status) {
    case "safe":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-800 dark:text-emerald-200",
        bar: "bg-emerald-500",
        border: "border-emerald-200 dark:border-emerald-800",
      };
    case "warning":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-800 dark:text-amber-200",
        bar: "bg-amber-500",
        border: "border-amber-200 dark:border-amber-800",
      };
    case "danger":
      return {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-800 dark:text-red-200",
        bar: "bg-red-500",
        border: "border-red-200 dark:border-red-800",
      };
  }
}
