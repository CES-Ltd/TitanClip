export type TeamRoleLevel = "instance_admin" | "team_admin" | "member" | "viewer";

export interface TeamRole {
  id: string;
  companyId: string;
  userId: string;
  role: TeamRoleLevel;
  assignedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TEAM_ROLE_LABELS: Record<TeamRoleLevel, string> = {
  instance_admin: "Instance Admin",
  team_admin: "Team Admin",
  member: "Member",
  viewer: "Viewer",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRoleLevel, string> = {
  instance_admin: "Full control over all teams and instance settings",
  team_admin: "Full control within this team, no instance settings",
  member: "Create agents from templates, manage tasks, view runs",
  viewer: "Read-only access to dashboards, runs, and costs",
};
