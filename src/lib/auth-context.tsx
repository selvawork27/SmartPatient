"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearStoredSession, getStoredSession, logoutPatient, requestPatientOtp, verifyPatientOtp, writeStoredSession } from "@/lib/hms-client";
import type { LoginResult, PatientUser } from "@/types/hms";

type AuthState = {
  token: string | null;
  user: PatientUser | null;
  isReady: boolean;
  requestOtp: (mobileNumber: string, dob: string) => Promise<void>;
  verifyOtp: (mobileNumber: string, dob: string, firebaseIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PatientUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const parsed = getStoredSession();
    if (parsed) {
      setToken(parsed.token);
      setUser(parsed.user);
    }
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<LoginResult | null>).detail;
      setToken(detail?.token || null);
      setUser(detail?.user || null);
    };
    window.addEventListener("smartpatient.session", onSession);
    setIsReady(true);
    return () => window.removeEventListener("smartpatient.session", onSession);
  }, []);

  const requestOtp = useCallback(async (mobileNumber: string, dob: string) => {
    await requestPatientOtp(mobileNumber, dob);
  }, []);

  const verifyOtp = useCallback(async (mobileNumber: string, dob: string, firebaseIdToken: string) => {
    const result = await verifyPatientOtp(mobileNumber, dob, firebaseIdToken);
    writeStoredSession(result);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    clearStoredSession();
    setToken(null);
    setUser(null);
    if (currentToken) {
      await logoutPatient(currentToken).catch(() => undefined);
    }
  }, [token]);

  const value = useMemo(
    () => ({ token, user, isReady, requestOtp, verifyOtp, logout }),
    [token, user, isReady, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
