import {
  Inbox,
  CircleDot,
  Target,
  Gamepad2,
  LayoutDashboard,
  KeyRound,
  Shield,
  MessageSquare,
  Terminal,
  Users,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  Settings,
  BarChart3,
  Timer,
  ShieldAlert,
  GitBranch,
  Crosshair,
  TrendingUp,
  UserPlus,
  Store,
  Bot,
  Brain,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const agentOsEnabled = experimentalSettings?.enableAgentOs === true;
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name (bold) + Search — aligned with top sections (no visible border) */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        {selectedCompany?.brandColor && (
          <div
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span className="flex-1 text-sm font-bold text-foreground truncate pl-1">
          {selectedCompany?.name ?? "Select company"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* New Issue button aligned with nav items */}
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">New Issue</span>
          </button>
          <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem to="/agent-gallery" label="Agent Gallery" icon={Store} />
          <SidebarNavItem to="/workplace" label="Workplace" icon={Gamepad2} />
          <SidebarNavItem to="/chat" label="Command Center" icon={Terminal} />
          <SidebarNavItem
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label="Work">
          <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />
          <SidebarNavItem to="/chatter" label="Chatter" icon={MessageSquare} />
          <SidebarNavItem to="/workflows" label="Workflows" icon={GitBranch} />
          <SidebarNavItem to="/routines" label="Routines" icon={Repeat} textBadge="Beta" textBadgeTone="amber" />
          <SidebarNavItem to="/goals" label="Goals" icon={Target} />
        </SidebarSection>

        <SidebarProjects />

        <SidebarAgents />

        <SidebarSection label="Team">
          <SidebarNavItem to="/org" label="Org" icon={Network} />
          <SidebarNavItem to="/skills" label="Skills" icon={Boxes} />
          <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
          <SidebarNavItem to="/skill-routing" label="Skill Routing" icon={Crosshair} />
          <SidebarNavItem to="/performance" label="Performance" icon={BarChart3} />
          <SidebarNavItem to="/analytics" label="Analytics" icon={TrendingUp} />
          <SidebarNavItem to="/lifecycle" label="Lifecycle" icon={UserPlus} />
          <SidebarNavItem to="/sla" label="SLA" icon={Timer} />
          <SidebarNavItem to="/escalation" label="Escalation" icon={ShieldAlert} />
          <SidebarNavItem to="/activity" label="Activity" icon={History} />
          <SidebarNavItem to="/members" label="Access" icon={Shield} />
          <SidebarNavItem to="/vault" label="Vault" icon={KeyRound} />
          <SidebarNavItem to="/credentials" label="My Credentials" icon={KeyRound} />
          <SidebarNavItem to="/compliance" label="Compliance" icon={Shield} />
          <SidebarNavItem to="/chargeback" label="Chargeback" icon={DollarSign} />
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        {agentOsEnabled && (
          <SidebarSection label={<span className="flex items-center gap-1.5">Agent OS <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">Beta</span></span>}>
            <SidebarNavItem to="/agent-os" label="Hub" icon={Bot} />
            <SidebarNavItem to="/agent-os/chat" label="Chat" icon={MessageSquare} />
            <SidebarNavItem to="/agent-os/memory" label="Memory" icon={Brain} />
            <SidebarNavItem to="/agent-os/conversations" label="History" icon={History} />
            <SidebarNavItem to="/agent-os/skills" label="Skill Proposals" icon={Sparkles} />
            <SidebarNavItem to="/agent-os/settings" label="LLM Settings" icon={Settings} />
          </SidebarSection>
        )}

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
