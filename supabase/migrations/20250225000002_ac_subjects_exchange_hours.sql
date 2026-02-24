-- 授業の「交換授業」増減を保存するカラム追加（ac_ 接頭語維持）
alter table public.ac_subjects
  add column if not exists exchange_hours numeric(6,2) not null default 0;

comment on column public.ac_subjects.exchange_hours is '交換授業等による増減時数（正: 追加、負: 削減）';
