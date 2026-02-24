/**
 * 進級・単位認定に必要な日数／時数の自動計算
 * 通常: 2/3 / 特別配慮: 1/2。小数点は切り上げで「必要日数」を算出し、不足日数を算出する。
 */

export type RatioKind = "normal" | "special";

/** 通常は 2/3、特別配慮は 1/2 */
const RATIO: Record<RatioKind, number> = {
  normal: 2 / 3,
  special: 1 / 2,
};

export interface RequiredResult {
  /** 必要な登校日数（または必要時数）。切り上げ整数 */
  required: number;
  /** 不足日数（または不足時数）。actual が required 未満の場合のみ > 0 */
  shortfall: number;
  /** 使用した比率 (2/3 or 1/2) */
  ratio: number;
}

/**
 * 予定日数から「必要な登校日数」を算出（小数点切り上げ）。
 * 不足日数 = max(0, required - actual)。
 */
export function calcRequiredDays(
  scheduledDays: number,
  actualDays: number,
  specialConsideration: boolean
): RequiredResult {
  const kind: RatioKind = specialConsideration ? "special" : "normal";
  const ratio = RATIO[kind];
  const required = Math.ceil(scheduledDays * ratio);
  const shortfall = Math.max(0, required - actualDays);
  return { required, shortfall, ratio };
}

/**
 * 予定時数から「必要な授業時数」を算出（小数点切り上げ）。
 * 不足時数 = max(0, required - actual)。
 */
export function calcRequiredHours(
  scheduledHours: number,
  actualHours: number,
  specialConsideration: boolean
): RequiredResult {
  const kind: RatioKind = specialConsideration ? "special" : "normal";
  const ratio = RATIO[kind];
  const required = Math.ceil(scheduledHours * ratio);
  const shortfall = Math.max(0, required - actualHours);
  return { required, shortfall, ratio };
}
