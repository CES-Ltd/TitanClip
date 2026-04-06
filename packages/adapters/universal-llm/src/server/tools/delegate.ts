/**
 * Delegate to Agent Tool — allows one agent to spawn work for another agent.
 *
 * Creates an issue assigned to the target agent and optionally wakes them.
 * This enables multi-agent coordination within the tool loop.
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const delegateToAgentTool: RegisteredTool = {
  definition: {
    name: "delegate_to_agent",
    description: "Delegate a task to another agent. Creates an issue assigned to the target agent and wakes them to work on it. Use this when a task requires a different agent's expertise.",
    parameters: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description: "Name of the agent to delegate to (e.g., 'backend-engineer', 'research-agent')",
        },
        taskTitle: {
          type: "string",
          description: "Short title for the delegated task",
        },
        taskDescription: {
          type: "string",
          description: "Detailed instructions for the delegated agent",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Task priority (default: medium)",
        },
      },
      required: ["agentName", "taskTitle", "taskDescription"],
    },
    destructive: false,
    readOnly: false,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params): Promise<ToolResult> => {
    // In the tool loop, this tool is invoked but the actual issue creation
    // requires database access which happens at the adapter host level.
    // Return a structured response that the host can parse and act on.
    return {
      content: JSON.stringify({
        action: "delegate_to_agent",
        agentName: params.agentName,
        taskTitle: params.taskTitle,
        taskDescription: params.taskDescription,
        priority: params.priority ?? "medium",
        status: "delegation_requested",
        message: `Delegation request created: "${params.taskTitle}" for agent "${params.agentName}". The orchestration layer will create the issue and wake the target agent.`,
      }),
      success: true,
    };
  },
};
