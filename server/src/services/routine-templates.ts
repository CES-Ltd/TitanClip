/**
 * Routine Templates — pre-built scheduled task templates for Agent OS.
 */

export interface RoutineTemplate {
  slug: string;
  title: string;
  description: string;
  category: "reports" | "maintenance" | "analysis";
  defaultCron: string;
  defaultTimezone: string;
  variables: Array<{
    name: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    defaultValue?: string;
    options?: string[];
    required: boolean;
  }>;
  issueTemplate: {
    title: string;
    description: string;
    priority: string;
  };
}

export const BUILT_IN_TEMPLATES: RoutineTemplate[] = [
  {
    slug: "daily_digest",
    title: "Daily Digest",
    description: "Summarize all agent activity, open issues, and costs from the last 24 hours",
    category: "reports",
    defaultCron: "0 9 * * 1-5", // 9am weekdays
    defaultTimezone: "America/New_York",
    variables: [
      { name: "includeAgentDetails", label: "Include agent details", type: "boolean", defaultValue: "true", required: false },
      { name: "includeCosts", label: "Include cost summary", type: "boolean", defaultValue: "true", required: false },
    ],
    issueTemplate: {
      title: "Daily Digest - {{date}}",
      description: "Generate a summary of all activity from the past 24 hours. Include:\n- Active agents and their status\n- Issues completed, created, and in progress\n- Cost breakdown by agent\n- Any errors or alerts",
      priority: "low",
    },
  },
  {
    slug: "project_status",
    title: "Project Status Report",
    description: "Generate a status report for a specific project",
    category: "reports",
    defaultCron: "0 17 * * 5", // 5pm Fridays
    defaultTimezone: "America/New_York",
    variables: [
      { name: "projectId", label: "Project", type: "text", required: true },
      { name: "format", label: "Report format", type: "select", options: ["summary", "detailed", "executive"], defaultValue: "summary", required: false },
    ],
    issueTemplate: {
      title: "Project Status Report - {{date}}",
      description: "Generate a project status report. Include:\n- Progress against goals\n- Open issues and blockers\n- Agent performance on this project\n- Upcoming milestones",
      priority: "low",
    },
  },
  {
    slug: "cost_summary",
    title: "Weekly Cost Summary",
    description: "Weekly breakdown of AI spending by agent, provider, and model",
    category: "reports",
    defaultCron: "0 10 * * 1", // 10am Mondays
    defaultTimezone: "America/New_York",
    variables: [
      { name: "period", label: "Period", type: "select", options: ["7d", "14d", "30d"], defaultValue: "7d", required: false },
    ],
    issueTemplate: {
      title: "Cost Summary - Week of {{date}}",
      description: "Generate a cost breakdown report:\n- Total spend this period\n- Cost by agent\n- Cost by provider and model\n- Budget utilization\n- Trends vs previous period",
      priority: "low",
    },
  },
  {
    slug: "memory_consolidation",
    title: "Memory Consolidation",
    description: "Review and consolidate agent memories — merge duplicates, prune low-importance entries",
    category: "maintenance",
    defaultCron: "0 3 * * 0", // 3am Sundays
    defaultTimezone: "America/New_York",
    variables: [
      { name: "minImportance", label: "Min importance to keep", type: "number", defaultValue: "3", required: false },
    ],
    issueTemplate: {
      title: "Memory Consolidation - {{date}}",
      description: "Review stored memories:\n- Merge duplicate or similar memories\n- Remove expired entries\n- Promote frequently-accessed memories\n- Update stale facts",
      priority: "low",
    },
  },
  {
    slug: "skill_review",
    title: "Skill Review",
    description: "Analyze skill effectiveness and generate improvement suggestions",
    category: "analysis",
    defaultCron: "0 10 * * 5", // 10am Fridays
    defaultTimezone: "America/New_York",
    variables: [],
    issueTemplate: {
      title: "Skill Review - {{date}}",
      description: "Review installed skills:\n- Effectiveness metrics (success rate, usage frequency)\n- Skills with declining performance\n- Proposed skill improvements\n- New skill candidates from recent patterns",
      priority: "low",
    },
  },
];

export function routineTemplateService() {
  return {
    list() {
      return BUILT_IN_TEMPLATES;
    },

    getBySlug(slug: string) {
      return BUILT_IN_TEMPLATES.find((t) => t.slug === slug) ?? null;
    },

    /**
     * Instantiate a template into routine creation input.
     */
    instantiate(slug: string, overrides?: {
      cron?: string;
      timezone?: string;
      variableDefaults?: Record<string, string>;
    }) {
      const template = this.getBySlug(slug);
      if (!template) throw new Error(`Unknown template: ${slug}`);

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];

      return {
        title: template.title,
        description: template.description,
        status: "active",
        concurrencyPolicy: "skip",
        catchUpPolicy: "skip",
        variables: template.variables.map((v) => ({
          ...v,
          defaultValue: overrides?.variableDefaults?.[v.name] ?? v.defaultValue,
        })),
        trigger: {
          kind: "schedule" as const,
          label: template.title,
          cronExpression: overrides?.cron ?? template.defaultCron,
          timezone: overrides?.timezone ?? template.defaultTimezone,
          enabled: true,
        },
        issueTemplate: {
          ...template.issueTemplate,
          title: template.issueTemplate.title.replace("{{date}}", dateStr),
        },
      };
    },
  };
}
