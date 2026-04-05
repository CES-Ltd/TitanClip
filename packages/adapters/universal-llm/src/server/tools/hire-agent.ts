/**
 * Hire Agent Tool — autonomously hire agents from available templates.
 *
 * When the main agent determines it needs help (e.g., "I need a QA engineer"),
 * it calls this tool to hire from the template gallery. The actual agent creation
 * is handled by the chat route's post-execution processor, which:
 * - Resolves the template by name
 * - Creates the agent via the standard hire flow (respects approval policy)
 * - Logs the hire reason in the activity audit trail
 *
 * Guard rails:
 * - Destructive: true — blocked in sandboxed + supervised modes
 * - Max 3 autonomous hires per agent per day (enforced by chat route)
 * - Respects company.requireBoardApprovalForNewAgents policy
 */

import type { RegisteredTool, ToolResult } from "./index.js";

export const hireAgentTool: RegisteredTool = {
  definition: {
    name: "hire_agent",
    description:
      "Hire a new agent from available templates to join the team. " +
      "Use this when the current task requires expertise that no existing agent on the team has. " +
      "Available templates include roles like: Tech Lead, DevOps Engineer, QA Engineer, " +
      "Backend Engineer, Frontend Engineer, Security Analyst, Data Engineer, etc. " +
      "You MUST provide a clear reason for why this hire is needed — it will be logged in the audit trail.",
    parameters: {
      type: "object",
      properties: {
        templateName: {
          type: "string",
          description:
            "Name of the agent template to hire from (e.g., 'QA Engineer', 'DevOps Engineer', 'Tech Lead'). " +
            "Must match an available template name.",
        },
        reason: {
          type: "string",
          description:
            "Clear explanation of WHY this agent is needed. This is logged in the audit trail. " +
            "Example: 'Need a QA engineer to write and run test suites for the new authentication module.'",
        },
        budgetMonthlyCents: {
          type: "number",
          description:
            "Optional monthly budget override in cents (e.g., 5000 = $50.00/month). " +
            "If not specified, uses the template's default budget.",
        },
        reportsTo: {
          type: "string",
          description:
            "Optional: name of the agent this new hire should report to in the org chart. " +
            "If not specified, reports to no one (top-level).",
        },
      },
      required: ["templateName", "reason"],
    },
    destructive: true,
  },
  handler: async (params): Promise<ToolResult> => {
    // The tool handler returns a structured request — actual hiring is done
    // by the chat route's post-execution processor (server-side, with DB access).
    const templateName = params.templateName as string;
    const reason = params.reason as string;
    const budgetMonthlyCents = params.budgetMonthlyCents as number | undefined;
    const reportsTo = params.reportsTo as string | undefined;

    if (!templateName?.trim()) {
      return { content: "Error: templateName is required", success: false, error: "Missing templateName" };
    }
    if (!reason?.trim()) {
      return { content: "Error: reason is required for audit trail", success: false, error: "Missing reason" };
    }

    return {
      content: JSON.stringify({
        action: "hire_agent",
        templateName: templateName.trim(),
        reason: reason.trim(),
        budgetMonthlyCents: budgetMonthlyCents ?? null,
        reportsTo: reportsTo?.trim() ?? null,
        status: "hire_requested",
        message: `Hiring request submitted: "${templateName}" agent. Reason: ${reason}. The orchestration layer will create the agent from the matching template.`,
      }),
      success: true,
    };
  },
};
