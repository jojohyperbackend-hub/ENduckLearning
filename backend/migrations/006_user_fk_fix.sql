-- Fix: "insert or update on table user_badge violates foreign key constraint
--       user_badge_user_id_fkey ... is not present in table users"
--
-- User di app ini ada 2 jenis:
--   - login email+password  -> tabel public.app_user
--   - login Google          -> auth.users (Supabase Auth)
-- Jadi kolom user_id gak boleh dikunci foreign key ke salah satu tabel users aja,
-- soalnya user dari jenis satunya bakal ditolak (sama kayak error review_queue dulu).
--
-- Script ini lepas SEMUA foreign key di schema public yang nunjuk ke tabel
-- "users" (auth.users atau public.users). Data gak ada yang kehapus.
-- Aman dijalanin berkali-kali.
--
-- Cara pake: Supabase Dashboard -> SQL Editor -> paste -> Run.

do $$
declare
  fk record;
begin
  for fk in
    select con.conname, rel.relname as table_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class ref on ref.oid = con.confrelid
    join pg_namespace ref_nsp on ref_nsp.oid = ref.relnamespace
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and ref.relname = 'users'
      and ref_nsp.nspname in ('auth', 'public')
  loop
    execute format('alter table public.%I drop constraint %I', fk.table_name, fk.conname);
    raise notice 'Foreign key % di tabel % dilepas', fk.conname, fk.table_name;
  end loop;
end $$;

-- Cek: hasilnya harus kosong.
-- select con.conname, con.conrelid::regclass as tabel
-- from pg_constraint con
-- where con.contype = 'f' and con.confrelid::regclass::text in ('users', 'auth.users', 'public.users');
