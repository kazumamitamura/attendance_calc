/**
 * 出席状況をExcel（.xlsx）で出力
 * ヘッダーにクラス・氏名を挿入し、ファイル名を動的生成する。
 */

import * as XLSX from "xlsx";
import { calcRequiredHours } from "./required-days";
import { calcAdjustedHours } from "./subject-hours";

export interface ExportSubjectRow {
  name: string;
  plannedHours: number;
  minusHours: number;
  exchangeHours: number;
}

export interface ExportPayload {
  className: string;
  lastName: string;
  firstName: string;
  scheduledDays: number;
  actualDays: number;
  specialConsideration: boolean;
  requiredDays: number;
  shortfallDays: number;
  bufferDays: number;
  subjects: ExportSubjectRow[];
}

/** ファイル名に使えない文字を除去 */
function sanitizeFileName(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, "").trim() || "未入力";
}

/**
 * ファイル名を生成: 出席状況_クラス_姓名的.xlsx
 */
export function getExportFileName(payload: ExportPayload): string {
  const cls = sanitizeFileName(payload.className);
  const name = [payload.lastName, payload.firstName].map(sanitizeFileName).join("");
  const suffix = name ? `_${name}` : "";
  return `出席状況_${cls}${suffix}.xlsx`;
}

/**
 * ワークブックを組み立ててダウンロード
 */
export function downloadAttendanceExcel(payload: ExportPayload): void {
  const { specialConsideration, requiredDays, scheduledDays, actualDays, bufferDays, shortfallDays, subjects } = payload;

  const ratio = specialConsideration ? "1/2" : "2/3";
  const rows: (string | number)[][] = [
    ["クラス", payload.className],
    ["氏名", `${payload.lastName} ${payload.firstName}`.trim() || "—"],
    [],
    ["【登校状況】"],
    ["予定日数", scheduledDays],
    ["現在の登校日数", actualDays],
    ["必要日数", requiredDays],
    ["不足日数", shortfallDays],
    ["残り余裕（日）", bufferDays],
    ["特別な配慮", specialConsideration ? "あり" : "なし"],
    ["算出基準", ratio],
    [],
    ["【授業時数】"],
    ["科目", "予定時数", "休講", "交換", "修正時数", "必要時数", "過不足"],
  ];

  for (const s of subjects) {
    const adjusted = calcAdjustedHours({
      planned_hours: s.plannedHours,
      minus_hours: s.minusHours,
      exchange_hours: s.exchangeHours,
    });
    const { required } = calcRequiredHours(
      adjusted,
      adjusted,
      specialConsideration
    );
    const overShort = adjusted - required;
    const overShortLabel =
      overShort > 0 ? `+${overShort}` : overShort < 0 ? String(overShort) : "0";
    rows.push([
      s.name || "—",
      s.plannedHours,
      s.minusHours,
      s.exchangeHours,
      adjusted,
      required,
      overShortLabel,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "出席状況");

  const fileName = getExportFileName(payload);
  XLSX.writeFile(wb, fileName);
}
