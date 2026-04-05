export interface HelpTopic {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
}

export const HELP_CATEGORIES = [
  "Getting Started",
  "Dashboard & Navigation",
  "Agent Management",
  "Performance Intelligence",
  "Enterprise Security",
  "Credential Vault",
  "Task Management",
  "Dependencies & Workflows",
  "SLA Management",
  "Cost & Budgets",
  "Compliance & Audit",
  "Workspace Governance",
  "Team Settings",
] as const;

export const HELP_TOPICS: HelpTopic[] = [
  // --- Getting Started ---
  {
    id: "overview",
    title: "Overview",
    category: "Getting Started",
    keywords: ["introduction", "what is", "about", "features", "start"],
    content: `TitanClip is an enterprise AI agent orchestration platform built as an Electron desktop application. It manages teams of AI agents with org charts, budgets, governance, and accountability.

**Key Capabilities:**
- Create and manage AI agents with configurable adapters (Claude, Codex, Gemini, Cursor, etc.)
- Agent performance intelligence with health scores, leaderboards, and utilization metrics
- SLA management with automated breach detection and escalation rules
- Task dependencies and workflow pipelines with critical path analysis
- Enterprise security with admin PIN/SSO, permission policies, and agent-centric RBAC
- Credential vault with timed token checkout for secure runtime access
- Cost tracking with chargeback reports and cloud cost estimation
- Compliance dashboard with audit trails and data retention policies
- Gamified workplace with pixel-art office view of your agents
- Gmail-style inbox for task management and approvals

TitanClip runs entirely on your machine with an embedded PostgreSQL database. All secrets are encrypted with AES-256-GCM.`,
  },
  {
    id: "first-team",
    title: "Creating Your First Team",
    category: "Getting Started",
    keywords: ["team", "company", "create", "setup", "onboarding"],
    content: `When you first launch TitanClip, you'll be guided through creating your first team.

**Steps:**
1. Click "New Team" on the welcome screen
2. Enter a team name (this is the organization your agents will work for)
3. Optionally set a team goal or mission
4. Your team is created with an embedded PostgreSQL database

Teams are isolated units — each team has its own agents, tasks, budgets, and credentials. You can create multiple teams from the company rail on the left sidebar.`,
  },
  {
    id: "first-agent",
    title: "Creating Your First Agent",
    category: "Getting Started",
    keywords: ["agent", "create", "hire", "new", "template", "adapter"],
    content: `Agents are AI employees that work on tasks within your team.

**Creating an agent:**
1. Click the "+" icon in the Agents section of the sidebar, or go to Agents → New Agent
2. If agent templates are configured, select one from the dropdown — this pre-fills role and instructions
3. Choose an adapter (Claude, Codex, Gemini, etc.) from the enabled list
4. Select a model from the available models
5. Optionally assign a permission policy
6. Give your agent a name and click "Create"

The first agent in a team is automatically assigned the Business Unit Head role. Subsequent agents can have any role allowed by admin policy.`,
  },
  {
    id: "first-task",
    title: "Your First Task",
    category: "Getting Started",
    keywords: ["task", "issue", "create", "assign", "work"],
    content: `Tasks (also called issues) are units of work assigned to agents.

**Creating a task:**
1. Click "New Issue" in the sidebar or use the quick action in Command Center
2. Enter a title and description
3. Set priority (critical, high, medium, low)
4. Assign to an agent
5. The agent will pick up the task during its next heartbeat

Tasks follow a lifecycle: Backlog → Todo → In Progress → In Review → Done. You can track progress in the Inbox, Command Center, or the gamified Workplace.`,
  },

  // --- Dashboard & Navigation ---
  {
    id: "dashboard",
    title: "Dashboard",
    category: "Dashboard & Navigation",
    keywords: ["dashboard", "metrics", "overview", "charts", "stats"],
    content: `The Dashboard provides a high-level overview of your team's activity.

**Sections:**
- **Metric Cards**: Active agents, tasks in progress, monthly spend, pending approvals
- **Charts**: Run activity (14-day), issue priority distribution, status distribution, success rate
- **Recent Activity**: Latest events with timestamps
- **Recent Tasks**: Most recently updated issues

The dashboard auto-refreshes and reflects real-time changes from agent runs.`,
  },
  {
    id: "command-center",
    title: "Command Center",
    category: "Dashboard & Navigation",
    keywords: ["command center", "operations", "iam", "observability", "live", "monitor"],
    content: `The Command Center is your mission control for agent observability. It has two views:

**Operations Tab:**
- Agent Status Grid: all agents with status dots, role badges, health score badges, and wake button
- Live Runs: active/queued heartbeat runs with timing
- Run Stats: total, succeeded, and failed run counters
- Active Tasks: in-progress and todo issues
- Pending Approvals: inline approve/reject action cards
- Activity Feed: recent events with color-coded icons
- Cost Ticker: monthly spend vs budget with utilization bar
- SLA Compliance: compliance rate bar with on-track/at-risk/breached counts
- Budget Health: incident warnings

**IAM Tab:**
- Credential Vault inventory with status and checkout counts
- Active token checkouts with TTL remaining
- Token activity audit trail`,
  },
  {
    id: "workplace",
    title: "Workplace (Gamified)",
    category: "Dashboard & Navigation",
    keywords: ["workplace", "game", "pixel", "office", "sprites", "walk", "phaser"],
    content: `The Workplace is a retro pixel-art office where you can see your agents as characters.

**Features:**
- Walk around as the "Boss" character using WASD or arrow keys
- Agent sprites represent your team members, colored by role
- Status tags show each agent's state (IDLE, WORKING, THINKING, ERROR, PAUSED)
- Walk near an agent and press E to interact — opens RPG-style task assignment menu
- Thought bubbles appear when agents change state
- Sparkle particles celebrate task completion
- HUD shows agent count, working/idle stats, and controls

Agents wander the office when idle and walk to their desks when working.`,
  },
  {
    id: "inbox",
    title: "Inbox",
    category: "Dashboard & Navigation",
    keywords: ["inbox", "gmail", "mail", "tasks", "approvals", "read", "unread"],
    content: `The Inbox provides a Gmail-style 2-pane view for managing tasks, approvals, and run failures.

**Tabs:**
- **Primary**: Issues you've touched or are assigned to
- **Approvals**: Pending approval requests with inline approve/reject
- **Runs**: Failed heartbeat runs with error details
- **All**: Everything combined

**Features:**
- Click an item in the left pane to preview in the right pane
- Unread items show a blue dot and bold title
- Priority color bars on the left edge (red=critical, orange=high, blue=medium)
- Archive items to remove from inbox
- Search bar filters by title
- "Open Full" button navigates to the full detail page`,
  },

  // --- Agent Management ---
  {
    id: "agent-templates",
    title: "Agent Templates",
    category: "Agent Management",
    keywords: ["template", "blueprint", "admin", "configure", "soul", "heartbeat", "instructions"],
    content: `Agent templates are pre-configured blueprints that define an agent's role, instructions, and behavior.

**Creating a template (Admin only):**
1. Go to Instance Settings → Admin → unlock with PIN
2. Scroll to "Agent Templates" section
3. Click "Create Template"
4. Fill in: name, role, description, permission policy
5. Write SOUL.md (persona), HEARTBEAT.md (periodic tasks), AGENTS.md (instructions)
6. Set status to "Draft" or "Available"
7. Click "Publish" to make it available for agent creation

Templates do not include adapter or model — those are selected by the user during agent creation from the admin-allowed list.`,
  },
  {
    id: "adapters-models",
    title: "Adapters & Models",
    category: "Agent Management",
    keywords: ["adapter", "model", "claude", "codex", "gemini", "cursor", "configure", "enable"],
    content: `Adapters connect agents to AI model providers. Models are the specific AI models within each adapter.

**Available Adapters:**
- Claude (Anthropic), Codex (OpenAI), Gemini (Google), Cursor, OpenCode, Pi, Hermes, OpenClaw

**Admin Configuration:**
1. Go to Instance Settings → Admin → Adapters & Models
2. Left pane: toggle adapters on/off
3. Click an adapter to see its models in the right pane
4. Check/uncheck models to allow or restrict

Only enabled adapters and models appear in the agent creation dropdown. Disabled ones are completely hidden.`,
  },
  {
    id: "agent-monitoring",
    title: "Agent Status & Monitoring",
    category: "Agent Management",
    keywords: ["status", "monitor", "running", "paused", "error", "heartbeat", "run"],
    content: `Agent status indicates what the agent is currently doing:

- **Active/Idle**: Ready but not currently running
- **Running**: Executing a task via heartbeat
- **Paused**: Manually paused or budget-paused
- **Error**: Last run failed
- **Pending Approval**: Waiting for hire approval

**Monitoring locations:**
- Command Center → Agent Status Grid (real-time, with health score badges)
- Performance Dashboard → Leaderboard with health scores, utilization, and efficiency
- Workplace → Visual sprites with status tags
- Agent Detail page → Full run history, logs, config
- Agents list → Status indicators with health score badges
- Sidebar → Agent list with status indicators`,
  },

  // --- Performance Intelligence ---
  {
    id: "performance-dashboard",
    title: "Performance Dashboard",
    category: "Performance Intelligence",
    keywords: ["performance", "metrics", "leaderboard", "health", "score", "efficiency"],
    content: `The Performance Dashboard (Team → Performance) provides a comprehensive view of agent effectiveness.

**Summary Cards:**
- Average Health Score across all agents
- Tasks Completed vs Total Assigned with completion rate
- Total Runs with failure count
- Total Cost for the selected time range

**Agent Leaderboard:**
- Sortable table ranked by health score (default)
- Columns: Agent, Health, Completion Rate, Error Rate, Utilization, Token Efficiency, Cost
- Click any column header to sort ascending or descending
- Click a row to expand detailed breakdown

**Time Range:** Switch between 7-day, 30-day, and 90-day views using the buttons in the header.

**Alerts:** Agents with health score below 50 or error rate above 30% are flagged in an attention panel at the bottom.`,
  },
  {
    id: "health-score",
    title: "Agent Health Score",
    category: "Performance Intelligence",
    keywords: ["health", "score", "composite", "weight", "formula"],
    content: `Each agent receives a 0-100 health score based on four weighted factors:

**Formula:**
- Task Completion Rate: 30% weight (completed / assigned tasks)
- Low Error Rate: 30% weight (100 - error percentage)
- Utilization: 20% weight (working time vs idle time)
- First-Time Success Rate: 20% weight (successful runs / total runs)

**Color coding:**
- Green (80-100): Healthy
- Amber (60-79): Needs attention
- Orange (40-59): Underperforming
- Red (0-39): Critical

Health badges appear on agent rows in the Agents list, Command Center agent grid, and the Performance Dashboard leaderboard.`,
  },
  {
    id: "performance-metrics",
    title: "Performance Metrics Explained",
    category: "Performance Intelligence",
    keywords: ["metrics", "completion", "error", "utilization", "token", "efficiency"],
    content: `Detailed explanation of each performance metric:

**Task Completion Rate:** Percentage of assigned tasks marked as done. Higher is better.

**Average Task Duration:** Mean time from task start to completion in minutes.

**Error Rate:** Percentage of heartbeat runs that failed or timed out. Lower is better.

**First-Time Success Rate:** Percentage of runs that succeeded without retries.

**Token Efficiency:** Number of tasks completed per million tokens consumed. Higher means the agent accomplishes more with fewer tokens.

**Utilization:** Estimated percentage of available time spent actively working. Based on run frequency relative to the time window.

**Expanded Detail:** Click any agent row to see full breakdown of tasks, runs, token usage (input/output), status, last active time, and health score component weights.`,
  },

  // --- Enterprise Security ---
  {
    id: "admin-pin",
    title: "Admin PIN & SSO",
    category: "Enterprise Security",
    keywords: ["pin", "admin", "lock", "unlock", "sso", "security", "authentication"],
    content: `Admin settings are protected by a PIN (default: 1234) that can be changed.

**Using the PIN:**
1. Navigate to any admin-gated page (Admin, Policies, Workspaces)
2. Click "Unlock"
3. Enter your PIN (sent as SHA-256 hash, never plaintext)
4. Session auto-locks after 30 minutes

**Changing the PIN:**
1. Unlock admin settings
2. Scroll to "Change Admin PIN"
3. Enter current PIN, new PIN, and confirm
4. Click "Change PIN"

**SSO Mode:** When TITANCLIP_SSO_CLIENT_ID is configured, PIN is replaced by Microsoft SSO. Change PIN option is hidden in SSO mode.`,
  },
  {
    id: "permission-policies",
    title: "Permission Policies",
    category: "Enterprise Security",
    keywords: ["policy", "permission", "access", "create", "vault", "agents", "restrict"],
    content: `Permission policies define what agents can and cannot do.

**Available permissions:**
- Create Tasks, Update Tasks, Delete Tasks
- Create Agents
- Manage Secrets, Access Vault
- Approve Requests
- Max concurrent runs, max run duration

**Creating a policy:**
1. Go to Instance Settings → Policies
2. Click "New Policy"
3. Name it (e.g., "Engineer Standard")
4. Toggle permissions on/off
5. Set execution limits

**Assigning to agents:**
- Link policies to agent templates in Admin Settings
- Or assign directly on the Agent Access page`,
  },
  {
    id: "agent-rbac",
    title: "Agent Access Control (RBAC)",
    category: "Enterprise Security",
    keywords: ["rbac", "access", "role", "control", "policy", "assign"],
    content: `TitanClip uses agent-centric RBAC — roles and policies control what agents can do, not users.

**How it works:**
1. Admin creates permission policies with specific permissions
2. Policies are linked to agent templates
3. When an agent is created from a template, it inherits the policy
4. Policies are enforced at runtime (vault access, issue operations, run limits)

**Agent Access page** (Team → Access):
- Shows all agents with their assigned policies
- Inline dropdown to change an agent's policy
- Permission indicators (checkmarks for allowed operations)

Agents without a policy have full access (no restrictions).`,
  },

  // --- Credential Vault ---
  {
    id: "vault-overview",
    title: "Credential Vault Overview",
    category: "Credential Vault",
    keywords: ["vault", "credential", "secret", "key", "token", "encrypt"],
    content: `The Credential Vault securely stores API keys, tokens, and secrets for agent runtime access.

**Key features:**
- AES-256-GCM encryption at rest
- Agents receive timed tokens, never raw secrets
- Scoping by agent ID and role
- Rotation support with version history
- Checkout audit trail

Navigate to Team → Vault to manage credentials.`,
  },
  {
    id: "vault-add",
    title: "Adding Credentials",
    category: "Credential Vault",
    keywords: ["add", "create", "credential", "github", "aws", "token", "api key"],
    content: `**Adding a credential:**
1. Go to Team → Vault
2. Click "Add Credential"
3. Enter name (e.g., "GitHub Deploy Key")
4. Set environment variable name (e.g., GITHUB_TOKEN) — auto-uppercased
5. Select provider (GitHub, AWS, GCP, Azure, NPM, Docker, Custom)
6. Select credential type (API Key, SSH Key, OAuth Token, etc.)
7. Enter the secret value (masked with show/hide toggle)
8. Set Token TTL (how long timed tokens last, default 1 hour)
9. Set max concurrent checkouts
10. Choose rotation policy (manual or auto)
11. Click "Add to Vault"

The secret is encrypted immediately and stored securely.`,
  },
  {
    id: "vault-tokens",
    title: "Timed Token Checkout",
    category: "Credential Vault",
    keywords: ["token", "checkout", "timed", "ttl", "runtime", "agent"],
    content: `When an agent needs a credential at runtime, it receives a timed token instead of the raw secret.

**How it works:**
1. Agent run starts
2. Server checks: Is the agent allowed? Is the credential active? Not expired?
3. Decrypts the secret and issues a timed token with TTL
4. Token injected as an environment variable for the agent process
5. On run completion, token is checked in (marked as returned)
6. Expired tokens are logged in the audit trail

**IAM Observability** (Command Center → IAM tab):
- Active checkouts with TTL countdown
- Token activity feed (checkout/checkin/expiry events)
- Credential inventory with usage counts`,
  },
  {
    id: "vault-rotation",
    title: "Rotation & Expiry",
    category: "Credential Vault",
    keywords: ["rotate", "expiry", "renew", "revoke", "lifecycle"],
    content: `Credentials support rotation and expiry for security lifecycle management.

**Rotation:**
1. Click "Rotate" on a credential in the Vault page
2. Enter the new secret value
3. Click "Rotate" — creates a new encrypted version
4. Existing checked-out tokens remain valid until their TTL expires
5. New checkouts use the rotated value

**Revocation:**
- Click "Revoke" to permanently disable a credential
- All future checkouts are blocked
- Existing tokens remain valid until expiry

**Auto-rotation:** Set rotation policy to "auto" with an interval in days. The system will flag credentials due for rotation.`,
  },

  // --- Task Management ---
  {
    id: "tasks",
    title: "Creating Tasks",
    category: "Task Management",
    keywords: ["task", "issue", "create", "assign", "priority"],
    content: `Tasks are the core work units in TitanClip. Create them from multiple places:

- **Sidebar**: Click "New Issue"
- **Command Center**: "New Task" button in header
- **Workplace**: Walk to an agent, press E, assign from RPG menu
- **Inbox**: Tasks appear automatically from agent activity

Each task has: title, description, status, priority, assignee, project, labels.`,
  },
  {
    id: "task-lifecycle",
    title: "Task Lifecycle",
    category: "Task Management",
    keywords: ["lifecycle", "status", "backlog", "todo", "progress", "review", "done"],
    content: `Tasks follow a lifecycle through these statuses:

**Backlog** → **Todo** → **In Progress** → **In Review** → **Done**

- **Backlog**: Not yet prioritized
- **Todo**: Ready to be worked on
- **In Progress**: Agent is actively working (atomic checkout prevents double-work)
- **In Review**: Work completed, awaiting review
- **Done**: Completed
- **Blocked**: Cannot proceed (auto-set when a blocking dependency exists)
- **Cancelled**: Abandoned

Agents transition tasks automatically during heartbeat runs. When a blocking task completes, dependent tasks are auto-unblocked and moved to Todo.`,
  },
  {
    id: "approvals",
    title: "Approvals Workflow",
    category: "Task Management",
    keywords: ["approval", "approve", "reject", "hire", "pending"],
    content: `Approvals are governance gates that require human decision before proceeding.

**Approval types:**
- Hire Agent: When a new agent is created (if team requires approval)
- Business Unit Head Strategy: Strategic decisions by the lead agent

**Managing approvals:**
- Command Center → Pending Approvals section (inline approve/reject)
- Inbox → Approvals tab with detail view
- Notification toasts with "Command Center" action link

Approved agents become active. Rejected requests are logged in the audit trail.`,
  },

  // --- Dependencies & Workflows ---
  {
    id: "task-dependencies",
    title: "Task Dependencies",
    category: "Dependencies & Workflows",
    keywords: ["dependency", "block", "depends", "relates", "prerequisite", "link"],
    content: `Task dependencies model relationships between issues so work proceeds in the correct order.

**Dependency Types:**
- **Blocks**: Task A must complete before Task B can start. B is auto-set to "blocked" status.
- **Depends On**: Reverse of blocks — this task depends on another completing first.
- **Relates To**: Informational link with no blocking behavior.

**Adding Dependencies:**
1. Open any issue detail page
2. Find the "Dependencies" section below the description
3. Click the "+" icon
4. Select the relationship type (blocks / depends on / related to)
5. Search for the target issue by title or identifier
6. Click to add the dependency

**Auto-Block/Unblock:**
- When A blocks B and A is not done, B is automatically set to "blocked"
- When A completes, B is automatically unblocked and moved to "todo"
- Circular dependencies are prevented (A cannot block B if B already blocks A)

Dependencies show as colored groups: red for blocked-by, amber for blocks, blue for related. Click any linked issue to navigate to it.`,
  },
  {
    id: "workflow-templates",
    title: "Workflow Templates",
    category: "Dependencies & Workflows",
    keywords: ["workflow", "pipeline", "template", "multi-step", "automate", "sequential"],
    content: `Workflow templates define reusable multi-step pipelines that create linked issues with dependencies in one click.

**Creating a Workflow:**
1. Navigate to Work → Workflows
2. Click "New Workflow"
3. Enter a name (e.g., "Feature Development Pipeline")
4. Add steps — each step becomes an issue when executed
5. Set priority per step
6. Steps are automatically linked sequentially (step 2 depends on step 1, etc.)
7. Click "Create Workflow"

**Executing a Workflow:**
1. Click the green "Run" button on any template
2. Issues are created for each step with blocking dependencies
3. First step starts as "backlog", subsequent steps start as "blocked"
4. As each step completes, the next is auto-unblocked

**Example Pipelines:**
- Code → Tests → Review → Deploy
- Research → Design → Implement → QA
- Onboard Agent → Configure → Assign Training Tasks

Templates track usage count and can be enabled/disabled.`,
  },
  {
    id: "critical-path",
    title: "Critical Path Analysis",
    category: "Dependencies & Workflows",
    keywords: ["critical path", "bottleneck", "dag", "graph", "longest", "estimate"],
    content: `Critical path analysis identifies the longest chain of dependent tasks and estimates completion time.

**Accessing:**
Navigate to Work → Workflows → "Critical Path" tab.

**What it shows:**
- **Critical Path Length**: Number of sequential steps in the longest dependency chain
- **Estimated Completion**: Total estimated time based on task estimates (default 30 min per task)
- **Bottleneck**: The task that blocks the most other tasks

**Dependency Graph:**
- All tasks with dependencies are shown, indented by depth
- Critical path nodes are highlighted in red
- Status dots show current task state (done, blocked, in progress, backlog)
- Each node shows priority, assignee, and how many tasks it blocks or is blocked by

Use this view to identify which tasks to prioritize for fastest overall completion.`,
  },

  // --- SLA Management ---
  {
    id: "sla-overview",
    title: "SLA Management Overview",
    category: "SLA Management",
    keywords: ["sla", "service level", "agreement", "compliance", "breach", "deadline"],
    content: `SLA Management ensures tasks are completed within defined time targets with automated breach detection and response.

**Key Concepts:**
- **SLA Policy**: Defines target response and resolution times for a priority level
- **SLA Tracking**: Per-issue clock that starts on assignment and tracks deadlines
- **Breach**: When a deadline is missed, triggers the configured action
- **Compliance Rate**: Percentage of tracked issues that met their SLA

Navigate to Team → SLA to access the full management dashboard.`,
  },
  {
    id: "sla-policies",
    title: "SLA Policies",
    category: "SLA Management",
    keywords: ["policy", "create", "response", "resolution", "target", "default"],
    content: `SLA policies define time targets and breach actions for each priority level.

**Creating a Policy:**
1. Go to Team → SLA → Policies tab
2. Click "New Policy"
3. Configure:
   - Name (e.g., "Critical Response SLA")
   - Priority scope (critical, high, medium, low)
   - Target Response Time (minutes until first response)
   - Target Resolution Time (minutes until issue is resolved)
   - Breach Action: Notify, Escalate, Reassign Task, or Pause Agent
4. Check "Default for priority" to auto-attach to new issues of that priority
5. Click "Create Policy"

**Default Policies:** When an issue is assigned with a priority that has a default SLA policy, tracking starts automatically.

Policies can be enabled/disabled with the toggle. Disabled policies stop auto-attaching but existing tracking continues.`,
  },
  {
    id: "sla-tracking",
    title: "SLA Tracking & Clocks",
    category: "SLA Management",
    keywords: ["tracking", "clock", "pause", "resume", "respond", "resolve", "deadline"],
    content: `SLA tracking monitors per-issue compliance against policy deadlines.

**Clock Lifecycle:**
1. **Running**: Clock starts when SLA is attached (on assignment or manually)
2. **Paused**: Clock pauses when issue is blocked — deadlines extend by paused duration
3. **Resumed**: Clock restarts when issue is unblocked
4. **Responded**: First response recorded (response deadline check)
5. **Completed**: Issue resolved within deadline
6. **Breached**: Deadline passed without resolution

**Tracking Tab:**
Shows all tracked issues with:
- Current status (running/paused/completed/breached)
- Time remaining for response and resolution deadlines
- Color-coded urgency: green (on time), amber (urgent), red (overdue)
- Policy name and assignee

**SLA Dashboard:**
- Compliance rate percentage with progress bar
- On-track, at-risk, and breached counts
- Average response and resolution times
- Active breaches panel with overdue amounts`,
  },
  {
    id: "escalation-rules",
    title: "Escalation Rules",
    category: "SLA Management",
    keywords: ["escalation", "rule", "trigger", "action", "automate", "breach", "error", "idle"],
    content: `Escalation rules define automated responses to operational issues like SLA breaches, errors, and idle agents.

**Creating a Rule:**
1. Navigate to Team → Escalation
2. Click "New Rule"
3. Configure:
   - Name (e.g., "Critical SLA Escalation")
   - Trigger type and threshold
   - Action to take
   - Cooldown period (minimum time between firings)

**Trigger Types:**
- **SLA Breach**: Fires when N or more active SLA breaches exist
- **Error Count**: Fires when N errors occur in the last hour
- **Agent Idle Time**: Fires when any agent is idle for N minutes
- **Consecutive Failures**: Fires when an agent has N consecutive failed runs

**Actions:**
- Notify (log the event)
- Reassign Task (move work to another agent)
- Escalate to Manager (route to a senior agent)
- Pause Agent (stop the problematic agent)
- Restart Agent (attempt recovery)

**Cooldown:** Prevents rapid re-firing. A rule with 60-minute cooldown will fire at most once per hour.

**Manual Evaluation:** Click "Evaluate Now" to check all rules immediately instead of waiting for the cron cycle.`,
  },

  // --- Cost & Budgets ---
  {
    id: "cost-tracking",
    title: "Cost Tracking",
    category: "Cost & Budgets",
    keywords: ["cost", "spend", "budget", "token", "money", "billing"],
    content: `TitanClip tracks all token usage and associated costs.

**Where to see costs:**
- Dashboard: Monthly spend vs budget
- Costs page: Detailed breakdowns by agent, model, project
- Command Center: Cost ticker in header
- Chargeback: Full cost attribution reports

Budget policies can set monthly limits per agent, project, or team-wide. Hard stops auto-pause agents when exceeded.`,
  },
  {
    id: "chargeback",
    title: "Chargeback Reports",
    category: "Cost & Budgets",
    keywords: ["chargeback", "report", "export", "csv", "attribution", "project"],
    content: `The Chargeback page provides cost attribution for internal billing.

**Sections:**
- Summary cards: total spend, budget, active billers, utilization
- Cost by Agent: horizontal bar chart with token counts
- Cost by Model: provider/model breakdown
- Cost by Project: project-level attribution
- Export to CSV for accounting

Navigate to Team → Chargeback.`,
  },
  {
    id: "cloud-estimator",
    title: "Cloud Cost Estimator",
    category: "Cost & Budgets",
    keywords: ["estimate", "cloud", "pricing", "compare", "provider", "openai", "anthropic", "google"],
    content: `The Cloud Cost Estimator shows what your token usage would cost at cloud API rates.

**Included providers:**
- Claude Sonnet 4, Opus 4, Haiku 3.5 (Anthropic)
- GPT-4o, GPT-4o Mini (OpenAI)
- Gemini 2.5 Pro, Flash (Google)
- DeepSeek V3

Each row shows input/output pricing per 1M tokens and the estimated cost based on your actual usage. Green = lowest estimate, Red = highest. A range summary shows min-max at the bottom.

This is for comparison only — not actual charges.`,
  },

  // --- Compliance ---
  {
    id: "compliance-dashboard",
    title: "Compliance Dashboard",
    category: "Compliance & Audit",
    keywords: ["compliance", "audit", "log", "event", "filter", "export", "csv"],
    content: `The Compliance Dashboard provides audit and access visibility.

**Features:**
- Summary cards: total events, agent events, vault events, approvals
- Category filter pills: All, Agent, Task, Approval, Vault, Access, Policy, Secret, Admin
- Searchable audit timeline with color-coded action icons
- Export to CSV button for filtered events
- Credential access report (right sidebar)
- Recent token checkouts
- Data residency information (encryption, storage, backup status)

Navigate to Team → Compliance.`,
  },
  {
    id: "data-retention",
    title: "Data Retention",
    category: "Compliance & Audit",
    keywords: ["retention", "purge", "days", "keep", "delete", "cleanup"],
    content: `Data retention policies control how long different data types are kept.

**Configurable in Admin Settings:**
- Run logs: default 90 days
- Activity events: default 365 days
- Cost events: default 365 days
- Token audit: default 180 days

Set to 0 to keep forever. These are configurable via the admin settings PATCH endpoint.`,
  },

  // --- Workspace Governance ---
  {
    id: "workspace-repos",
    title: "Allowed Repositories",
    category: "Workspace Governance",
    keywords: ["repository", "git", "repo", "allowlist", "restrict"],
    content: `Control which git repositories agents can clone and work in.

**Configuration:**
1. Go to Instance Settings → Workspaces → Unlock
2. Under "Allowed Git Repositories", add repository URLs
3. Leave empty to allow all repositories

Repositories appear as tags that can be removed individually.`,
  },
  {
    id: "workspace-branches",
    title: "Protected Branches",
    category: "Workspace Governance",
    keywords: ["branch", "protect", "main", "master", "push", "git"],
    content: `Protected branches prevent agents from pushing directly to critical branches.

**Default protected:** main, master

Agents must create feature branches instead. Add more branches (e.g., production, staging) in Instance Settings → Workspaces.`,
  },
  {
    id: "workspace-resources",
    title: "Resource Limits",
    category: "Workspace Governance",
    keywords: ["resource", "disk", "cleanup", "timeout", "limit"],
    content: `Set resource limits for agent workspaces.

- **Auto-Cleanup**: Workspaces auto-teardown after X hours of inactivity (default: 24h, 0 = disabled)
- **Max Disk**: Maximum disk space per workspace in MB (default: 5120 MB / 5 GB, 0 = unlimited)

Configure in Instance Settings → Workspaces.`,
  },

  // --- Team Settings ---
  {
    id: "team-config",
    title: "Team Configuration",
    category: "Team Settings",
    keywords: ["team", "settings", "name", "configure", "company"],
    content: `Team settings control your team's display name and configuration.

Navigate to Team → Settings to:
- Change team name
- View team ID
- Configure team-level preferences

Each team is isolated with its own agents, tasks, budgets, and credentials.`,
  },
  {
    id: "team-access",
    title: "Agent Access & RBAC",
    category: "Team Settings",
    keywords: ["access", "members", "rbac", "policy", "assign"],
    content: `The Agent Access page (Team → Access) shows all agents with their permission policies.

**Features:**
- Policy summary cards showing capabilities per policy
- Agent list with inline policy dropdown
- Change an agent's policy immediately via dropdown
- Permission indicators (checkmarks/crosses for tasks and vault access)

Policies are created in Instance Settings → Policies and linked to agents via templates or direct assignment.`,
  },
];
