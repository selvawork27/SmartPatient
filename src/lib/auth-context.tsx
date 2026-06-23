"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginPatient, logoutPatient } from "@/lib/hms-client";
import type { LoginResult, PatientUser } from "@/types/hms";

type AuthState = {
  token: string | null;
  user: PatientUser | null;
  isReady: boolean;
  login: (mobileNumber: string, dob: string) => Promise<void>;
  logout: () => Promise<void>;
};

const storageKey = "smartpatient.session";
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PatientUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LoginResult;
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setIsReady(true);
  }, []);

  const login = useCallback(async (mobileNumber: string, dob: string) => {
    const result = await loginPatient(mobileNumber, dob);
    window.localStorage.setItem(storageKey, JSON.stringify(result));
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    window.localStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
    if (currentToken) {
      await logoutPatient(currentToken).catch(() => undefined);
    }
  }, [token]);

  const value = useMemo(() => ({ token, user, isReady, login, logout }), [token, user, isReady, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
