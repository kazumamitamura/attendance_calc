/**
 * 印刷用Excel出力（exceljs）
 * 対象年度・基準日・クラス・氏名・各授業の進捗・補修・対面記録を1シートにまとめ、A4横向き1ページで印刷可能にする。
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface PrintExportRow {
  name: string;
  requiredAttendance: number;
  currentAttendance: number;
  remainingClassDays: number;
  supplementaryNeeded: number;
  supplementaryRecords: { date: string; content: string }[];
  faceToFaceRecords: { date: string; content: string }[];
}

export interface PrintExportPayload {
  academicYear: number;
  referenceDate: string;
  className: string;
  studentName: string;
  specialConsideration: boolean;
  rows: PrintExportRow[];
}

function sanitizeFileName(s: string): string {
  return String(s ?? "")
    .replace(/[/\\:*?"<>|]/g, "")
    .trim() || "未入力";
}

/** ファイル名: [年度]_[クラス名]_[生徒氏名]_出席状況.xlsx */
export function getPrintExportFileName(payload: PrintExportPayload): string {
  const y = payload.academicYear;
  const cls = sanitizeFileName(payload.className);
  const name = sanitizeFileName(payload.studentName);
  const parts = [String(y), cls, name].filter(Boolean);
  return `${parts.join("_")}_出席状況.xlsx`;
}

/** 日付＋内容を1行の文字列に。例: 2025/10/12(プリント課題) */
function formatRecord(record: { date: string; content: string }): string {
  if (!record.date && !record.content) return "";
  const d = record.date ? record.date.replace(/-/g, "/") : "—";
  const c = (record.content || "").trim() || "—";
  return `${d}(${c})`;
}

/** 複数件を改行またはカンマで結合（空白はスキップ） */
function joinRecords(records: { date: string; content: string }[]): string {
  const parts = records
    .map(formatRecord)
    .filter((s) => s && s !== "—(—)");
  return parts.join("\n") || "";
}

const thinBorder = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

export async function downloadPrintExcel(payload: PrintExportPayload): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("出席状況");
  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
  };

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  const headerFont = { bold: true };

  // 基本情報（1〜4行目）
  ws.getCell(1, 1).value = "対象年度";
  ws.getCell(1, 2).value = payload.academicYear;
  ws.getCell(2, 1).value = "基準日";
  ws.getCell(2, 2).value = payload.referenceDate || "—";
  ws.getCell(3, 1).value = "クラス";
  ws.getCell(3, 2).value = payload.className || "—";
  ws.getCell(4, 1).value = "生徒氏名";
  ws.getCell(4, 2).value = payload.studentName || "—";
  ws.getCell(5, 1).value = "特別な配慮（1/2）";
  ws.getCell(5, 2).value = payload.specialConsideration ? "ON" : "OFF";

  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 2; c++) {
      const cell = ws.getCell(r, c);
      cell.border = thinBorder;
      if (c === 1) {
        cell.fill = headerFill;
        cell.font = headerFont;
      }
    }
  }

  // 明細テーブル（7行目〜）
  const dataStartRow = 7;
  const headers = [
    "授業名",
    "必要な出席日数",
    "現在の出席実績",
    "残り授業日数",
    "補修が必要な日数",
    "補修実施記録",
    "対面授業記録",
  ];

  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getCell(dataStartRow, c);
    cell.value = headers[c - 1];
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  }

  payload.rows.forEach((row, i) => {
    const r = dataStartRow + 1 + i;
    ws.getCell(r, 1).value = row.name ?? "—";
    ws.getCell(r, 2).value = row.requiredAttendance ?? 0;
    ws.getCell(r, 3).value = row.currentAttendance ?? 0;
    ws.getCell(r, 4).value = row.remainingClassDays ?? 0;
    ws.getCell(r, 5).value = row.supplementaryNeeded ?? 0;
    ws.getCell(r, 6).value = joinRecords(row.supplementaryRecords ?? []);
    ws.getCell(r, 7).value = joinRecords(row.faceToFaceRecords ?? []);

    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c);
      cell.border = thinBorder;
      cell.alignment = { wrapText: true, vertical: "middle" };
    }
  });

  ws.columns = [
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 36 },
    { width: 36 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, getPrintExportFileName(payload));
}
