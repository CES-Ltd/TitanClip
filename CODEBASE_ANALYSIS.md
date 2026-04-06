# TitanClip Codebase Analysis — Deep Audit

**Date:** 2026-04-06
**Scope:** Full monorepo — server, UI, Electron, packages, adapters, skills, orchestration
**Files analyzed:** ~500+ source files across all packages

---

## Executive Summary

TitanClip is a well-architected Electron app with a sophisticated agent orchestration engine (heartbeat service). The core execution locking, coalescing, and session management are impressive. However, four systemic issues undermine the platform's reliability:

1. **The chat route operates entirely outside the governance system** — no budget enforcement, no concurrency limits, no session management
2. **Tool actions from LLM are fire-and-forget** — delegation, hiring, and status updates silently fail without feedback
3. **Security gaps in file/shell tools** — no sandboxing, no path restrictions, autonomous mode allows unrestricted access
4. **Agent instruction files had stale PAPERCLIP_ references** (now fixed) but the pattern reveals a broader issue: no migration system for deployed agent configs

---

## CRITICAL — Fix Immediately

### C1. Chat Route Bypasses Heartbeat Governance
**File:** `server/src/routes/agent-chat.ts`

The chat route calls `universal_llm.execute()` directly, bypassing the heartbeat system entirely. This means:
- No concurrency limit — user can spam chat while heartbeat runs are active
- No budget enforcement — only best-effort `costEvents` insert at line 487
- No session management — chat history is separate from heartbeat sessions
- Cost tracking is incomplete — chat LLM calls don't appear in run cost reports

**Recommendation:** Either route chat through the heartbeat system as a special "interactive" run type, or add explicit budget/concurrency checks to the chat route.

### C2. Tool Action Fire-and-Forget Pattern
**File:** `server/src/routes/agent-chat.ts:408`

```typescript
processToolAction(db, resultText, { ... }).catch((e) => console.warn(...));
```

The LLM's tool stub returns `{ action: "delegate_to_agent", status: "requested" }` which the LLM interprets as success. If `processToolAction` fails (DB error, missing agent, etc.), the LLM continues believing delegation succeeded. The user sees a success message. No issue was actually created.

**Recommendation:** Buffer tool actions, execute them synchronously, and feed real success/failure back to the LLM as a follow-up tool result message.

### C3. Security — Unrestricted File/Shell Access in Autonomous Mode
**Files:** `packages/adapters/universal-llm/src/server/tools/index.ts`

- `shell_exec` uses `execSync` with arbitrary commands — no sandboxing
- `write_file` has `requiresApproval: false` — autonomous mode allows unrestricted disk writes
- `read_file` can read any file on disk (e.g., `/etc/passwd`, `~/.ssh/id_rsa`)
- No path allowlist/denylist — agents operate with full server process permissions

**Recommendation:** Add workspace-bounded path validation (restrict to agent workspace + project dirs). Add a shell command blocklist. Consider Docker sandboxing for autonomous mode.

### C4. Mass Assignment Vulnerability
**File:** `server/src/routes/user-credentials.ts:105`

`req.body` is spread directly into a DB update with zero validation, allowing arbitrary column modification on the `vaultCredentials` table.

**Recommendation:** Add Zod schema validation to the PATCH endpoint. Only allow known fields.

### C5. Missing Auth on Heartbeat Run Issues Endpoint
**File:** `server/src/routes/activity.ts:81-85`

`GET /heartbeat-runs/:runId/issues` is completely unauthenticated — anyone can query run details.

**Recommendation:** Add `assertCompanyAccess` middleware.

---

## HIGH — Fix Soon

### H1. Fuzzy Agent Name Matching in Delegation
**File:** `server/src/routes/agent-chat.ts:1327`

```typescript
const target = allAgents.find((a) => a.name.toLowerCase().includes(agentName.toLowerCase()));
```

If the LLM passes "engineer", it matches the FIRST agent whose name contains "engineer". With names like `Backend_Engineer_a1b2c3d4` and `Frontend_Engineer_e5f6g7h8`, the wrong agent gets the task.

**Recommendation:** Use exact match first, then fall back to role-based routing, then fuzzy. Or expose agent IDs to the LLM.

### H2. Session History Discards Tool Interactions
**File:** `packages/adapters/universal-llm/src/server/execute.ts:242-248`

`updatedHistory` only includes the original messages + a single assistant response. Tool call messages and tool result messages from the agentic loop are NOT preserved. The next heartbeat turn loses all tool interaction context.

**Recommendation:** Include tool_call and tool_result messages in the returned session history.

### H3. Context Coalescence Data Loss
**File:** `server/src/services/heartbeat.ts:743`

`mergeCoalescedContextSnapshot()` does a shallow spread. Multiple rapid wakes for the same task scope lose earlier context when merging. If wake A sets `commentId: "abc"` and wake B sets `commentId: "def"`, only "def" survives.

**Recommendation:** Use array accumulation for multi-value fields (e.g., `commentIds: [...]`), or merge with a deep strategy that preserves both.

### H4. Web Search Tool is a Stub
**File:** `packages/adapters/universal-llm/src/server/tools/index.ts:16-17`

The `web_search` tool returns a hardcoded placeholder string. This is one of the most useful tools for an agent and it does nothing.

**Recommendation:** Implement DuckDuckGo HTML scraping (no API key needed) — already done in TitanClaw CLI's `src/tools/web.ts`. Port it.

### H5. No Automatic Issue Status Transitions
Issues stay in "todo" unless the agent explicitly calls `update_issue_status`. If the agent fails, crashes, or simply doesn't call the tool, the issue is stuck forever.

**Recommendation:** Add automatic `todo` -> `in_progress` when a heartbeat run starts working on an issue (at checkout time), and `in_progress` -> `blocked` if the run fails with an error.

### H6. TOCTOU Race in Concurrent Run Gating
**File:** `server/src/services/heartbeat.ts`

`countRunningRunsForAgent()` and `claimQueuedRun()` are separate DB calls. Two concurrent `startNextQueuedRunForAgent` calls could both see capacity available and both claim, exceeding `maxConcurrentRuns`.

**Recommendation:** Wrap the count + claim in a single DB transaction, or use a CAS-style claim that includes the count condition.

### H7. MarkdownBody XSS Vectors
**File:** `ui/src/components/MarkdownBody.tsx`

- Line 147: `urlTransform={(url) => url}` bypasses react-markdown's built-in URL sanitization (removes `javascript:` URLs, etc.)
- Line 79: Mermaid SVG output rendered via `dangerouslySetInnerHTML`

**Recommendation:** Remove the `urlTransform` override or implement a proper sanitizer. Use a sanitization library for Mermaid output.

### H8. Company Access Bypass in 9+ Route Files
**Files:** `vault.ts`, `chatter.ts`, `performance.ts`, `sla.ts`, `dependencies.ts`, `lifecycle.ts`, `analytics.ts`, `skill-routing.ts`

These files define simplified `assertCompanyAccess` that skips the board user company membership check enforced by the canonical `authz.ts` version.

**Recommendation:** Import from the canonical `authz.ts` instead of re-defining.

### H9. Duplicate Role Check is Broken for Hires
**File:** `server/src/routes/agent-chat.ts:1121-1123`

The check `!a.name.includes("(auto-hired)")` looks for a literal string that the hiring code never inserts. Agent names use `TemplateName_UUID` format. This means ALL existing agents are treated as "real" and block re-hires for the same role.

**Recommendation:** Use the `hireSource` or `templateId` DB fields (already in the schema) to distinguish auto-hired agents from manually created ones.

---

## MEDIUM — Improve Quality

### M1. No Pagination Anywhere
Issues, agents, projects, activity lists, and conversations all load everything at once. This will break at scale (100+ agents, 1000+ issues).

**Affected files:** Most list endpoints in `server/src/routes/` and query hooks in `ui/src/hooks/`.

### M2. useChatStream Re-renders Per Token
**File:** `ui/src/hooks/useChatStream.ts`

Every SSE chunk calls `setState`, causing the entire `StreamingMessage` tree to re-render for every token. With fast models, this can be 50+ re-renders per second.

**Recommendation:** Batch state updates with `requestAnimationFrame` or use a ref for intermediate content and only update state at the end of chunks.

### M3. No React.lazy on Page Imports
**File:** `ui/src/App.tsx:8-68`

65+ page imports are synchronous. Only `Workplace` is lazy-loaded. This bloats the initial bundle significantly.

**Recommendation:** Wrap page imports in `React.lazy()` with `Suspense` fallbacks.

### M4. AgentDetail.tsx is 49,000+ Tokens
**File:** `ui/src/pages/AgentDetail.tsx`

This monolith should be broken into sub-components: RunsTab, SkillsTab, ConfigTab, OverviewSection. Each could be lazy-loaded.

### M5. Duplicated Live Update Invalidation Logic
**Files:** `ui/src/contexts/LiveUpdatesProvider.tsx` (893 lines) and `ui/src/contexts/IpcLiveUpdatesProvider.tsx`

The WebSocket and IPC providers partially duplicate query invalidation logic. Changes to one must be manually mirrored.

**Recommendation:** Extract invalidation logic into a shared `handleLiveEvent()` function.

### M6. Duplicated Hooks: useAgentOrder / useProjectOrder
**Files:** `ui/src/hooks/useAgentOrder.ts`, `ui/src/hooks/useProjectOrder.ts`

Nearly identical structure. Should be generalized into `useEntityOrder<T>()`.

### M7. No Debounce on Search Inputs
**Files:** `ui/src/components/chat/ChatInput.tsx:77-81`, `ui/src/components/CommandPalette.tsx:60-69`

Every keystroke fires an API request for issue/command search. Should debounce by 200-300ms.

### M8. Token Estimation is Crude
**File:** `packages/adapters/universal-llm/src/server/execute.ts:122`

`content.length / 4` is unreliable for cost/budget decisions. Different languages tokenize very differently. Should use actual token counts from provider responses.

### M9. shell_exec Uses Blocking execSync
**File:** `packages/adapters/universal-llm/src/server/tools/index.ts`

`execSync` blocks the Node.js event loop for up to 30 seconds. Already fixed in TitanClaw CLI with async `spawn`. Should port the fix.

### M10. No Dead Letter Queue for Failed Wakeups
Failed or cancelled wakeup requests are marked in DB but never reviewed or retried. No alerting on repeated failures for the same agent/issue.

### M11. No Rate Limiting on Agent Wakeups
A pathological loop (agent creates issue -> issue triggers wakeup -> agent creates issue) could cause unbounded recursion. Should add a per-agent wakeup rate limit (e.g., max 10 wakeups per minute).

### M12. PID Recycling False Positives in Orphan Reaping
**File:** `server/src/services/heartbeat.ts:773`

`kill(pid, 0)` can return true for a recycled PID. The code acknowledges this but has no mitigation. Could lead to an orphaned run never being reaped.

### M13. tickTimers Scans ALL Agents
**File:** `server/src/services/heartbeat.ts:3985`

`db.select().from(agents)` with no filtering runs on every heartbeat interval. For large deployments, this is O(n) with no index hints.

---

## LOW — Polish / Future

### L1. Accessibility Gaps
- Chat interface lacks `role="log"` / `aria-live="polite"` for streaming content
- Icon-only buttons (send, stop, sidebar actions) missing `aria-label`
- No focus management after creating issues, approving requests, or navigating
- Color-only status indicators (StatusIcon, PriorityIcon) without text for screen readers
- ThinkingIndicator blob animations don't respect `prefers-reduced-motion`

### L2. No Conversation Deletion in Chat
Users can create conversations but never delete them. The sidebar grows indefinitely.

### L3. No File Upload in Chat
Chat input only supports text. No way to share screenshots, logs, or files with agents.

### L4. No Bulk Operations on Issues
Cannot select multiple issues to change status/assignee/priority in batch.

### L5. No Keyboard Shortcut Quick-Reference
Only 3 shortcuts defined in `useKeyboardShortcuts.ts`. No Cmd+K for search (handled separately). No overlay showing available shortcuts.

### L6. Auto-Scroll Fights User in Chat
**File:** `ui/src/pages/AgentChat.tsx:93-95`

`scrollIntoView({ behavior: "smooth" })` triggers on every streaming chunk. If a user scrolls up to read earlier content, the next chunk snaps them back down.

**Recommendation:** Add a "scroll lock" — only auto-scroll if user is already at the bottom.

### L7. No Undo for Approval Actions
Approve/Reject are one-click with no confirmation dialog and no undo. Risky for critical decisions like hiring agents or budget overrides.

### L8. CLI Detection Runs on Every Execution
**File:** `server/src/adapters/registry.ts`

`which titanclaw` runs on EVERY adapter invocation. Should cache with a TTL (e.g., 60 seconds).

### L9. No Offline Support Message
When the API is unreachable, the UI shows generic "Loading..." indefinitely. Should show an explicit offline indicator.

### L10. Hardcoded Code Block Colors in CSS
**File:** `ui/src/index.css`

Dark code block colors (`#1e1e2e`, `#cdd6f4`) don't use CSS variables, so they don't adapt to the TitanClip theme.

---

## Feature Opportunities

### F1. Agent-to-Agent Direct Communication
Currently agents can only interact through issues and chatter. Adding a direct message channel between agents (or a shared scratchpad per task) would enable tighter collaboration — e.g., CTO and Frontend Engineer discussing implementation details without creating issues.

### F2. Agent Performance Dashboard
Track per-agent metrics: task completion rate, average time to close, tool usage patterns, cost efficiency, error rate. This data exists in heartbeat runs but isn't surfaced in the UI.

### F3. Smart Model Routing
Inspired by Hermes Agent: route simple tasks (short messages, no code) to cheaper/faster models automatically. Save expensive models for complex reasoning tasks. Configurable per-agent or per-company.

### F4. Workspace File Browser
Let users browse an agent's workspace files directly in the UI. Currently agents write files but users can't see them without terminal access.

### F5. Real-Time Run Log Streaming
The run log viewer polls every 2 seconds. Switch to WebSocket/SSE streaming for live output as the agent works.

### F6. Agent Skill Marketplace
Allow sharing and importing agent instruction templates (SOUL.md, HEARTBEAT.md, AGENTS.md) between companies/instances. The template system already exists — just needs a discovery/import UI.

### F7. Issue Dependency Graph
The `task_dependencies` migration exists but the UI doesn't show dependency relationships. A visual graph showing blocked/blocking tasks would help with project management.

### F8. Budget Alerts and Auto-Scaling
Notify users when agents approach budget limits. Auto-pause non-critical agents when company budget is low. Auto-scale to cheaper models when cost is high.

### F9. Conversation Memory Across Sessions
Currently chat history is per-conversation. An agent's memory service (`agent-memory.ts`) exists but isn't integrated with the chat route. Agents should remember context from past conversations.

### F10. Plugin-Provided Tools
The plugin SDK has `toolDefinitions` support but the universal_llm adapter doesn't integrate plugin-provided tools. Agents should be able to use tools from installed plugins.

---

## Architecture Notes

### What's Working Well
- **Heartbeat execution locking** — The `SELECT FOR UPDATE` pattern on issues is correct and robust
- **Session compaction** — Handles multi-project scenarios with rotation, handoff summaries, and workspace migration
- **Three-theme system** — OKLCH color space with light/dark/titanclip themes is well-implemented
- **SSE streaming architecture** — Clean discriminated union `StreamEvent` type works well for both human and machine consumption
- **Plugin SDK boundary** — Clean separation with dedicated build constraints
- **Adapter pattern** — Clean interface allowing diverse CLI tools (Claude, Codex, Gemini, etc.) to plug in

### What Needs Rethinking
- **Chat route vs Heartbeat system** — These are two parallel execution paths that don't share governance. The chat route should either go through the heartbeat system or have its own budget/concurrency enforcement
- **Tool stubs pattern** — Having tools return JSON stubs that the chat route processes separately is fragile. Consider having the tools call the API directly (with the agent's JWT) so results are real
- **File-based instruction delivery** — Writing HEARTBEAT.md/SOUL.md/AGENTS.md to disk and hoping agents read them is unreliable. Consider injecting instructions into the system prompt directly at execution time (the heartbeat service already has context injection infrastructure)
