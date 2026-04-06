/**
 * post_to_chatter — post a message to the team chatter channel.
 * Allows agents to proactively communicate with the team.
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const postChatterTool: RegisteredTool = {
  definition: {
    name: "post_to_chatter",
    description: "Post a message to the team chatter channel for team-wide communication. Use this for status updates, announcements, questions to the team, or progress reports. Messages are visible to all team members and agents.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to post (supports markdown)" },
        channel: { type: "string", description: "Channel name (default: 'general'). Use 'agent-activity' for tool/task updates." },
      },
      required: ["message"],
    },
    destructive: false,
    readOnly: false,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params): Promise<ToolResult> => {
    const message = (params.message as string)?.trim();
    const channel = (params.channel as string)?.trim() || "general";

    if (!message) return { content: "Error: message is required", success: false };

    return {
      content: JSON.stringify({
        action: "post_to_chatter",
        message,
        channel,
        status: "posted",
      }),
      success: true,
    };
  },
};
