import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminSettingsApi } from "../api/adminSettings";
import { queryKeys } from "../lib/queryKeys";

interface AdminSessionContextValue {
  isUnlocked: boolean;
  token: string | null;
  authMode: "pin" | "sso" | null;
  unlock: (token: string, expiresAt: string) => void;
  lock: () => void;
}

const AdminSessionContext = createContext<AdminSessionContextValue>({
  isUnlocked: false,
  token: null,
  authMode: null,
  unlock: () => {},
  lock: () => {},
});

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: authModeData } = useQuery({
    queryKey: queryKeys.instance.adminAuthMode,
    queryFn: () => adminSettingsApi.getAuthMode(),
    staleTime: Infinity,
  });

  const authMode = authModeData?.mode ?? null;

  const lock = useCallback(() => {
    setToken(null);
    setExpiresAt(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const unlock = useCallback((newToken: string, expiresAtIso: string) => {
    const expMs = new Date(expiresAtIso).getTime();
    setToken(newToken);
    setExpiresAt(expMs);
  }, []);

  // Auto-lock on expiry
  useEffect(() => {
    if (!expiresAt) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      lock();
      return;
    }
    timerRef.current = setTimeout(lock, remaining);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [expiresAt, lock]);

  const value: AdminSessionContextValue = {
    isUnlocked: !!token,
    token,
    authMode,
    unlock,
    lock,
  };

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}
