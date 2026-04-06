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
  "Skill-Based Routing",
  "Enterprise Security",
  "Credential Vault",
  "Task Management",
  "Dependencies & Workflows",
  "SLA Management",
  "Analytics & Forecasting",
  "Cost & Budgets",
  "Compliance & Audit",
  "Lifecycle Management",
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
- Skill-based task routing with proficiency matrix and smart auto-assignment
- Advanced analytics with velocity charts, burndown, cost trends, and workload forecasting
- Lifecycle management: onboarding workflows, offboarding automation, and change requests
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

  // --- Skill-Based Routing ---
  {
    id: "skill-matrix",
    title: "Skill Matrix",
    category: "Skill-Based Routing",
    keywords: ["skill", "matrix", "proficiency", "agent", "capability", "competency"],
    content: `The Skill Matrix (Team → Skill Routing → Skill Matrix tab) shows a grid of all agents and their skill proficiency levels.

**Proficiency Levels (1-5):**
- 1 - Novice: Basic awareness
- 2 - Beginner: Can perform with guidance
- 3 - Intermediate: Can work independently
- 4 - Advanced: Can mentor others
- 5 - Expert: Deep expertise and leadership

**Using the Matrix:**
- Rows are agents, columns are skills
- Star ratings show proficiency level
- Click "+" in an empty cell to add a skill at level 1
- Click "+" at end of a row to add a new skill with a custom proficiency level
- Skills auto-complete from a built-in catalog (coding, testing, code-review, debugging, etc.)

The matrix is the foundation for the Smart Router — agents need skills assigned before they can be matched to tasks.`,
  },
  {
    id: "skill-catalog",
    title: "Built-in Skill Catalog",
    category: "Skill-Based Routing",
    keywords: ["catalog", "skills", "list", "coding", "testing", "review", "devops"],
    content: `TitanClip includes a built-in skill catalog for quick selection. You can also create custom skill names.

**Built-in Skills:**
- coding, testing, code-review, documentation, debugging
- architecture, devops, security, data-analysis, research
- api-design, frontend, backend, database, infrastructure
- project-management, communication, problem-solving

Custom skills are entered as free-text and automatically normalized to lowercase. Once any agent has a custom skill, it appears in the autocomplete for all agents.`,
  },
  {
    id: "smart-router",
    title: "Smart Task Router",
    category: "Skill-Based Routing",
    keywords: ["router", "route", "assign", "match", "auto", "smart", "recommend", "candidate"],
    content: `The Smart Task Router (Team → Skill Routing → Smart Router tab) finds the best agent for a task based on skill requirements.

**How to use:**
1. Add skill requirements (e.g., "coding" at minimum Intermediate, "testing" at minimum Beginner)
2. Click "Find Best Match"
3. The router scores all available agents and ranks them

**Scoring Factors (weighted composite):**
- Skill Fit (40%): How well the agent's skills match requirements. Full credit if proficiency meets or exceeds minimum; partial credit for lower levels; zero for missing skills.
- Availability (25%): Agents with fewer current tasks score higher.
- Workload Balance (20%): Distributes work evenly across the team.
- Cost Efficiency (15%): Agents with lower recent costs score higher.

**Results show:**
- Best match highlighted in green with overall score
- Other candidates ranked by score
- Expandable detail: score breakdown bars, matched/missing skills, task count, health score
- Each matched skill shows actual proficiency vs required level`,
  },
  {
    id: "task-skill-requirements",
    title: "Task Skill Requirements",
    category: "Skill-Based Routing",
    keywords: ["task", "requirement", "issue", "assign", "skill", "prerequisite"],
    content: `Issues can specify skill requirements that feed into the Smart Router.

**How skill requirements work:**
- Each requirement has a skill name and minimum proficiency level
- When routing, the system checks each agent's proficiency against all requirements
- Agents meeting all requirements at or above the minimum level get full skill fit score
- Agents with partial matches get proportional credit
- Agents missing required skills entirely are penalized

**Best practices:**
- Set 1-3 key skills per task for best routing results
- Use minimum Intermediate (3) for tasks requiring independent work
- Use minimum Advanced (4) or Expert (5) for complex/critical tasks
- The router still considers availability and cost, so a slightly less skilled but available agent may rank higher than an overloaded expert`,
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

**SSO Mode:** When PAPERCLIP_SSO_CLIENT_ID is configured, PIN is replaced by Microsoft SSO. Change PIN option is hidden in SSO mode.`,
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

  // --- Analytics & Forecasting ---
  {
    id: "analytics-dashboard",
    title: "Analytics Dashboard",
    category: "Analytics & Forecasting",
    keywords: ["analytics", "dashboard", "charts", "metrics", "overview", "statistics"],
    content: `The Analytics Dashboard (Team → Analytics) provides comprehensive business intelligence with charts and forecasts.

**Top Metrics Row:**
- Tasks Created and Completed with completion rate
- Average Cycle Time (start to completion)
- Total Runs with success rate
- Total Cost for the period
- Open Tasks with estimated clear time

**Time Range:** Switch between 7-day, 30-day, and 90-day views.

All data auto-refreshes every 60 seconds.`,
  },
  {
    id: "velocity-chart",
    title: "Velocity Chart",
    category: "Analytics & Forecasting",
    keywords: ["velocity", "throughput", "created", "completed", "chart", "trend"],
    content: `The Velocity chart shows task creation vs completion over time.

**Two lines:**
- Green (solid): Tasks completed per day
- Indigo (dashed): Tasks created per day

**Metrics below chart:**
- Average completions per day
- Average creations per day

When completions exceed creations, the backlog is shrinking. When creations exceed completions, the backlog is growing. Use this to understand team throughput trends and capacity planning.`,
  },
  {
    id: "burndown-chart",
    title: "Burndown Chart",
    category: "Analytics & Forecasting",
    keywords: ["burndown", "remaining", "ideal", "progress", "sprint"],
    content: `The Burndown chart tracks remaining open tasks over time against an ideal linear trajectory.

**Two lines:**
- Green (solid): Actual remaining tasks
- Indigo (dashed): Ideal linear burndown

**Metrics below chart:**
- Remaining tasks count
- Capacity utilization percentage (open tasks relative to agent capacity)

If the actual line is above the ideal line, work is behind schedule. If below, the team is ahead of pace.`,
  },
  {
    id: "work-distribution",
    title: "Work Distribution",
    category: "Analytics & Forecasting",
    keywords: ["distribution", "agent", "workload", "balance", "assignment"],
    content: `Work Distribution shows how tasks and costs are spread across agents.

**Bar chart:** Visual comparison of tasks assigned per agent.

**Detail table:**
- Agent name
- Tasks completed out of assigned (e.g., 5/8)
- Run count
- Cost

Use this to identify workload imbalances — if one agent has significantly more tasks than others, consider redistributing using the Smart Router.`,
  },
  {
    id: "cost-trend-forecast",
    title: "Cost Trend & Budget Forecast",
    category: "Analytics & Forecasting",
    keywords: ["cost", "trend", "forecast", "budget", "burn", "projection", "monthly"],
    content: `The Cost Trend chart shows daily spending over the selected time range with a sparkline visualization.

**Budget Forecast panel below the chart:**
- Month to Date: current month spending so far
- Projected Month End: extrapolated total based on daily burn rate
- Daily Burn Rate: average spend per day
- Days Remaining: days left in current month

Use this to anticipate budget overruns before they happen and adjust agent workloads accordingly.`,
  },
  {
    id: "workload-forecast",
    title: "Workload Forecast",
    category: "Analytics & Forecasting",
    keywords: ["workload", "forecast", "capacity", "clear", "estimate", "utilization"],
    content: `The Workload Forecast shows projected task clearance and team capacity.

**Metrics:**
- Open Tasks: current backlog size
- Avg Completed/Day: historical completion velocity
- Est. Clear Time: projected days to complete all open tasks at current velocity
- Capacity Utilization: percentage of team capacity in use (assumes 5 tasks per agent = 100%)

**Color coding:**
- Green: healthy (utilization under 50%, clear time under 14 days)
- Amber: moderate load (utilization 50-80%, clear time 14-30 days)
- Red: overloaded (utilization above 80%, clear time over 30 days)

A capacity utilization bar at the bottom provides a visual indicator.`,
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

  // --- Lifecycle Management ---
  {
    id: "onboarding-workflows",
    title: "Onboarding Workflows",
    category: "Lifecycle Management",
    keywords: ["onboarding", "onboard", "new agent", "training", "workflow", "hire"],
    content: `Onboarding workflows auto-create training tasks when a new agent is hired.

**Creating an Onboarding Workflow:**
1. Go to Team → Lifecycle → Onboarding tab
2. Click "New Workflow"
3. Set name, target role (e.g., Engineer), and description
4. Add sequential steps — each becomes a task when executed
5. Steps are auto-linked with dependencies (step 2 depends on step 1)

**Running Onboarding:**
1. Select an agent and workflow in the "Run Onboarding" panel
2. Click "Start"
3. Tasks are created and assigned to the new agent
4. First step starts as "todo", subsequent steps start as "blocked"
5. As each task completes, the next is auto-unblocked

**Auto-Onboard:** Workflows can be matched to agent roles. When enabled, hiring an agent of that role automatically triggers the onboarding workflow.

Recent onboarding instances are shown with agent name, workflow name, task count, and date.`,
  },
  {
    id: "offboarding",
    title: "Agent Offboarding",
    category: "Lifecycle Management",
    keywords: ["offboarding", "offboard", "terminate", "remove", "reassign", "revoke"],
    content: `Offboarding automates the process of removing an agent from active duty.

**Process (Team → Lifecycle → Offboarding tab):**
1. Select the agent to offboard
2. Optionally select another agent to reassign open tasks to
3. Click "Offboard Agent"

**Automated actions:**
- All open tasks are reassigned to the selected agent (or unassigned if none selected)
- All active vault token checkouts are revoked immediately
- Agent status is set to "terminated"

**Offboarding Report:**
After completion, a report shows all actions taken: number of tasks reassigned, vault checkouts revoked, and final status. This action cannot be undone.`,
  },
  {
    id: "change-management",
    title: "Change Requests",
    category: "Lifecycle Management",
    keywords: ["change", "request", "approval", "review", "implement", "rollback", "risk"],
    content: `Change requests provide a structured approval process for modifications to agents, policies, and infrastructure.

**Creating a Change Request:**
1. Go to Team → Lifecycle → Change Requests tab
2. Click "New Request"
3. Fill in: title, description, category, risk level, validation steps

**Categories:** Agent Config, Policy Change, Infrastructure, Workflow, Access Control, Other

**Risk Levels:** Low (green), Medium (amber), High (orange), Critical (red)

**Status Flow:**
Draft → Pending Review → Approved → Implemented → (optionally) Rolled Back
Or: Draft → Pending Review → Rejected

**Actions at each stage:**
- Draft: "Submit" moves to Pending Review
- Pending Review: "Approve" or "Reject"
- Approved: "Implement" records implementation timestamp
- Implemented: "Rollback" if the change needs to be reversed

Each change request tracks affected agents, scheduled date, validation steps, and reviewer notes.`,
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

  // --- Paperclip Agent & Chat ---
  {
    id: "paperclip-agent-overview",
    title: "Paperclip Agent Agent Framework",
    category: "Agent Management",
    keywords: ["paperclip-agent", "agent os", "framework", "agentic", "tool calling", "paperclip agent"],
    content: `Paperclip Agent is the built-in agentic AI framework in TitanClip. It provides autonomous task execution with tool calling, delegation, and memory.

**Key Features:**
- Agentic tool loop: LLM calls tools, processes results, and iterates until task is complete
- 8 built-in tools: web_search, web_fetch, shell_exec, read_file, write_file, current_time, delegate_to_agent, hire_agent
- Autonomy levels: sandboxed (no tools), supervised (destructive tools need approval), autonomous (all tools auto-execute)
- Per-run cost budgeting with token limits
- Streaming recovery: auto-compacts context when token budget is near limit
- Cross-session memory with importance weighting and time decay

**Navigate to:** Settings → Paperclip Agent Settings (sidebar → Paperclip Agent → LLM Settings)

**Enable Paperclip Agent:** Instance Settings → Experimental → Paperclip Agent toggle`,
  },
  {
    id: "chat-interface",
    title: "Chat Interface",
    category: "Getting Started",
    keywords: ["chat", "message", "conversation", "talk", "command"],
    content: `The Chat interface lets you interact with your team's main agent in real-time with streaming responses.

**Features:**
- Slash commands: /status, /plan, /review, /create-issue, /agents, /help
- # mentions: type # to reference an issue (e.g., #DEL-2) — the agent gets full issue context
- @ mentions: type @ to mention an agent — routes tasks or queries to that agent
- Project context: select a project to scope your questions
- Tool call cards: see agent tool usage as collapsible cards
- Inline approvals: approve or reject agent actions directly in chat
- Rich markdown: tables, code blocks, lists rendered in responses

**Navigate to:** Sidebar → Chat`,
  },
  {
    id: "http-adapters",
    title: "HTTP Adapters",
    category: "Agent Management",
    keywords: ["adapter", "http", "openai", "endpoint", "provider", "model", "api key"],
    content: `HTTP Adapters connect TitanClip to OpenAI-compatible LLM endpoints. You can create multiple named adapters for different providers.

**Creating an Adapter:**
1. Go to Instance Settings → Admin → Adapters section
2. Select OpenAI Compatible from the adapter list
3. Click "Add Adapter"
4. Enter a name (e.g., "Production OpenAI")
5. Select a provider preset (OpenAI, Anthropic, Ollama, etc.)
6. Enter API key and click Connect
7. Select models to enable
8. Click Save Adapter

**Navigate to:** Instance Settings → Admin (requires admin PIN)`,
  },
  {
    id: "fun-mode",
    title: "Fun Mode",
    category: "Team Settings",
    keywords: ["fun", "pixel art", "villain", "workplace", "game", "animation"],
    content: `Fun Mode adds playful elements to TitanClip:

- Pixel art villain animations on the team onboarding screen
- Villain-themed agent names (Mogambo, Joker, Thanos, etc.) when hiring agents
- Workplace gamified view in the sidebar

**Toggle:** Click the sparkle icon in the title bar (next to the theme switcher)
Or: Instance Settings → Experimental → Fun Mode`,
  },
  {
    id: "soft-delete",
    title: "Soft Delete Team Data",
    category: "Team Settings",
    keywords: ["delete", "soft delete", "clear", "reset", "memory", "logs"],
    content: `Soft Delete removes agent memories, conversation history, and run logs while preserving audit trails and financial records.

**What gets deleted:**
- Agent memories (all types)
- Conversations and messages
- Heartbeat run event logs

**What is preserved:**
- Activity log (audit trail)
- Cost events and financial records
- Issues, agents, and projects

**Navigate to:** Company Settings → Danger Zone → Soft Delete Team Data`,
  },
];
