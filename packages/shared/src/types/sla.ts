export type SlaPriority = "critical" | "high" | "medium" | "low";
export type SlaBreachAction = "notify" | "escalate" | "reassign" | "pause_agent";
export type SlaStatus = "on_track" | "at_risk" | "breached";
export type SlaClockState = "running" | "paused" | "completed" | "breached";

export interface SlaPolicy {
  id: string;
  companyId: string;
  name: string;
  description: string;
  priority: SlaPriority;
  targetResponseMinutes: number;
  targetResolutionMinutes: number;
  breachAction: SlaBreachAction;
  escalateToAgentId: string | null;
  notifyUserIds: string[];
  isDefault: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SlaTracking {
  id: string;
  companyId: string;
  issueId: string;
  policyId: string;
  policyName: string;
  status: SlaClockState;
  // Timing
  clockStartedAt: string;
  clockPausedAt: string | null;
  totalPausedMinutes: number;
  responseDeadline: string;
  resolutionDeadline: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  // Breach info
  responseBreached: boolean;
  resolutionBreached: boolean;
  breachNotifiedAt: string | null;
  breachActionTaken: string | null;
  // Issue context
  issueTitle: string | null;
  issuePriority: string | null;
  assigneeAgentId: string | null;
  assigneeAgentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EscalationTrigger = "sla_breach" | "error_count" | "idle_time" | "consecutive_failures";
export type EscalationAction = "notify" | "reassign" | "escalate_to_manager" | "pause_agent" | "restart_agent";

export interface EscalationRule {
  id: string;
  companyId: string;
  name: string;
  description: string;
  trigger: EscalationTrigger;
  triggerThreshold: number; // e.g., 3 for error_count, 60 for idle_time (minutes)
  action: EscalationAction;
  targetAgentId: string | null; // for reassign/escalate
  notifyUserIds: string[];
  cooldownMinutes: number; // min time between firings
  enabled: boolean;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlaDashboardSummary {
  totalTracked: number;
  onTrack: number;
  atRisk: number;
  breached: number;
  complianceRate: number; // 0-100
  avgResponseMinutes: number;
  avgResolutionMinutes: number;
  activeBreaches: SlaTracking[];
}
