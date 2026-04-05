/**
 * IPC Live Updates Provider — replaces WebSocket-based LiveUpdatesProvider.
 *
 * Instead of opening a WebSocket to ws://127.0.0.1:3100/api/live,
 * this listens for "live:event" IPC push events from the main process.
 *
 * Benefits:
 * - No WebSocket connection management (connect, reconnect, heartbeat)
 * - No authentication headers needed (IPC is inherently trusted)
 * - Lower latency (no serialization to HTTP wire format)
 * - No port conflicts
 *
 * The provider integrates with React Query to invalidate caches when
 * relevant events arrive, mirroring what LiveUpdatesProvider does with
 * WebSocket messages.
 */

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LiveEvent } from "@titanclip/shared";
import { useCompany } from "./CompanyContext";
import { useToast } from "./ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { isElectron } from "../api/ipc-client";

export function IpcLiveUpdatesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { pushToast } = useToast();

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onLiveEvent) return;

    const companyId = selectedCompany?.id;
    if (!companyId) return;

    const unsubscribe = window.electronAPI.onLiveEvent((event: LiveEvent) => {
      // Filter to selected company
      if ((event as any).companyId && (event as any).companyId !== companyId) return;

      const payload = (event as any).data ?? event;

      // Route by event type — mirror LiveUpdatesProvider's logic
      if (event.type === "heartbeat.run.log") {
        // High-frequency log events — skip (same as original)
        return;
      }

      if (event.type === "heartbeat.run.queued" || event.type === "heartbeat.run.status") {
        queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });

        if (event.type === "heartbeat.run.status") {
          const runId = payload?.runId;
          if (runId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.runDetail(runId) });
          }
          // Invalidate issue-level queries if issueId present
          const issueId = payload?.issueId;
          if (issueId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(issueId) });
          }
        }
        return;
      }

      if (event.type === "heartbeat.run.event") {
        // Heartbeat run sub-events — skip
        return;
      }

      if (event.type === "agent.status") {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
        const agentId = payload?.agentId;
        if (agentId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
        }
        return;
      }

      if (event.type === "activity.logged") {
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(companyId) });
        return;
      }

      if (event.type === "plugin.ui.updated") {
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.uiContributions });
        return;
      }

      if (event.type === "plugin.worker.crashed" || event.type === "plugin.worker.restarted") {
        const pluginId = payload?.pluginId;
        if (pluginId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.plugins.detail(pluginId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.plugins.health(pluginId) });
        }
        return;
      }

      // Fallback: invalidate dashboard + sidebar badges for any other event
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(companyId) });
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, selectedCompany, pushToast]);

  return <>{children}</>;
}
