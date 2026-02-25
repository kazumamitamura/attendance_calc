"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { parseScheduleCsv, countClassDays, type ValidSchoolDay } from "@/lib/csv-calendar";
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
  weekdays: (number | null)[]; // 最大4、各要素は 0-6 または なし
}

interface ClassWithResult extends RegisteredClass {
  totalHours: number;
  requiredAttendance: number;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function weekdaysDisplay(weekdays: (number | null)[]): string {
  const labels = weekdays
    .filter((w): w is number => w !== null)
    .map((w) => WEEKDAY_LABELS[w]);
  return labels.length > 0 ? labels.join("・") : "—";
}

export function ClassHoursFromCsv() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [validDays, setValidDays] = useState<ValidSchoolDay[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [className, setClassName] = useState("");
  const [classWeekdays, setClassWeekdays] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [classes, setClasses] = useState<RegisteredClass[]>([]);
  const [results, setResults] = useState<ClassWithResult[]>([]);
  const [specialConsideration, setSpecialConsideration] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, { add: number; subtract: number }>>({});
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setParseError(null);
      setValidDays([]);
      setCsvFile(file ?? null);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        try {
          const days = parseScheduleCsv(text);
          setValidDays(days);
          if (days.length === 0) setParseError("授業実施日（B列が空白の行）がありませんでした。");
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "CSVの解析に失敗しました。");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    []
  );

  const setWeekdayAt = (index: number, value: number | null) => {
    setClassWeekdays((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddClass = () => {
    const name = className.trim();
    if (!name) return;
    setClasses((prev) => [
      ...prev,
      { id: generateId(), name, weekdays: [...classWeekdays] },
    ]);
    setClassName("");
    setClassWeekdays([null, null, null, null]);
    setResults([]);
  };

  const handleRemoveClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setResults((prev) => prev.filter((r) => r.id !== id));
    setAdjustments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingClassId === id) setEditingClassId(null);
  };

  const handleSaveAdjustment = (id: string, add: number, subtract: number) => {
    setAdjustments((prev) => ({ ...prev, [id]: { add, subtract } }));
    setEditingClassId(null);
  };

  const runCount = useCallback(() => {
    if (validDays.length === 0 || classes.length === 0) return;
    const ratio = specialConsideration ? 1 / 2 : 2 / 3;
    const next: ClassWithResult[] = classes.map((c) => {
      const weekdaysToCount = c.weekdays.filter((w): w is number => w !== null);
      const baseHours = countClassDays(validDays, weekdaysToCount);
      const adj = adjustments[c.id] ?? { add: 0, subtract: 0 };
      const totalHours = Math.max(0, baseHours + adj.add - adj.subtract);
      const requiredAttendance = Math.ceil(totalHours * ratio);
      return { ...c, totalHours, requiredAttendance };
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

  const hasResults = results.length > 0;
  const displayList = hasResults ? results : classes.map((c) => ({ ...c, totalHours: 0, requiredAttendance: 0 }));

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        CSVマスターで授業時数をカウント
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        年間行事予定CSV（A列=日付、B列=内容）を読み込み、B列が空白の日を授業実施日として各授業の総時数・必要出席日数を算出します。
      </p>

      {/* 2分の1対応（特別な配慮）— 目立つ位置 */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          特別な配慮が必要な生徒（2分の1対応）
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={specialConsideration}
          onClick={() => setSpecialConsideration((v) => !v)}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            specialConsideration
              ? "border-amber-500 bg-amber-500"
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
              授業実施日 {validDays.length} 日を読み込みました
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
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-xs text-zinc-500">曜日（最大4つ）</span>
            {[0, 1, 2, 3].map((i) => (
              <select
                key={i}
                value={classWeekdays[i] === null ? "" : String(classWeekdays[i])}
                onChange={(e) => {
                  const v = e.target.value;
                  setWeekdayAt(i, v === "" ? null : parseInt(v, 10));
                }}
                className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {WEEKDAY_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value === null ? "" : String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddClass}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            授業を追加
          </button>
        </div>
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
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-2 pr-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    授業名
                  </th>
                  <th className="py-2 pr-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    設定曜日
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    総授業時数
                  </th>
                  <th className="py-2 pr-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    必要出席日数（{specialConsideration ? "1/2" : "2/3"}）
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
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="py-2.5 pr-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {row.name}
                      </td>
                      <td className="py-2.5 pr-2 text-zinc-600 dark:text-zinc-400">
                        {weekdaysDisplay(row.weekdays)}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {hasResults ? (
                          <span>
                            {row.totalHours}
                            {hasAdj && (
                              <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {adj.add > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{adj.add}</span>}
                                {adj.add > 0 && adj.subtract > 0 && " "}
                                {adj.subtract > 0 && <span className="text-red-600 dark:text-red-400">-{adj.subtract}</span>}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {hasResults ? row.requiredAttendance : "—"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-center gap-1">
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
        return cls ? (
          <ClassHoursAdjustModal
            isOpen={true}
            classId={editingClassId}
            className={cls.name}
            currentAdd={adj.add}
            currentSubtract={adj.subtract}
            onClose={() => setEditingClassId(null)}
            onSave={(add, subtract) => handleSaveAdjustment(editingClassId, add, subtract)}
          />
        ) : null;
      })()}
    </section>
  );
}
