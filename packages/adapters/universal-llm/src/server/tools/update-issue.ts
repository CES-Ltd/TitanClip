/**
 * update_issue_status — update a TitanClip issue's status.
 * Destructive: changes issue state (gated by supervised mode).
 */

import type { RegisteredTool, ToolResult } from "./index.js";

const VALID_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled"];

export const updateIssueTool: RegisteredTool = {
  definition: {
    name: "update_issue_status",
    description: "Update the status of a TitanClip issue. Use this to transition tasks through workflow stages (todo → in_progress → in_review → done). Optionally add a comment explaining the status change.",
    parameters: {
      type: "object",
      properties: {
        issueIdentifier: { type: "string", description: "Issue identifier (e.g., 'DEL-3') or UUID" },
        status: { type: "string", enum: VALID_STATUSES, description: "New status for the issue" },
        comment: { type: "string", description: "Optional comment explaining the status change" },
      },
      required: ["issueIdentifier", "status"],
    },
    destructive: false,
    readOnly: false,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params): Promise<ToolResult> => {
    const issueIdentifier = (params.issueIdentifier as string)?.trim();
    const status = (params.status as string)?.trim();
    const comment = (params.comment as string)?.trim();

    if (!issueIdentifier) return { content: "Error: issueIdentifier is required", success: false };
    if (!VALID_STATUSES.includes(status)) return { content: `Error: invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}`, success: false };

    return {
      content: JSON.stringify({
        action: "update_issue_status",
        issueIdentifier,
        status,
        comment: comment || null,
        message: `Issue ${issueIdentifier} status update requested to "${status}"`,
      }),
      success: true,
    };
  },
};
