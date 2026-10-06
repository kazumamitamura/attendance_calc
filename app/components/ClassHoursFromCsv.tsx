"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { parseScheduleCsv, getCurrentAcademicYear, type ValidSchoolDay } from "@/lib/csv-calendar";
import { parseClassesCsv, getClassesCsvTemplate } from "@/lib/classes-csv";
import {
  MAX_SCHEDULE_PATTERNS,
  applyPeriodToPattern,
  consolidateClassesByName,
  countClassSlotsForPatterns,
  countFutureClassSlotsForPatterns,
  createDefaultPattern,
  formatPatternsDisplay,
  hasAnySlot,
  upsertPatterns,
  type SchedulePattern,
} from "@/lib/schedule-patterns";
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

export interface RegisteredClass {
  id: string;
  name: string;
  /** 期間別時間割（最大5）。各期間の曜日・時限で年間時数を合算する */
  patterns: SchedulePattern[];
}

interface ClassWithResult extends RegisteredClass {
  totalHours: number;
  requiredAttendance: number;
  /** 基準日以降の授業実施回数 */
  remainingClassSessions: number;
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

function downloadClassesTemplate() {
  const blob = new Blob([getClassesCsvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "授業登録_ひな形.csv";
  a.click();
  URL.revokeObjectURL(url);
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
  /** 基準日（残り授業回数の「この日以降」に使う）。YYYY-MM-DD。未入力時は今日で計算 */
  const [referenceDate, setReferenceDate] = useState<string>(() => formatToday());
  const [classNameExport, setClassNameExport] = useState<string>("");
  const [studentNameExport, setStudentNameExport] = useState<string>("");
  const lastCsvTextRef = useRef<string | null>(null);

  const [className, setClassName] = useState("");
  const [initialAttendance, setInitialAttendance] = useState<number>(0);
  const [formPatterns, setFormPatterns] = useState<SchedulePattern[]>(() => [createDefaultPattern()]);
  const [classes, setClasses] = useState<RegisteredClass[]>([]);
  const [results, setResults] = useState<ClassWithResult[]>([]);
  const classCsvInputRef = useRef<HTMLInputElement>(null);
  const csvPeriodOverrideRef = useRef<SchedulePattern | null>(null);
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

  const updateFormPattern = (index: number, patch: Partial<SchedulePattern>) => {
    setFormPatterns((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const setFormSlot = (
    patternIndex: number,
    slotIndex: number,
    field: "weekdays" | "periods",
    value: number | null
  ) => {
    setFormPatterns((prev) => {
      const next = [...prev];
      const pattern = next[patternIndex];
      const arr = [...(pattern[field] ?? [null, null, null, null])];
      arr[slotIndex] = value;
      next[patternIndex] = { ...pattern, [field]: arr };
      return next;
    });
  };

  const handleAddFormPattern = () => {
    setFormPatterns((prev) => {
      if (prev.length >= MAX_SCHEDULE_PATTERNS) return prev;
      return [...prev, createDefaultPattern()];
    });
  };

  const handleRemoveFormPattern = (index: number) => {
    setFormPatterns((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleAddClass = () => {
    const name = className.trim();
    if (!name) return;
    const withSlots = formPatterns.filter(hasAnySlot);
    const incoming = (withSlots.length > 0 ? withSlots : [formPatterns[0] ?? createDefaultPattern()]).slice(
      0,
      MAX_SCHEDULE_PATTERNS
    );
    const attendance = initialAttendance ?? 0;
    setResults([]);
    const existing = classes.find((c) => c.name === name);
    if (existing) {
      setClasses((prev) =>
        prev.map((c) => (c.id === existing.id ? { ...c, patterns: upsertPatterns(c.patterns, incoming) } : c))
      );
    } else {
      const id = generateId();
      setClasses((prev) => [...prev, { id, name, patterns: incoming }]);
      setCurrentAttendances((prev) => ({ ...prev, [id]: attendance }));
    }
    setClassName("");
    setInitialAttendance(0);
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

  const handleClearAllClasses = () => {
    setClasses([]);
    setResults([]);
    setAdjustments({});
    setCurrentAttendances({});
    setSupplementaryByClass({});
    setFaceToFaceRecordsByClass({});
    setExpandedRowId(null);
    setEditingClassId(null);
  };

  const handleSaveAdjustment = (id: string, add: number, subtract: number, currentAttendance: number) => {
    setAdjustments((prev) => ({ ...prev, [id]: { add, subtract } }));
    setCurrentAttendances((prev) => ({ ...prev, [id]: currentAttendance }));
    setEditingClassId(null);
  };

  const applyImportedRows = useCallback(
    (rows: ReturnType<typeof parseClassesCsv>, periodOverride: SchedulePattern | null) => {
      const fallbackPeriod = periodOverride ?? formPatterns[formPatterns.length - 1] ?? createDefaultPattern();
      setParseError(null);
      setResults([]);
      let next = consolidateClassesByName(classes);
      const attendanceUpdates: Record<string, number> = {};
      for (const row of rows) {
        const incoming = (row.patterns ?? [createDefaultPattern()]).map((p) =>
          row.explicitDates ? p : applyPeriodToPattern(p, fallbackPeriod)
        );
        const existing = next.find((c) => c.name === row.name);
        if (existing) {
          next = next.map((c) =>
            c.id === existing.id ? { ...c, patterns: upsertPatterns(c.patterns, incoming) } : c
          );
        } else {
          const id = generateId();
          next = [...next, { id, name: row.name, patterns: incoming.slice(0, MAX_SCHEDULE_PATTERNS) }];
          attendanceUpdates[id] = row.attendanceCount ?? 0;
        }
      }
      setClasses(next);
      if (Object.keys(attendanceUpdates).length > 0) {
        setCurrentAttendances((att) => ({ ...att, ...attendanceUpdates }));
      }
    },
    [classes, formPatterns]
  );

  const handleBulkClassesCsv = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const periodOverride = csvPeriodOverrideRef.current;
      csvPeriodOverrideRef.current = null;
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        try {
          applyImportedRows(parseClassesCsv(text), periodOverride);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "授業CSVの解析に失敗しました。");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [applyImportedRows]
  );

  const openClassCsvPicker = (period: SchedulePattern | null) => {
    csvPeriodOverrideRef.current = period;
    classCsvInputRef.current?.click();
  };

  const runCount = useCallback(
    (list?: RegisteredClass[]) => {
      const source = consolidateClassesByName(list ?? classes);
      if (validDays.length === 0 || source.length === 0) return;
      const isSpecialCare = specialConsideration;
      const ratio = isSpecialCare ? 1 / 2 : 2 / 3;
      const next: ClassWithResult[] = source.map((c) => {
        const baseHours = countClassSlotsForPatterns(validDays, c.patterns ?? [], academicYear);
        const adj = adjustments[c.id] ?? { add: 0, subtract: 0 };
        const totalHours = Math.max(0, baseHours + adj.add - adj.subtract);
        const requiredAttendance = Math.ceil(totalHours * ratio);
        const requiredAtTwoThirds = Math.ceil(totalHours * (2 / 3));
        const requiredAtHalf = Math.ceil(totalHours * (1 / 2));
        const faceToFaceDays = isSpecialCare ? Math.max(0, requiredAtTwoThirds - requiredAtHalf) : 0;
        const remainingClassSessions = countFutureClassSlotsForPatterns(
          validDays,
          c.patterns ?? [],
          academicYear,
          referenceDate.trim() || undefined
        );
        return {
          ...c,
          totalHours,
          requiredAttendance,
          remainingClassSessions,
          isSpecialCare,
          faceToFaceDays,
        };
      });
      setResults(next);
    },
    [validDays, classes, specialConsideration, adjustments, academicYear, referenceDate]
  );

  const handleCount = () => {
    const merged = consolidateClassesByName(classes);
    if (merged.length !== classes.length) setClasses(merged);
    runCount(merged);
  };

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
        remainingClassSessions: 0,
        isSpecialCare: specialConsideration,
        faceToFaceDays: 0,
      }));

  const handlePrintExcel = useCallback(async () => {
    const rows = displayList.map((row) => {
      const required = row.requiredAttendance ?? 0;
      const currentAtt = currentAttendances[row.id] ?? 0;
      const remaining = required > 0 ? required - currentAtt : 0;
      const remainingClassSessions =
        hasResults && validDays.length > 0
          ? countFutureClassSlotsForPatterns(
              validDays,
              row.patterns ?? [],
              academicYear,
              referenceDate.trim() || undefined
            )
          : 0;
      const supplementaryNeeded = Math.max(0, remaining - remainingClassSessions);
      const graceDays = remainingClassSessions - remaining;
      return {
        name: row.name,
        slotsDisplay: formatPatternsDisplay(row.patterns),
        totalHours: row.totalHours ?? 0,
        requiredAttendance: required,
        currentAttendance: currentAtt,
        faceToFaceDays: row.faceToFaceDays ?? 0,
        remainingClassDays: remainingClassSessions,
        supplementaryNeeded,
        daysUntilCondition: remaining,
        graceDays,
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
        ①年間行事予定CSVを読み込む → ②通年同じ授業は1パターンだけ登録 → ③時間割が変わる授業は期間ごとにパターンを追加し、その期間の授業実施日から時数を出す → ④登録が終わったら「カウント」。各パターンの時数を合計してから必要出席（2/3 または 1/2）などを計算します。
      </p>

      {/* 対象年度・基準日・クラス・氏名・Excel出力 */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          対象年度・基準日・印刷用
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          残り授業回数は「基準日」以降の授業実施回数です。「カウント」で再計算します。Excelで印刷するとクラス・氏名付きの帳票が出力されます。
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
              aria-label="基準日（残り授業回数はこの日以降をカウント）"
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
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          同じ授業名は1行にまとめます。Aパターンの期間を入れて「この期間の時間割をCSVで登録」→ 必要ならBパターンを追加して同じ操作 → 最後に「カウント」。
        </p>
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
        </div>

        <div className="mt-3 space-y-3">
          {formPatterns.map((pattern, pi) => (
            <div
              key={pi}
              className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-800/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  パターン{pi + 1}（期間と曜日・時限）
                </span>
                {formPatterns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFormPattern(pi)}
                    className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  >
                    このパターンを削除
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs text-zinc-500">
                  開始
                  <span className="mt-0.5 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={pattern.startMonth}
                      onChange={(e) =>
                        updateFormPattern(pi, { startMonth: Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                      }
                      className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 開始月`}
                    />
                    <span>月</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={pattern.startDay}
                      onChange={(e) =>
                        updateFormPattern(pi, { startDay: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                      }
                      className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 開始日`}
                    />
                    <span>日</span>
                  </span>
                </label>
                <span className="pb-2 text-xs text-zinc-400">〜</span>
                <label className="text-xs text-zinc-500">
                  終了
                  <span className="mt-0.5 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={pattern.endMonth}
                      onChange={(e) =>
                        updateFormPattern(pi, { endMonth: Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                      }
                      className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 終了月`}
                    />
                    <span>月</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={pattern.endDay}
                      onChange={(e) =>
                        updateFormPattern(pi, { endDay: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                      }
                      className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 終了日`}
                    />
                    <span>日</span>
                  </span>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <span className="text-xs text-zinc-500">曜日・時限（最大4セット）</span>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    <select
                      value={pattern.weekdays[i] === null || pattern.weekdays[i] === undefined ? "" : String(pattern.weekdays[i])}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormSlot(pi, i, "weekdays", v === "" ? null : parseInt(v, 10));
                      }}
                      className="rounded border-0 bg-transparent py-1 text-sm dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 曜日${i + 1}`}
                    >
                      {WEEKDAY_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value === null ? "" : String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={pattern.periods[i] === null || pattern.periods[i] === undefined ? "" : String(pattern.periods[i])}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormSlot(pi, i, "periods", v === "" ? null : parseInt(v, 10));
                      }}
                      className="rounded border-0 bg-transparent py-1 text-sm dark:text-zinc-100"
                      aria-label={`パターン${pi + 1} 時限${i + 1}`}
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
                onClick={() => openClassCsvPicker(pattern)}
                className="mt-3 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
              >
                この期間の時間割をCSVで登録
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={classCsvInputRef}
            type="file"
            accept=".csv"
            onChange={handleBulkClassesCsv}
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleAddFormPattern}
            disabled={formPatterns.length >= MAX_SCHEDULE_PATTERNS}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            期間パターンを追加（{formPatterns.length}/{MAX_SCHEDULE_PATTERNS}）
          </button>
          <button
            type="button"
            onClick={handleAddClass}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            授業を追加
          </button>
          <button
            type="button"
            onClick={() => openClassCsvPicker(null)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            日付入りCSVを一括登録
          </button>
          <button
            type="button"
            onClick={downloadClassesTemplate}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            CSVひな形をダウンロード
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          曜日・時限だけの旧CSVは、各パターンの「この期間の時間割をCSVで登録」を使ってください（そのパターンの開始〜終了で年間行事から時数を取ります）。日付入りCSVは同一授業名を行分けで最大{MAX_SCHEDULE_PATTERNS}パターン。A列=授業名, B列=出席実績, C列=開始, D列=終了, E列以降=曜日・時限。同じ授業名は上書きせず1授業にパターン追加します。
        </p>
      </div>

      {/* 授業一覧 + カウント */}
      {classes.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              登録した授業（{new Set(classes.map((c) => c.name)).size}件
              {classes.length !== new Set(classes.map((c) => c.name)).size
                ? `／表示 ${classes.length}件に重複あり。カウントで1授業にまとめます`
                : ""}
              ）
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearAllClasses}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                登録をすべて削除
              </button>
              <button
                type="button"
                onClick={handleCount}
                disabled={validDays.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              >
                カウント
              </button>
            </div>
          </div>
          {validDays.length === 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              先に年間行事予定CSVを読み込んでからカウントしてください。
            </p>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-sm">
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
                    残り授業回数
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    補修が必要な日数
                  </th>
                  <th className="py-2 pr-2 font-medium text-zinc-600 dark:text-zinc-400">
                    条件達成までの回数
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    猶予回数
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
                  const remainingClassSessions =
                    hasResults && validDays.length > 0
                      ? countFutureClassSlotsForPatterns(
                          validDays,
                          row.patterns ?? [],
                          academicYear,
                          referenceDate.trim() || undefined
                        )
                      : 0;
                  const supplementaryNeeded = Math.max(0, remaining - remainingClassSessions);
                  const graceDays = remainingClassSessions - remaining;
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
                      <td className="whitespace-pre-line py-2.5 pr-2 text-zinc-600 dark:text-zinc-400">
                        {formatPatternsDisplay(row.patterns)}
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
                        {hasResults ? `${remainingClassSessions}回` : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        {hasResults ? (
                          <>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              ①{remaining}日 − ②{remainingClassSessions}回 = ③{supplementaryNeeded <= 0 ? "0日" : `${supplementaryNeeded}日不足`}
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
                            <span className={`shrink-0 text-xs tabular-nums ${colors.text}`} title="条件達成までの回数">
                              {remaining <= 0 ? "達成" : `${remaining}回`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">
                        {hasResults ? (
                          <span
                            className={
                              graceDays < 0
                                ? "font-medium text-red-600 dark:text-red-400"
                                : graceDays === 0
                                  ? "text-zinc-700 dark:text-zinc-300"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }
                            title="残り授業回数 − 条件達成までの回数"
                          >
                            {graceDays}回
                          </span>
                        ) : (
                          "—"
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
                        <td colSpan={11} className="px-4 py-4">
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
                                  ① 条件達成まで {remaining}回 − ② 残り授業 {remainingClassSessions}回 = ③ 過不足 {supplementaryNeeded}日
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  このまま出席すれば達成可能です
                                </p>
                                <p className="mt-1 text-xs text-blue-600/90 dark:text-blue-400/90">
                                  ① 条件達成まで {remaining}回、② 残り授業 {remainingClassSessions}回（③ 過不足 0日）
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
