/**
 * ダッシュボードの残り余裕表示用カラー（安心感のあるソフトカラー）
 * 青・緑・ピンクのパステル調
 */

export type BufferStatus = "safe" | "warning" | "danger";

/** 余裕日数がこの値以下で「注意」、0以下で「不足」 */
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
        bg: "bg-sky-50 dark:bg-sky-950/30",
        text: "text-sky-800 dark:text-sky-200",
        bar: "bg-sky-400",
        border: "border-sky-200 dark:border-sky-800",
      };
    case "warning":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-800 dark:text-emerald-200",
        bar: "bg-emerald-400",
        border: "border-emerald-200 dark:border-emerald-800",
      };
    case "danger":
      return {
        bg: "bg-pink-50 dark:bg-pink-950/30",
        text: "text-pink-800 dark:text-pink-200",
        bar: "bg-pink-400",
        border: "border-pink-200 dark:border-pink-800",
      };
  }
}
