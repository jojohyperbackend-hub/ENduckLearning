-- Regenerasi heart: 1 heart balik 4 menit setelah heart itu hilang.
-- Tiap heart yang hilang punya jadwal balik sendiri (disimpan sebagai array waktu UTC),
-- jadi heart yang hilang di jam berbeda baliknya juga di jam berbeda.
--
-- Cara pake: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Habis itu: Project Settings -> API -> Reload schema (biar backend langsung kenal kolomnya).

alter table public.user_progress
  add column if not exists heart_regen_timestamps jsonb not null default '[]'::jsonb;
