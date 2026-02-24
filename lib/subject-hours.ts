/**
 * 授業の変更・休講・交換授業の調整
 * 予定時数から休講分を引き、交換授業の増減を足し引きして「修正された授業時数」を出力する。
 */

export interface SubjectHoursInput {
  /** 予定時数 */
  planned_hours: number;
  /** 実施しない日（休講）で減らす時数 */
  minus_hours: number;
  /** 交換授業などで増減する時数（正で追加、負で削減） */
  exchange_hours?: number;
}

/**
 * 修正された授業時数 = 予定時数 - 休講分 + 交換増減（0 未満にはしない）
 */
export function calcAdjustedHours(input: SubjectHoursInput): number {
  const exchange = input.exchange_hours ?? 0;
  return Math.max(0, input.planned_hours - input.minus_hours + exchange);
}
