/**
 * 条件達成までの日数（必要な出席日数 − 出席実績）に応じたゲージ・文字色（カウントダウン方式）
 * 0日以下: 青（条件クリア・超過達成）
 * 1〜5日: 黄（あと少し）
 * 6日以上: ピンク（まだ多く出席が必要）
 */

export type RemainingDaysStatus = "cleared" | "soon" | "remaining";

export function getRemainingDaysStatus(remainingDays: number): RemainingDaysStatus {
  if (remainingDays <= 0) return "cleared";
  if (remainingDays <= 5) return "soon";
  return "remaining";
}

export function getRemainingDaysColors(status: RemainingDaysStatus): {
  bar: string;
  text: string;
  bg: string;
} {
  switch (status) {
    case "cleared":
      return {
        bar: "bg-blue-500",
        text: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-50 dark:bg-blue-950/30",
      };
    case "soon":
      return {
        bar: "bg-yellow-500",
        text: "text-yellow-700 dark:text-yellow-300",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
      };
    case "remaining":
      return {
        bar: "bg-pink-500",
        text: "text-pink-700 dark:text-pink-300",
        bg: "bg-pink-50 dark:bg-pink-950/30",
      };
  }
}
