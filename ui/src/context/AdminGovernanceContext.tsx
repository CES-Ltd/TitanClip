import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminSettingsApi } from "../api/adminSettings";
import { queryKeys } from "../lib/queryKeys";

interface AdminGovernanceContextValue {
  allowedAdapterTypes: string[] | null;
  allowedModelsPerAdapter: Record<string, string[] | null> | null;
  allowedRoles: string[] | null;
  isLoaded: boolean;
}

const AdminGovernanceContext = createContext<AdminGovernanceContextValue>({
  allowedAdapterTypes: null,
  allowedModelsPerAdapter: null,
  allowedRoles: null,
  isLoaded: false,
});

export function useAdminGovernance() {
  return useContext(AdminGovernanceContext);
}

export function AdminGovernanceProvider({ children }: { children: ReactNode }) {
  const { data, isSuccess } = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
    staleTime: 30_000,
  });

  const value: AdminGovernanceContextValue = {
    allowedAdapterTypes: data?.allowedAdapterTypes ?? null,
    allowedModelsPerAdapter: data?.allowedModelsPerAdapter ?? null,
    allowedRoles: data?.allowedRoles ?? null,
    isLoaded: isSuccess,
  };

  return (
    <AdminGovernanceContext.Provider value={value}>
      {children}
    </AdminGovernanceContext.Provider>
  );
}
