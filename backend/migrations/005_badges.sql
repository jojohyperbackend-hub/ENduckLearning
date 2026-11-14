-- Badge baru:
--   Miss Mulu            -> salah di lesson lebih dari 5x berturut-turut (6x)
--   Cie Udah Compe Nih   -> bener di lesson 4x berturut-turut
--   Calon Juara          -> total XP 450
--   Sang Juara           -> total XP 1800
--
-- "Berturut-turut" dihitung lintas lesson/unit mana pun (counter disimpan di user_progress).
-- Jawaban bener reset counter salah, jawaban salah reset counter bener.
-- Review dan Latihan AI gak ikut ngitung, cuma soal di lesson.
--
-- Aman dijalanin berkali-kali.
-- Cara pake: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Habis itu: Project Settings -> API -> Reload schema.

-- 1. Kolom nama + kode unik buat badge.
alter table public.badge add column if not exists name text;
alter table public.badge add column if not exists code text;
create unique index if not exists badge_code_key on public.badge (code);

-- 2. Kalau criteria_type dulu dikunci CHECK constraint (cuma total_xp/current_streak),
--    lepas biar tipe streak lesson bisa masuk.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'badge'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%criteria_type%'
  loop
    execute format('alter table public.badge drop constraint %I', constraint_row.conname);
  end loop;
end $$;

-- 3. Counter jawaban berturut-turut di lesson.
alter table public.user_progress
  add column if not exists lesson_correct_streak integer not null default 0;
alter table public.user_progress
  add column if not exists lesson_wrong_streak integer not null default 0;

-- 4. Isi 4 badge. Kalau udah ada (kode sama), nama & syaratnya di-update.
insert into public.badge (badge_id, code, name, criteria_type, criteria_value)
values
  (gen_random_uuid(), 'miss_mulu',          'Miss Mulu',          'lesson_wrong_streak',   6),
  (gen_random_uuid(), 'cie_udah_compe_nih', 'Cie Udah Compe Nih', 'lesson_correct_streak', 4),
  (gen_random_uuid(), 'calon_juara',        'Calon Juara',        'total_xp',              450),
  (gen_random_uuid(), 'sang_juara',         'Sang Juara',         'total_xp',              1800)
on conflict (code) do update
  set name = excluded.name,
      criteria_type = excluded.criteria_type,
      criteria_value = excluded.criteria_value;

-- Cek hasil:
-- select code, name, criteria_type, criteria_value from public.badge order by criteria_type, criteria_value;
