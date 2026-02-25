"use client";

import { useState, useEffect } from "react";

export interface AdjustmentValues {
  add: number;
  subtract: number;
}

interface ClassHoursAdjustModalProps {
  isOpen: boolean;
  classId: string;
  className: string;
  currentAdd: number;
  currentSubtract: number;
  currentAttendance: number;
  onClose: () => void;
  onSave: (add: number, subtract: number, currentAttendance: number) => void;
}

export function ClassHoursAdjustModal({
  isOpen,
  classId,
  className,
  currentAdd,
  currentSubtract,
  currentAttendance,
  onClose,
  onSave,
}: ClassHoursAdjustModalProps) {
  const [add, setAdd] = useState(currentAdd);
  const [subtract, setSubtract] = useState(currentSubtract);
  const [attendance, setAttendance] = useState(currentAttendance);

  useEffect(() => {
    if (isOpen) {
      setAdd(currentAdd);
      setSubtract(currentSubtract);
      setAttendance(currentAttendance);
    }
  }, [isOpen, classId, currentAdd, currentSubtract, currentAttendance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(add, subtract, attendance);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-modal-title"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="adjust-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          時数の増減 — {className}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          入力間違いを防ぐため、増やす分と減らす分を別々に入力してください。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="adjust-add" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              増やす（追加）
            </label>
            <input
              id="adjust-add"
              type="number"
              min={0}
              value={add === 0 ? "" : add}
              onChange={(e) => setAdd(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="adjust-subtract" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              減らす（削減）
            </label>
            <input
              id="adjust-subtract"
              type="number"
              min={0}
              value={subtract === 0 ? "" : subtract}
              onChange={(e) => setSubtract(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="adjust-attendance" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              現在の出席時数
            </label>
            <input
              id="adjust-attendance"
              type="number"
              min={0}
              value={attendance === 0 ? "" : attendance}
              onChange={(e) => setAttendance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="mt-0.5 text-xs text-zinc-500">条件達成までの日数のゲージに使用します</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
