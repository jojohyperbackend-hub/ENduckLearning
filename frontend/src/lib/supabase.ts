import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const GOOGLE_NOT_CONFIGURED_MESSAGE =
  "Google login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.";

let client: SupabaseClient | null = null;

// Dibuat lazy: kalau env belum diisi, app tetap jalan dan cuma tombol Google
// yang kasih pesan jelas (bukan crash saat startup).
//
// Supabase di sini HANYA dipakai buat OAuth Google. Sesi aplikasi tetap cookie
// JWT dari backend, jadi supabase-js tidak menyimpan apa pun di storage.
// flowType "implicit" dipakai karena PKCE butuh storage buat code verifier.
export const getSupabase = (): SupabaseClient => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(GOOGLE_NOT_CONFIGURED_MESSAGE);
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
};

const readParams = (): URLSearchParams[] => [
  new URLSearchParams(window.location.hash.replace(/^#/, "")),
  new URLSearchParams(window.location.search),
];

// Apakah URL sekarang hasil redirect balik dari Google (sukses atau gagal)?
export const hasOAuthCallback = (): boolean =>
  readParams().some(
    (params) => params.has("access_token") || params.has("error_description"),
  );

// Pesan error dari Supabase/Google (mis. user tekan "Cancel"), atau null.
export const readOAuthError = (): string | null => {
  for (const params of readParams()) {
    const description = params.get("error_description");
    if (description) return description.replace(/\+/g, " ");
  }
  return null;
};

// Buang token/error dari address bar biar gak ikut ke-copy atau ke-bookmark.
export const clearOAuthParamsFromUrl = (): void => {
  window.history.replaceState(window.history.state, "", window.location.pathname);
};
