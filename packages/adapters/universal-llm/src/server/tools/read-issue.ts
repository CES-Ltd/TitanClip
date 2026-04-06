/**
 * read_issue — fetch full details of a TitanClip issue.
 * Read-only: returns issue data without side effects.
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const readIssueTool: RegisteredTool = {
  definition: {
    name: "read_issue",
    description: "Fetch full details of a TitanClip issue including title, description, status, priority, assignee, and recent comments. Use this to understand task context before working on it.",
    parameters: {
      type: "object",
      properties: {
        issueIdentifier: { type: "string", description: "Issue identifier (e.g., 'DEL-3') or UUID" },
      },
      required: ["issueIdentifier"],
    },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params): Promise<ToolResult> => {
    const issueIdentifier = (params.issueIdentifier as string)?.trim();
    if (!issueIdentifier) return { content: "Error: issueIdentifier is required", success: false };

    return {
      content: JSON.stringify({
        action: "read_issue",
        issueIdentifier,
        message: `Fetching details for issue ${issueIdentifier}...`,
      }),
      success: true,
    };
  },
};
