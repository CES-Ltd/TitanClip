import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Shield, Eye, UserCheck } from "lucide-react";
import { TEAM_ROLE_LABELS, TEAM_ROLE_DESCRIPTIONS } from "@titanclip/shared";
import type { TeamRoleLevel } from "@titanclip/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { teamRolesApi } from "../api/teamRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";

const ROLES: TeamRoleLevel[] = ["team_admin", "member", "viewer"];

const ROLE_ICONS: Record<string, typeof Shield> = {
  instance_admin: Shield,
  team_admin: UserCheck,
  member: Users,
  viewer: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  instance_admin: "text-indigo-400 bg-indigo-500/10",
  team_admin: "text-amber-400 bg-amber-500/10",
  member: "text-emerald-400 bg-emerald-500/10",
  viewer: "text-zinc-400 bg-zinc-500/10",
};

export function TeamMembers() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const cid = selectedCompanyId!;

  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<string>("member");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setBreadcrumbs([{ label: "Team Members" }]); }, [setBreadcrumbs]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-roles", cid],
    queryFn: () => teamRolesApi.list(cid),
    enabled: !!cid,
  });

  const assignMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => teamRolesApi.assign(cid, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roles", cid] });
      pushToast({ title: "Member added", tone: "success" });
      setShowAdd(false); setNewUserId(""); setNewRole("member"); setError(null);
    },
    onError: (e) => setError((e as Error).message),
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => teamRolesApi.assign(cid, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roles", cid] });
      pushToast({ title: "Role updated", tone: "success" });
    },
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => teamRolesApi.remove(cid, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roles", cid] });
      pushToast({ title: "Member removed", tone: "warn" });
    },
  });

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Team Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who has access to {selectedCompany?.name ?? "this team"} and their permission level.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Member
        </Button>
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-4 gap-2">
        {(["instance_admin", ...ROLES] as TeamRoleLevel[]).map((role) => {
          const Icon = ROLE_ICONS[role] ?? Users;
          return (
            <div key={role} className="rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn("h-3.5 w-3.5", ROLE_COLORS[role]?.split(" ")[0])} />
                <span className="text-xs font-medium">{TEAM_ROLE_LABELS[role]}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{TEAM_ROLE_DESCRIPTIONS[role]}</p>
            </div>
          );
        })}
      </div>

      {/* Add Member Form */}
      {showAdd && (
        <div className="rounded-xl border p-4 bg-card space-y-3">
          <h3 className="text-sm font-medium">Add Team Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">User ID / Email</Label>
              <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="user@example.com or user ID" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => assignMut.mutate({ userId: newUserId, role: newRole })}
              disabled={!newUserId.trim() || assignMut.isPending}>
              {assignMut.isPending ? "Adding..." : "Add Member"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Members List */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading members...</p>}
      {members.length === 0 && !isLoading && (
        <div className="text-center py-8 border border-dashed border-border/50 rounded-2xl">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No team members configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">In local trusted mode, all users have full access</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map((member) => {
          const Icon = ROLE_ICONS[member.role] ?? Users;
          return (
            <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/10 transition-colors">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", ROLE_COLORS[member.role] ?? "bg-muted text-muted-foreground")}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.userId}</p>
                <p className="text-[11px] text-muted-foreground">
                  Added {new Date(member.createdAt).toLocaleDateString()}
                  {member.assignedBy && ` · by ${member.assignedBy}`}
                </p>
              </div>
              <select
                value={member.role}
                onChange={(e) => changeRoleMut.mutate({ userId: member.userId, role: e.target.value })}
                className="rounded-lg border bg-background px-2 py-1 text-xs"
              >
                {ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>)}
              </select>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Remove ${member.userId}?`)) removeMut.mutate(member.userId); }}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
