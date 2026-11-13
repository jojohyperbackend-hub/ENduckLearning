import type { ApiEnvelope } from "../types";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Method = "GET" | "POST";

interface RequestOptions {
  method?: Method;
  body?: unknown;
}

// AuthContext mendaftar di sini supaya client bisa kasih tahu "sesi habis"
// tanpa import circular.
let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

// FastAPI HTTPException -> {detail: string}; error validasi 422 -> {detail: [{msg}]}.
const extractMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload !== "object" || payload === null) return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error) return record.error;
  const detail = record.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first?.msg === "string") return first.msg;
  }
  return fallback;
};

const send = async (path: string, { method = "GET", body }: RequestOptions) => {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include", // cookie httpOnly access_token & refresh_token
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Tidak bisa terhubung ke server. Cek koneksi internet kamu.");
  }
};

// Satu refresh yang jalan sekaligus, request lain yang kena 401 ikut nunggu.
let refreshing: Promise<boolean> | null = null;
const refreshSession = (): Promise<boolean> => {
  if (!refreshing) {
    refreshing = send("/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

const parseJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

export const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  let res = await send(path, options);

  // Access token cuma 15 menit: coba refresh sekali, lalu ulang request.
  // Endpoint /auth/* dikecualikan (login salah != sesi habis).
  if (res.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await send(path, options);
    }
    if (res.status === 401) {
      unauthorizedHandler?.();
    }
  }

  const payload = await parseJson(res);

  if (!res.ok) {
    throw new ApiError(
      extractMessage(payload, `Permintaan gagal (${res.status})`),
      res.status,
    );
  }

  const envelope = payload as ApiEnvelope<T> | null;
  if (!envelope || typeof envelope.success !== "boolean") {
    throw new ApiError("Respon server tidak sesuai format.", res.status);
  }
  if (!envelope.success) {
    throw new ApiError(envelope.error ?? "Terjadi kesalahan.", res.status);
  }
  return envelope.data as T;
};

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body });

// Kode dari backend kalau heart di database sudah 0 (jaring pengaman API).
export const HEARTS_EMPTY = "HEARTS_EMPTY";

export const isHeartsEmptyError = (error: unknown): boolean =>
  error instanceof ApiError && error.message === HEARTS_EMPTY;

export const getErrorMessage = (error: unknown): string => {
  if (isHeartsEmptyError(error)) return "Heart kamu habis. Tunggu heart terisi lagi.";
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
};
