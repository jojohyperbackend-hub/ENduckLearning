import { post } from "./client";
import type { AuthUser, LoginPayload, RegisterPayload } from "../types";

export const register = (payload: RegisterPayload) =>
  post<AuthUser>("/auth/register", payload);

export const login = (payload: LoginPayload) =>
  post<AuthUser>("/auth/login", payload);

export const loginWithGoogle = (supabaseAccessToken: string) =>
  post<AuthUser>("/auth/google/callback", {
    supabase_access_token: supabaseAccessToken,
  });

export const logout = () => post<null>("/auth/logout");
