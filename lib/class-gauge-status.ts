/**
 * 残り日数（余裕日数）に応じたゲージ・文字色
 * 13日以上: 安心 / 12〜10: 要注意(黄) / 9〜1: 警告(ピンク) / 0以下: 不足(赤・グレー)
 */

export type RemainingDaysStatus = "safe" | "caution" | "warning" | "danger";

export function getRemainingDaysStatus(remainingDays: number): RemainingDaysStatus {
  if (remainingDays >= 13) return "safe";
  if (remainingDays >= 10) return "caution";
  if (remainingDays >= 1) return "warning";
  return "danger";
}

export function getRemainingDaysColors(status: RemainingDaysStatus): {
  bar: string;
  text: string;
  bg: string;
} {
  switch (status) {
    case "safe":
      return {
        bar: "bg-sky-400",
        text: "text-sky-700 dark:text-sky-300",
        bg: "bg-sky-50 dark:bg-sky-950/30",
      };
    case "caution":
      return {
        bar: "bg-yellow-500",
        text: "text-yellow-700 dark:text-yellow-300",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
      };
    case "warning":
      return {
        bar: "bg-pink-400",
        text: "text-pink-700 dark:text-pink-300",
        bg: "bg-pink-50 dark:bg-pink-950/30",
      };
    case "danger":
      return {
        bar: "bg-red-500",
        text: "text-red-700 dark:text-red-300",
        bg: "bg-zinc-200 dark:bg-zinc-700",
      };
  }
}
