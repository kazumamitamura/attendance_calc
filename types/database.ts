/**
 * attendance_calc - Supabase DB型定義
 * テーブル・型名は ac_ 接頭語で統一
 */

export type AcDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** ac_records テーブル（開校日数・登校日数・特別配慮等） */
export interface AcRecord {
  id: string;
  name: string;
  total_school_days: number;
  student_attendance_days: number;
  special_consideration: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** ac_records 挿入用（id, created_at, updated_at は省略可） */
export type AcRecordInsert = Omit<AcRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/** ac_records 更新用（部分更新） */
export type AcRecordUpdate = Partial<Omit<AcRecord, "id" | "created_at">>;

/** ac_subjects テーブル（科目・曜日・予定時数・マイナス時数） */
export interface AcSubject {
  id: string;
  ac_record_id: string;
  subject_name: string;
  day_of_week: AcDayOfWeek;
  planned_hours: number;
  minus_hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** ac_subjects 挿入用 */
export type AcSubjectInsert = Omit<AcSubject, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/** ac_subjects 更新用 */
export type AcSubjectUpdate = Partial<Omit<AcSubject, "id" | "ac_record_id" | "created_at">>;

/** 授業時数 = 予定時数 - マイナス時数 */
export function acEffectiveHours(subject: Pick<AcSubject, "planned_hours" | "minus_hours">): number {
  return Math.max(0, subject.planned_hours - subject.minus_hours);
}
