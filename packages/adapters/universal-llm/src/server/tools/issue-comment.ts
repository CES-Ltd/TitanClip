/**
 * add_issue_comment — add a progress comment to a TitanClip issue.
 * Non-destructive: appends information without changing state.
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const issueCommentTool: RegisteredTool = {
  definition: {
    name: "add_issue_comment",
    description: "Add a comment to a TitanClip issue. Use this to report progress, blockers, findings, or task completion notes. Comments are visible on the issue detail page.",
    parameters: {
      type: "object",
      properties: {
        issueIdentifier: { type: "string", description: "Issue identifier (e.g., 'DEL-3') or UUID" },
        body: { type: "string", description: "Comment text (supports markdown)" },
      },
      required: ["issueIdentifier", "body"],
    },
    destructive: false,
    readOnly: false,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params): Promise<ToolResult> => {
    const issueIdentifier = (params.issueIdentifier as string)?.trim();
    const body = (params.body as string)?.trim();

    if (!issueIdentifier) return { content: "Error: issueIdentifier is required", success: false };
    if (!body) return { content: "Error: comment body is required", success: false };

    return {
      content: JSON.stringify({
        action: "add_issue_comment",
        issueIdentifier,
        body,
        message: `Comment added to ${issueIdentifier}`,
      }),
      success: true,
    };
  },
};
