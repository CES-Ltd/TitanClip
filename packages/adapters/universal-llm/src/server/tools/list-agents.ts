/**
 * list_team_agents — list all agents on the team with their status and workload.
 * Read-only: helps agents understand team capacity before delegating.
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const listAgentsTool: RegisteredTool = {
  definition: {
    name: "list_team_agents",
    description: "List all agents on the team with their name, role, status, and current task count. Use this to check team capacity and availability before delegating tasks or hiring new agents.",
    parameters: {
      type: "object",
      properties: {},
    },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (): Promise<ToolResult> => {
    return {
      content: JSON.stringify({
        action: "list_team_agents",
        message: "Fetching team agent list...",
      }),
      success: true,
    };
  },
};
