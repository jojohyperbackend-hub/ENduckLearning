import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/authApi";
import { setUnauthorizedHandler } from "../api/client";
import { getMyProgress } from "../api/progressApi";
import type {
  AuthStatus,
  LoginPayload,
  RegisterOutcome,
  RegisterPayload,
  SessionUser,
} from "../types";

export interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  // "needs_login": akun jadi tapi belum ada sesi (Supabase "Confirm email" nyala).
  register: (payload: RegisterPayload) => Promise<RegisterOutcome>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook-nya ada di hooks/useAuth.ts
export const AuthContext = createContext<AuthContextValue | null>(null);

// Cek apakah cookie sesi masih valid. /progress/me dipakai karena belum ada /auth/me.
const fetchSessionUser = async (): Promise<SessionUser | null> => {
  try {
    const progress = await getMyProgress();
    return { user_id: progress.user_id, email: null };
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    fetchSessionUser().then((sessionUser) => {
      if (cancelled) return;
      setUser(sessionUser);
      setStatus(sessionUser ? "authenticated" : "guest");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh token gagal di tengah jalan -> anggap logout.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("guest");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authApi.login(payload);
    setUser({ user_id: data.user_id, email: data.email });
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterOutcome> => {
      const data = await authApi.register(payload);
      // Respons register sama persis dengan/tanpa cookie, jadi cek sesinya.
      const sessionUser = await fetchSessionUser();
      if (!sessionUser) return "needs_login";
      setUser({ user_id: data.user_id, email: data.email });
      setStatus("authenticated");
      return "logged_in";
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
