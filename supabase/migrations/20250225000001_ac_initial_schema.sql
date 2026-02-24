-- attendance_calc: 出席日数・授業時数計算アプリ
-- 接頭語 ac_ を必ず使用（同一Supabaseプロジェクト内の他アプリと区別）

-- ac_records: 全体の開校日数・生徒登校日数・特別配慮フラグ等
create table if not exists public.ac_records (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  total_school_days integer not null default 0 check (total_school_days >= 0),
  student_attendance_days integer not null default 0 check (student_attendance_days >= 0),
  special_consideration boolean not null default false,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ac_records is '出席日数計算: 開校日数・登校日数・特別配慮等の記録';
comment on column public.ac_records.name is '記録名（例: 年度・学期）';
comment on column public.ac_records.total_school_days is '開校日数';
comment on column public.ac_records.student_attendance_days is '生徒の登校日数';
comment on column public.ac_records.special_consideration is '特別配慮の有無';

-- ac_subjects: 科目・曜日・予定時数・休講等マイナス時数（ac_records に紐づく）
create table if not exists public.ac_subjects (
  id uuid primary key default gen_random_uuid(),
  ac_record_id uuid not null references public.ac_records(id) on delete cascade,
  subject_name text not null default '',
  day_of_week smallint not null default 0 check (day_of_week >= 0 and day_of_week <= 6),
  planned_hours numeric(6,2) not null default 0 check (planned_hours >= 0),
  minus_hours numeric(6,2) not null default 0 check (minus_hours >= 0),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ac_subjects is '出席日数計算: 科目・曜日・予定時数・変更/休講分';
comment on column public.ac_subjects.ac_record_id is 'ac_records への外部キー';
comment on column public.ac_subjects.subject_name is '科目名';
comment on column public.ac_subjects.day_of_week is '曜日 (0=日, 1=月, ..., 6=土)';
comment on column public.ac_subjects.planned_hours is '予定時数';
comment on column public.ac_subjects.minus_hours is '変更・休講によるマイナス時数';

-- インデックス（ac_ 接頭語で一貫）
create index if not exists ac_subjects_ac_record_id_idx on public.ac_subjects(ac_record_id);
create index if not exists ac_records_created_at_idx on public.ac_records(created_at desc);

-- updated_at 自動更新（ac_ 用のトリガー関数は接頭語を付与）
create or replace function public.ac_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ac_records_updated_at
  before update on public.ac_records
  for each row execute function public.ac_set_updated_at();

create trigger ac_subjects_updated_at
  before update on public.ac_subjects
  for each row execute function public.ac_set_updated_at();

-- RLS 有効化（必要に応じてポリシーを追加）
alter table public.ac_records enable row level security;
alter table public.ac_subjects enable row level security;

-- 同一プロジェクト内他アプリと区別するため、全テーブル読み書きを許可するポリシー例（本番では認証に合わせて変更）
create policy "ac_records_select" on public.ac_records for select using (true);
create policy "ac_records_insert" on public.ac_records for insert with check (true);
create policy "ac_records_update" on public.ac_records for update using (true);
create policy "ac_records_delete" on public.ac_records for delete using (true);

create policy "ac_subjects_select" on public.ac_subjects for select using (true);
create policy "ac_subjects_insert" on public.ac_subjects for insert with check (true);
create policy "ac_subjects_update" on public.ac_subjects for update using (true);
create policy "ac_subjects_delete" on public.ac_subjects for delete using (true);
