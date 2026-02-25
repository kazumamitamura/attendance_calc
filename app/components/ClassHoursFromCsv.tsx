"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { parseScheduleCsv, countClassSlotsWithDuplicates, countFutureClassSlots, getCurrentAcademicYear, type ValidSchoolDay, type ClassSlot } from "@/lib/csv-calendar";
import { parseClassesCsv } from "@/lib/classes-csv";
import { getRemainingDaysStatus, getRemainingDaysColors } from "@/lib/class-gauge-status";
import { downloadPrintExcel } from "@/lib/excel-export-print";
import { ClassHoursAdjustModal } from "./ClassHoursAdjustModal";

/** 曜日 0=日..6=土、null=なし */
const WEEKDAY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "なし" },
  { value: 0, label: "日" },
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
];

/** 時限 1〜6、null=なし */
const PERIOD_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "なし" },
  { value: 1, label: "1限" },
  { value: 2, label: "2限" },
  { value: 3, label: "3限" },
  { value: 4, label: "4限" },
  { value: 5, label: "5限" },
  { value: 6, label: "6限" },
];

const WEEKDAY_LABELS: Record<number, string> = {
  0: "日",
  1: "月",
  2: "火",
  3: "水",
  4: "木",
  5: "金",
  6: "土",
};

export interface RegisteredClass {
  id: string;
  name: string;
  /** 曜日①〜④（0-6 または null） */
  weekdays: (number | null)[];
  /** 時限①〜④（1-6 または null）。同じインデックスで曜日・時限の1セット */
  periods: (number | null)[];
}

interface ClassWithResult extends RegisteredClass {
  totalHours: number;
  requiredAttendance: number;
  /** この授業で特別な配慮(1/2)がONか */
  isSpecialCare: boolean;
  /** 対面授業として必要な日数（1/2 ON時のみ > 0） */
  faceToFaceDays: number;
}

/** 今日の日付を YYYY-MM-DD で返す */
function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function slotsDisplay(weekdays: (number | null)[], periods: (number | null)[]): string {
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const w = weekdays[i];
    const p = periods[i];
    if (w != null && p != null && p >= 1 && p <= 6) {
      parts.push(`${WEEKDAY_LABELS[w]}・${p}限`);
    }
  }
  return parts.length > 0 ? parts.join("、") : "—";
}

/** 有効なスロットのみ ClassSlot[] に変換（曜日・時限の両方があるもの） */
function toSlots(weekdays: (number | null)[], periods: (number | null)[]): ClassSlot[] {
  const slots: ClassSlot[] = [];
  for (let i = 0; i < 4; i++) {
    const w = weekdays[i];
    const p = periods[i];
    if (w != null && w >= 0 && w <= 6 && p != null && p >= 1 && p <= 6) {
      slots.push({ weekday: w, period: p });
    }
  }
  return slots;
}

export function ClassHoursFromCsv({
  specialConsideration: propSpecialConsideration,
  onSpecialConsiderationChange,
}: {
  specialConsideration?: boolean;
  onSpecialConsiderationChange?: (value: boolean) => void;
} = {}) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [validDays, setValidDays] = useState<ValidSchoolDay[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  /** 対象年度（学校年度）。4月〜翌3月。例: 2026年2月 → 2025 */
  const [academicYear, setAcademicYear] = useState<number>(() => getCurrentAcademicYear());
  /** 基準日（残り授業日数の「この日以降」に使う）。YYYY-MM-DD。未入力時は今日で計算 */
  const [referenceDate, setReferenceDate] = useState<string>(() => formatToday());
  const [classNameExport, setClassNameExport] = useState<string>("");
  const [studentNameExport, setStudentNameExport] = useState<string>("");
  const lastCsvTextRef = useRef<string | null>(null);

  const [className, setClassName] = useState("");
  const [initialAttendance, setInitialAttendance] = useState<number>(0);
  const [classWeekdays, setClassWeekdays] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [classPeriods, setClassPeriods] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [classes, setClasses] = useState<RegisteredClass[]>([]);
  const [results, setResults] = useState<ClassWithResult[]>([]);
  const [internalSpecial, setInternalSpecial] = useState(false);
  const specialConsideration = onSpecialConsiderationChange != null ? (propSpecialConsideration ?? false) : internalSpecial;
  const setSpecialConsideration = onSpecialConsiderationChange ?? setInternalSpecial;
  const showToggleBlock = onSpecialConsiderationChange == null;
  const [adjustments, setAdjustments] = useState<Record<string, { add: number; subtract: number }>>({});
  const [currentAttendances, setCurrentAttendances] = useState<Record<string, number>>({});
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  /** 補修実施（classId -> { date, content }[]） */
  const [supplementaryByClass, setSupplementaryByClass] = useState<Record<string, { date: string; content: string }[]>>({});
  /** 対面授業の実施記録（1/2配慮時、classId -> { date, content }[]） */
  const [faceToFaceRecordsByClass, setFaceToFaceRecordsByClass] = useState<Record<string, { date: string; content: string }[]>>({});

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setParseError(null);
      setValidDays([]);
      setCsvFile(file ?? null);
      lastCsvTextRef.current = null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        try {
          lastCsvTextRef.current = text;
          const days = parseScheduleCsv(text, academicYear);
          setValidDays(days);
          if (days.length === 0) setParseError("授業実施日（C〜H列のいずれかに「授業」が入力された行）がありませんでした。");
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "CSVの解析に失敗しました。");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [academicYear]
  );

  const setWeekdayAt = (index: number, value: number | null) => {
    setClassWeekdays((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const setPeriodAt = (index: number, value: number | null) => {
    setClassPeriods((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddClass = () => {
    const name = className.trim();
    if (!name) return;
    const id = generateId();
    const attendance = initialAttendance ?? 0;
    setClasses((prev) => [
      ...prev,
      { id, name, weekdays: [...classWeekdays], periods: [...classPeriods] },
    ]);
    setCurrentAttendances((prev) => ({ ...prev, [id]: attendance }));
    setClassName("");
    setInitialAttendance(0);
    setClassWeekdays([null, null, null, null]);
    setClassPeriods([null, null, null, null]);
  };

  const handleRemoveClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setResults((prev) => prev.filter((r) => r.id !== id));
    setAdjustments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCurrentAttendances((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedRowId((prev) => (prev === id ? null : prev));
    setSupplementaryByClass((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFaceToFaceRecordsByClass((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingClassId === id) setEditingClassId(null);
  };

  const handleSaveAdjustment = (id: string, add: number, subtract: number, currentAttendance: number) => {
    setAdjustments((prev) => ({ ...prev, [id]: { add, subtract } }));
    setCurrentAttendances((prev) => ({ ...prev, [id]: currentAttendance }));
    setEditingClassId(null);
  };

  const handleBulkClassesCsv = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        try {
          const rows = parseClassesCsv(text);
          const newClasses: RegisteredClass[] = rows.map((r) => ({
            id: generateId(),
            name: r.name,
            weekdays: r.weekdays,
            periods: r.periods ?? [null, null, null, null],
          }));
          setParseError(null);
          setClasses((prev) => [...prev, ...newClasses]);
          setCurrentAttendances((prev) => {
            const next = { ...prev };
            newClasses.forEach((c, i) => {
              next[c.id] = rows[i]?.attendanceCount ?? 0;
            });
            return next;
          });
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "授業CSVの解析に失敗しました。");
        }
      };
      reader.readAsText(file, "UTF-8");
      e.target.value = "";
    },
    []
  );

  const runCount = useCallback(() => {
    if (validDays.length === 0 || classes.length === 0) return;
    const isSpecialCare = specialConsideration;
    const ratio = isSpecialCare ? 1 / 2 : 2 / 3;
    const next: ClassWithResult[] = classes.map((c) => {
      const slots = toSlots(c.weekdays, c.periods ?? [null, null, null, null]);
      const baseHours = countClassSlotsWithDuplicates(validDays, slots);
      const adj = adjustments[c.id] ?? { add: 0, subtract: 0 };
      const totalHours = Math.max(0, baseHours + adj.add - adj.subtract);
      const requiredAttendance = Math.ceil(totalHours * ratio);
      const requiredAtTwoThirds = Math.ceil(totalHours * (2 / 3));
      const requiredAtHalf = Math.ceil(totalHours * (1 / 2));
      const faceToFaceDays = isSpecialCare ? Math.max(0, requiredAtTwoThirds - requiredAtHalf) : 0;
      return {
        ...c,
        totalHours,
        requiredAttendance,
        isSpecialCare,
        faceToFaceDays,
      };
    });
    setResults(next);
  }, [validDays, classes, specialConsideration, adjustments]);

  const handleCount = () => runCount();

  // 特別な配慮のトグル変更時のみ再計算（既にカウント済みのとき）
  const prevSpecialRef = useRef<boolean>(specialConsideration);
  useEffect(() => {
    if (prevSpecialRef.current !== specialConsideration && results.length > 0) {
      runCount();
      prevSpecialRef.current = specialConsideration;
    } else {
      prevSpecialRef.current = specialConsideration;
    }
  }, [specialConsideration, results.length, runCount]);

  // 時数増減の保存後に再計算（リストと必要出席日数を即時更新）
  useEffect(() => {
    if (results.length > 0) runCount();
  }, [adjustments, runCount]);

  // 授業が追加されたとき（一括含む）にカウント実行
  useEffect(() => {
    if (validDays.length > 0 && classes.length > 0) runCount();
  }, [classes.length, validDays.length, runCount]);

  // 対象年度変更時にCSVを再パース（同じテキストで年度だけ変える）
  useEffect(() => {
    if (lastCsvTextRef.current != null) {
      try {
        const days = parseScheduleCsv(lastCsvTextRef.current, academicYear);
        setValidDays(days);
        setParseError(null);
      } catch {
        // パース失敗は無視（既に表示中の validDays を維持）
      }
    }
  }, [academicYear]);

  const hasResults = results.length > 0;
  const displayList = hasResults
    ? results
    : classes.map((c) => ({
        ...c,
        totalHours: 0,
        requiredAttendance: 0,
        isSpecialCare: specialConsideration,
        faceToFaceDays: 0,
      }));

  const handlePrintExcel = useCallback(async () => {
    const rows = displayList.map((row) => {
      const required = row.requiredAttendance ?? 0;
      const currentAtt = currentAttendances[row.id] ?? 0;
      const remaining = required > 0 ? required - currentAtt : 0;
      const slots = toSlots(row.weekdays, row.periods ?? [null, null, null, null]);
      const remainingClassDays =
        hasResults && validDays.length > 0
          ? countFutureClassSlots(validDays, slots, referenceDate.trim() || undefined)
          : 0;
      const supplementaryNeeded = Math.max(0, remaining - remainingClassDays);
      return {
        name: row.name,
        requiredAttendance: required,
        currentAttendance: currentAtt,
        remainingClassDays,
        supplementaryNeeded,
        supplementaryRecords: supplementaryByClass[row.id] ?? [],
        faceToFaceRecords: faceToFaceRecordsByClass[row.id] ?? [],
      };
    });
    await downloadPrintExcel({
      academicYear,
      referenceDate: referenceDate.trim() || formatToday(),
      className: classNameExport,
      studentName: studentNameExport,
      specialConsideration,
      rows,
    });
  }, [
    displayList,
    currentAttendances,
    validDays,
    hasResults,
    referenceDate,
    supplementaryByClass,
    faceToFaceRecordsByClass,
    academicYear,
    classNameExport,
    studentNameExport,
    specialConsideration,
  ]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        CSVマスターで授業時数をカウント
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        年間行事予定CSV（A列=日付、B列=内容、C〜H列=1限〜6限）を読み込み、各時限列に「授業」が入力されている時限を稼働として、各授業の総時数・必要出席日数を算出します。
      </p>

      {/* 対象年度・基準日・クラス・氏名・Excel出力 */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          対象年度・基準日・印刷用
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          残り授業日数は「基準日」以降の日程でカウントします。Excelで印刷するとクラス・氏名付きの帳票が出力されます。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">対象年度</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={academicYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setAcademicYear(v);
              }}
              className="mt-1 w-24 rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="対象年度（学校年度）"
            />
            <span className="ml-1 text-xs text-zinc-500">年度</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">基準日</label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="mt-1 rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="基準日（残り授業はこの日以降をカウント）"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">クラス名</label>
            <input
              type="text"
              value={classNameExport}
              onChange={(e) => setClassNameExport(e.target.value)}
              placeholder="例: 3年1組"
              className="mt-1 w-24 rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="クラス名（Excelファイル名・帳票に出力）"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">生徒氏名</label>
            <input
              type="text"
              value={studentNameExport}
              onChange={(e) => setStudentNameExport(e.target.value)}
              placeholder="例: 山田 太郎"
              className="mt-1 w-32 rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="生徒氏名（Excelファイル名・帳票に出力）"
            />
          </div>
          <button
            type="button"
            onClick={handlePrintExcel}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Excelで印刷
          </button>
        </div>
      </div>

      {showToggleBlock && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border-2 border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/30">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            特別な配慮が必要な生徒（2分の1対応）
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={specialConsideration}
            onClick={() => setSpecialConsideration(!specialConsideration)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
              specialConsideration
                ? "border-sky-500 bg-sky-500"
                : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                specialConsideration ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {specialConsideration ? "1/2 で計算" : "2/3 で計算"}
          </span>
        </div>
      )}

      {/* CSVアップロード */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          年間行事予定CSV
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            {csvFile ? csvFile.name : "CSVを選択"}
          </label>
          {validDays.length > 0 && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              授業実施データ {validDays.length} 件を読み込みました
            </span>
          )}
          {parseError && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {parseError}
            </span>
          )}
        </div>
      </div>

      {/* 授業登録フォーム */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          授業を追加
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="block text-xs text-zinc-500">授業名</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="例: 数学I"
              className="mt-0.5 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-zinc-500">授業出席数（初期値）</label>
            <input
              type="number"
              min={0}
              value={initialAttendance === 0 ? "" : initialAttendance}
              onChange={(e) => setInitialAttendance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className="mt-0.5 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-xs text-zinc-500">曜日・時限（最大4セット）</span>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800">
                <select
                  value={classWeekdays[i] === null ? "" : String(classWeekdays[i])}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWeekdayAt(i, v === "" ? null : parseInt(v, 10));
                  }}
                  className="rounded border-0 bg-transparent py-1 text-sm dark:text-zinc-100"
                >
                  {WEEKDAY_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value === null ? "" : String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={classPeriods[i] === null ? "" : String(classPeriods[i])}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPeriodAt(i, v === "" ? null : parseInt(v, 10));
                  }}
                  className="rounded border-0 bg-transparent py-1 text-sm dark:text-zinc-100"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value === null ? "" : String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddClass}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            授業を追加
          </button>
          <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            <input
              type="file"
              accept=".csv"
              onChange={handleBulkClassesCsv}
              className="sr-only"
            />
            授業をCSVで一括登録
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          一括登録CSV: A列=授業名, B列=授業出席日数, C列=曜日①・D列=時限①, E列=曜日②・F列=時限②, G列=曜日③・H列=時限③, I列=曜日④・J列=時限④。時限は1〜6の数値。ヘッダーあり/なし両対応。
        </p>
      </div>

      {/* 授業一覧 + カウント */}
      {classes.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              登録した授業（{classes.length}件）
            </h3>
            <button
              type="button"
              onClick={handleCount}
              disabled={validDays.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              カウント
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-2 pr-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    授業名
                  </th>
                  <th className="py-2 pr-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    設定（曜日・時限）
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    総授業時数
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    必要出席
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    出席実績
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    対面授業
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    残り授業日数
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    補修が必要な日数
                  </th>
                  <th className="py-2 pr-2 font-medium text-zinc-600 dark:text-zinc-400">
                    条件達成までの日数
                  </th>
                  <th className="py-2 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((row) => {
                  const adj = adjustments[row.id] ?? { add: 0, subtract: 0 };
                  const hasAdj = adj.add > 0 || adj.subtract > 0;
                  const currentAtt = currentAttendances[row.id] ?? 0;
                  const required = row.requiredAttendance ?? 0;
                  const remaining = required > 0 ? required - currentAtt : 0;
                  const slots = toSlots(row.weekdays, row.periods ?? [null, null, null, null]);
                  const remainingClassDays = hasResults && validDays.length > 0 ? countFutureClassSlots(validDays, slots, referenceDate.trim() || undefined) : 0;
                  const supplementaryNeeded = Math.max(0, remaining - remainingClassDays);
                  const status = getRemainingDaysStatus(remaining);
                  const colors = getRemainingDaysColors(status);
                  const gaugePercent = required > 0 ? Math.min(100, Math.round((100 * currentAtt) / required)) : 0;
                  const faceToFace = row.faceToFaceDays ?? 0;
                  const isExpanded = expandedRowId === row.id;
                  const supplementaryList = supplementaryByClass[row.id] ?? [];
                  const numSupplementInputs = supplementaryNeeded;
                  const setSupplementaryAt = (index: number, patch: { date?: string; content?: string }) => {
                    setSupplementaryByClass((prev) => {
                      const arr = prev[row.id] ?? [];
                      const next = arr.slice();
                      while (next.length <= index) next.push({ date: "", content: "" });
                      next[index] = { ...(next[index] ?? { date: "", content: "" }), ...patch };
                      return { ...prev, [row.id]: next };
                    });
                  };
                  const faceToFaceRecords = faceToFaceRecordsByClass[row.id] ?? [];
                  const numFaceToFaceInputs = specialConsideration && faceToFace > 0 ? faceToFace : 0;
                  const setFaceToFaceRecordAt = (index: number, patch: { date?: string; content?: string }) => {
                    setFaceToFaceRecordsByClass((prev) => {
                      const arr = prev[row.id] ?? [];
                      const next = arr.slice();
                      while (next.length <= index) next.push({ date: "", content: "" });
                      next[index] = { ...(next[index] ?? { date: "", content: "" }), ...patch };
                      return { ...prev, [row.id]: next };
                    });
                  };
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        key={row.id}
                        onClick={() => setExpandedRowId((prev) => (prev === row.id ? null : row.id))}
                        className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedRowId((prev) => (prev === row.id ? null : row.id));
                          }
                        }}
                        aria-expanded={isExpanded}
                      >
                      <td className="py-2.5 pr-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden>▶</span>
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-zinc-600 dark:text-zinc-400">
                        {slotsDisplay(row.weekdays, row.periods ?? [null, null, null, null])}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {hasResults ? (
                          <span>
                            {row.totalHours}
                            {hasAdj && (
                              <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                                ({adj.add > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{adj.add}</span>}
                                {adj.add > 0 && adj.subtract > 0 && " "}
                                {adj.subtract > 0 && <span className="text-rose-600 dark:text-rose-400">-{adj.subtract}</span>})
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {hasResults ? (
                          <span>
                            {row.requiredAttendance}
                            <span className="ml-0.5 text-xs text-zinc-500">({specialConsideration ? "1/2" : "2/3"})</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setCurrentAttendances((prev) => ({ ...prev, [row.id]: Math.max(0, (prev[row.id] ?? 0) - 1) }))}
                            className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                            aria-label="出席を1減らす"
                          >
                            −
                          </button>
                          <span className="min-w-[2ch] text-center font-medium">
                            {currentAtt}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentAttendances((prev) => ({ ...prev, [row.id]: (prev[row.id] ?? 0) + 1 }))}
                            className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                            aria-label="出席を1増やす"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        対面授業: {faceToFace}日
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {hasResults ? `${remainingClassDays}日` : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        {hasResults ? (
                          <>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              ①{remaining}日 − ②{remainingClassDays}回 = ③{supplementaryNeeded <= 0 ? "0日" : `${supplementaryNeeded}日不足`}
                            </div>
                            {supplementaryNeeded <= 0 ? (
                              <span className="tabular-nums text-blue-600 dark:text-blue-400">0日</span>
                            ) : (
                              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">
                                補修が必要: {supplementaryNeeded}日
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-2">
                        {hasResults && (
                          <div className="flex min-w-[90px] items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className={`h-full rounded-full transition-all ${colors.bar}`}
                                style={{ width: `${gaugePercent}%` }}
                              />
                            </div>
                            <span className={`shrink-0 text-xs tabular-nums ${colors.text}`} title="条件達成までの日数">
                              {remaining <= 0 ? "達成" : `${remaining}日`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setEditingClassId(row.id)}
                            className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-500"
                          >
                            編集（時数）
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveClass(row.id)}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            aria-label="削除"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-detail`} className="border-b border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                            {/* 過不足メッセージ */}
                            {remaining <= 0 ? (
                              <p className="text-center text-base font-medium text-emerald-600 dark:text-emerald-400">
                                🎉 条件達成済み（補修不要）
                              </p>
                            ) : supplementaryNeeded >= 1 ? (
                              <div className="rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
                                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                                  ⚠️ 授業に全て出席しても {supplementaryNeeded} 日不足します。課題等での補修が必要です。
                                </p>
                                <p className="mt-1 text-xs text-red-600/90 dark:text-red-400/90">
                                  ① 条件達成まで {remaining}日 − ② 残り授業 {remainingClassDays}回 = ③ 過不足 {supplementaryNeeded}日
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  このまま出席すれば達成可能です
                                </p>
                                <p className="mt-1 text-xs text-blue-600/90 dark:text-blue-400/90">
                                  ① 条件達成まで {remaining}日、② 残り授業 {remainingClassDays}回（③ 過不足 0日）
                                </p>
                              </div>
                            )}

                            {/* 補修フォーム（③の日数だけ） */}
                            {remaining > 0 && numSupplementInputs >= 1 && (
                              <div className="space-y-3">
                                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                  補修実施日と実施内容（不足 {numSupplementInputs} 日分）
                                </p>
                                <div className="space-y-3">
                                  {Array.from({ length: numSupplementInputs }, (_, i) => {
                                    const item = supplementaryList[i] ?? { date: "", content: "" };
                                    return (
                                      <div
                                        key={i}
                                        className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/30"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="w-14 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                          補修{i + 1}
                                        </span>
                                        <input
                                          type="date"
                                          value={item.date}
                                          onChange={(e) => setSupplementaryAt(i, { date: e.target.value })}
                                          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                          aria-label={`補修${i + 1} 日付`}
                                        />
                                        <input
                                          type="text"
                                          value={item.content}
                                          onChange={(e) => setSupplementaryAt(i, { content: e.target.value })}
                                          placeholder="実施内容（例: プリント課題）"
                                          className="min-w-[200px] flex-1 rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                                          aria-label={`補修${i + 1} 実施内容`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 対面授業の実施記録（1/2配慮時のみ） */}
                            {numFaceToFaceInputs >= 1 && (
                              <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                  対面授業の実施記録（全 {numFaceToFaceInputs} 回）
                                </p>
                                <div className="space-y-3">
                                  {Array.from({ length: numFaceToFaceInputs }, (_, i) => {
                                    const item = faceToFaceRecords[i] ?? { date: "", content: "" };
                                    return (
                                      <div
                                        key={i}
                                        className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50/30 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/20"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="w-16 shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400">
                                          対面{i + 1}
                                        </span>
                                        <input
                                          type="date"
                                          value={item.date}
                                          onChange={(e) => setFaceToFaceRecordAt(i, { date: e.target.value })}
                                          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                          aria-label={`対面授業${i + 1} 日付`}
                                        />
                                        <input
                                          type="text"
                                          value={item.content}
                                          onChange={(e) => setFaceToFaceRecordAt(i, { content: e.target.value })}
                                          placeholder="実施内容（例: 対面授業・代替課題）"
                                          className="min-w-[200px] flex-1 rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                                          aria-label={`対面授業${i + 1} 実施内容`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingClassId && (() => {
        const cls = classes.find((c) => c.id === editingClassId);
        const adj = adjustments[editingClassId] ?? { add: 0, subtract: 0 };
        const curAtt = currentAttendances[editingClassId] ?? 0;
        return cls ? (
          <ClassHoursAdjustModal
            isOpen={true}
            classId={editingClassId}
            className={cls.name}
            currentAdd={adj.add}
            currentSubtract={adj.subtract}
            currentAttendance={curAtt}
            onClose={() => setEditingClassId(null)}
            onSave={(add, subtract, currentAttendance) => handleSaveAdjustment(editingClassId, add, subtract, currentAttendance)}
          />
        ) : null;
      })()}
    </section>
  );
}
