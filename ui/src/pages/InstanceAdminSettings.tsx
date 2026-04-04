import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AGENT_ADAPTER_TYPES,
  AGENT_ROLES,
  AGENT_ROLE_LABELS,
  type AgentAdapterType,
  type AgentRole,
} from "@titanclip/shared";
import { Lock, LockOpen, ShieldCheck, KeyRound } from "lucide-react";
import { adminSettingsApi } from "@/api/adminSettings";
import { useAdminSession } from "../context/AdminSessionContext";
import { AdminPinDialog } from "../components/AdminPinDialog";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";

const ADAPTER_LABELS: Record<string, string> = {
  process: "Process",
  http: "HTTP",
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  pi_local: "Pi",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw",
  hermes_local: "Hermes",
};

export function InstanceAdminSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { isUnlocked, token, authMode, lock } = useAdminSession();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "Admin" },
    ]);
  }, [setBreadcrumbs]);

  const adminQuery = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof adminSettingsApi.update>[0]) =>
      adminSettingsApi.update(patch, token!),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update admin settings.");
    },
  });

  const changePinMutation = useMutation({
    mutationFn: () => adminSettingsApi.changePin(currentPin, newPin, token!),
    onSuccess: () => {
      setPinError(null);
      setPinSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setPinSuccess(false), 3000);
    },
    onError: (error) => {
      setPinError(error instanceof Error ? error.message : "Failed to change PIN.");
    },
  });

  if (adminQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading admin settings...</div>;
  }

  const data = adminQuery.data;
  const allowedAdapters = data?.allowedAdapterTypes ?? null;
  const allowedRoles = data?.allowedRoles ?? null;
  const allAdaptersAllowed = allowedAdapters === null;
  const allRolesAllowed = allowedRoles === null;

  function toggleAdapter(type: string) {
    if (!isUnlocked) return;
    if (allAdaptersAllowed) {
      // Switch from "all" to explicit list with this one removed
      updateMutation.mutate({
        allowedAdapterTypes: AGENT_ADAPTER_TYPES.filter((t) => t !== type) as string[],
      });
    } else {
      const current = allowedAdapters!;
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      updateMutation.mutate({
        allowedAdapterTypes: next.length === AGENT_ADAPTER_TYPES.length ? null : next,
      });
    }
  }

  function toggleAllAdapters() {
    if (!isUnlocked) return;
    updateMutation.mutate({ allowedAdapterTypes: allAdaptersAllowed ? [] : null });
  }

  function toggleRole(role: string) {
    if (!isUnlocked) return;
    if (allRolesAllowed) {
      updateMutation.mutate({
        allowedRoles: AGENT_ROLES.filter((r) => r !== role) as string[],
      });
    } else {
      const current = allowedRoles!;
      const next = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      updateMutation.mutate({
        allowedRoles: next.length === AGENT_ROLES.length ? null : next,
      });
    }
  }

  function toggleAllRoles() {
    if (!isUnlocked) return;
    updateMutation.mutate({ allowedRoles: allRolesAllowed ? [] : null });
  }

  function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    if (newPin.length < 4) {
      setPinError("New PIN must be at least 4 characters.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and confirmation do not match.");
      return;
    }
    changePinMutation.mutate();
  }

  const isAdapterChecked = (type: string) =>
    allAdaptersAllowed || allowedAdapters!.includes(type);

  const isRoleChecked = (role: string) =>
    allRolesAllowed || allowedRoles!.includes(role);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header with lock/unlock */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Admin Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Control which adapters, models, and roles are available for agent creation.
          </p>
        </div>
        {isUnlocked ? (
          <Button variant="outline" size="sm" onClick={lock} className="gap-2">
            <LockOpen className="h-4 w-4" />
            Lock
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => setPinDialogOpen(true)}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            Unlock
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Locked overlay */}
      <div className={cn(!isUnlocked && "opacity-50 pointer-events-none select-none")}>
        {/* Allowed Adapter Types */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Allowed Adapter Types</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllAdapters}
              disabled={updateMutation.isPending}
            >
              {allAdaptersAllowed ? "Restrict" : "Allow All"}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AGENT_ADAPTER_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                  isAdapterChecked(type)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={isAdapterChecked(type)}
                  onChange={() => toggleAdapter(type)}
                  disabled={updateMutation.isPending}
                  className="rounded"
                />
                {ADAPTER_LABELS[type] ?? type}
              </label>
            ))}
          </div>
        </div>

        {/* Allowed Agent Roles */}
        <div className="space-y-3 rounded-lg border p-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Allowed Agent Roles</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllRoles}
              disabled={updateMutation.isPending}
            >
              {allRolesAllowed ? "Restrict" : "Allow All"}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AGENT_ROLES.map((role) => (
              <label
                key={role}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                  isRoleChecked(role)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={isRoleChecked(role)}
                  onChange={() => toggleRole(role)}
                  disabled={updateMutation.isPending}
                  className="rounded"
                />
                {AGENT_ROLE_LABELS[role as AgentRole] ?? role}
              </label>
            ))}
          </div>
        </div>

        {/* Change PIN (hidden in SSO mode) */}
        {authMode !== "sso" && (
          <div className="space-y-3 rounded-lg border p-4 mt-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Change Admin PIN
            </h3>
            <form onSubmit={handleChangePin} className="space-y-3 max-w-sm">
              <div className="space-y-1">
                <Label htmlFor="current-pin" className="text-xs">Current PIN</Label>
                <Input
                  id="current-pin"
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-pin" className="text-xs">New PIN</Label>
                <Input
                  id="new-pin"
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-pin" className="text-xs">Confirm New PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              {pinError && (
                <p className="text-sm text-destructive">{pinError}</p>
              )}
              {pinSuccess && (
                <p className="text-sm text-green-500">PIN changed successfully.</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={changePinMutation.isPending || !currentPin || !newPin || !confirmPin}
              >
                {changePinMutation.isPending ? "Changing..." : "Change PIN"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* PIN Dialog */}
      <AdminPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
    </div>
  );
}
