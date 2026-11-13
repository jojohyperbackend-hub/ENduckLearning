-- Tabel kredensial buat login email+password, TERPISAH dari Supabase Auth
-- (Supabase Auth cuma dipakai buat login Google / app_user ini nggak nyentuh
-- auth.users sama sekali).
--
-- Cara pake: buka Supabase Dashboard -> SQL Editor -> paste semua isi file
-- ini -> Run.

create extension if not exists pgcrypto;

create table if not exists public.app_user (
  user_id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists app_user_email_idx on public.app_user (email);

-- RLS dinyalain supaya anon key (yang dipakai frontend/Google login) sama
-- sekali nggak bisa baca tabel ini. Backend akses lewat service_role key,
-- yang otomatis bypass RLS, jadi nggak perlu bikin policy apa pun.
alter table public.app_user enable row level security;
