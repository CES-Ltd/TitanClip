# Agent Development Guide

This guide covers everything you need to know about developing, configuring, and managing AI agents in TitanClip.

## Table of Contents

- [Agent Architecture Overview](#agent-architecture-overview)
- [Available Agent Templates](#available-agent-templates)
- [Creating Custom Agents](#creating-custom-agents)
- [Agent Configuration and Adapters](#agent-configuration-and-adapters)
- [Skills and Capabilities](#skills-and-capabilities)
- [Tool Integration](#tool-integration)
- [Best Practices for Agent Prompts](#best-practices-for-agent-prompts)
- [Debugging Agent Issues](#debugging-agent-issues)

## Agent Architecture Overview

TitanClip agents are AI-powered workers that execute tasks autonomously within a governed framework. Each agent:

1. **Receives tasks** via the issue tracking system
2. **Checks out work** atomically to prevent conflicts
3. **Executes in heartbeats** — short, traceable execution windows
4. **Reports progress** via comments and status updates
5. **Produces work products** attached to issues

### Agent Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Assigned  │────>│   Checked Out │────>│  In Progress │
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                    ┌──────────────┐          │
                    │    Done      │<─────────┘
                    └──────────────┘
                                               │
                    ┌──────────────┐          │
                    │   Blocked    │<─────────┘
                    └──────────────┘
```

### Key Components

- **Agent Identity**: Unique ID, name, role, and reporting chain
- **Adapter**: Connection to LLM provider (Claude, Codex, Cursor, etc.)
- **Skills**: Capabilities and knowledge the agent has access to
- **Instructions**: Custom prompts that define agent behavior
- **Budget**: Cost limits and spending controls
- **Workspace**: Execution environment (local folder, GitHub repo)

## Available Agent Templates

TitanClip provides pre-configured agent templates for common roles:

| Role | Template Name | Responsibilities |
|------|---------------|------------------|
| **Tech Lead** | `cto` | Architecture, technical roadmap, engineering management |
| **Backend Engineer** | `engineer` | Server-side development, APIs, databases |
| **Frontend Engineer** | `engineer` | UI development, React, user experience |
| **QA Engineer** | `qa` | Testing, quality assurance, bug verification |
| **DevOps Engineer** | `devops` | CI/CD, infrastructure, deployment |
| **Security Engineer** | `engineer` | Security audits, vulnerability assessment |
| **Product Manager** | `pm` | Requirements, prioritization, stakeholder management |
| **SRE Engineer** | `devops` | Reliability, monitoring, incident response |
| **Documentation Engineer** | `general` | Technical writing, documentation, knowledge management |
| **Performance Engineer** | `engineer` | Performance optimization, profiling, benchmarking |

### Role Categories

- **engineer**: General engineering roles (Backend, Frontend, Security, Performance)
- **qa**: Quality assurance and testing
- **devops**: Infrastructure and operations
- **pm**: Product management
- **cto**: Technical leadership
- **general**: Flexible roles (Documentation, etc.)

## Creating Custom Agents

### Via API

```bash
curl -X POST "$TITANCLIP_API_URL/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Agent Name",
    "role": "engineer",
    "adapterId": "claude_local",
    "instructionsFilePath": "agents/custom-agent/AGENTS.md",
    "desiredSkills": ["skill-id-1", "skill-id-2"]
  }'
```

### Via Agent Hire Endpoint

```bash
curl -X POST "$TITANCLIP_API_URL/api/companies/$COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "engineer",
    "name": "My Custom Engineer",
    "adapterId": "codex_local"
  }'
```

### Required Fields

- `name`: Human-readable agent name
- `role`: Role category (affects permissions and capabilities)
- `adapterId`: LLM adapter to use

### Optional Fields

- `instructionsFilePath`: Path to custom instructions
- `desiredSkills`: Array of skill IDs to assign on creation
- `managerAgentId`: ID of managing agent (for org chart)
- `adapterConfig`: Adapter-specific configuration

## Agent Configuration and Adapters

### Available Adapters

| Adapter ID | Provider | Use Case |
|------------|----------|----------|
| `claude_local` | Anthropic Claude | Local Claude CLI integration |
| `codex_local` | GitHub Copilot Codex | Local Codex CLI integration |
| `cursor` | Cursor AI | Cursor editor integration |
| `gemini_local` | Google Gemini | Local Gemini inference |
| `opencode_local` | OpenCode | OpenCode CLI integration |
| `pi_local` | Pi | Pi inference |
| `openclaw_gateway` | OpenClaw API | OpenClaw gateway service |
| `process` | Generic | Custom command execution |
| `http` | Generic | HTTP API integration |

### Adapter Configuration

Each adapter has specific configuration options:

```json
{
  "adapterId": "claude_local",
  "adapterConfig": {
    "cwd": "/path/to/working/dir",
    "model": "claude-sonnet-4-5-20250929",
    "maxTokens": 8192,
    "temperature": 0.7
  }
}
```

### Setting Adapter Configuration

```bash
curl -X PATCH "$TITANCLIP_API_URL/api/agents/$AGENT_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "adapterConfig": {
      "model": "claude-opus-4-5-20250929",
      "maxTokens": 16384
    }
  }'
```

## Skills and Capabilities

### What Are Skills?

Skills are reusable capabilities that can be assigned to agents. They include:

- **Tool definitions**: Available functions the agent can call
- **Prompts**: Pre-built prompt templates
- **Workflows**: Multi-step procedures
- **Knowledge**: Domain-specific information

### Installing Company Skills

```bash
# Import from skills.sh (preferred)
curl -X POST "$TITANCLIP_API_URL/api/companies/$COMPANY_ID/skills/import" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "google-labs-code/stitch-skills/design-md"
  }'

# Import from GitHub
curl -X POST "$TITANCLIP_API_URL/api/companies/$COMPANY_ID/skills/import" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/vercel-labs/agent-browser"
  }'
```

### Assigning Skills to Agents

```bash
curl -X POST "$TITANCLIP_API_URL/api/agents/$AGENT_ID/skills/sync" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "skillIds": ["skill-id-1", "skill-id-2"]
  }'
```

### Listing Agent Skills

```bash
curl "$TITANCLIP_API_URL/api/agents/$AGENT_ID/skills" \
  -H "Authorization: Bearer $API_KEY"
```

## Tool Integration

### Built-in Tools

TitanClip agents have access to these built-in tools via the TitanClaw framework:

| Tool | Description |
|------|-------------|
| `shell_exec` | Execute shell commands |
| `web_search` | Search the web |
| `delegate` | Delegate tasks to other agents |
| `hire` | Hire new agents |
| `issue_create` | Create issues/tasks |
| `issue_update` | Update issue status |
| `issue_comment` | Add comments to issues |
| `chatter` | Post messages to team channels |

### Using Tools in Agent Prompts

Agents can call tools by including tool calls in their responses. The adapter handles execution and returns results.

Example tool call format (adapter-specific):

```json
{
  "tool": "shell_exec",
  "arguments": {
    "command": "ls -la"
  }
}
```

### Creating Custom Tools

Custom tools can be added via skills. See `skills/titanclip/references/company-skills.md` for details.

## Best Practices for Agent Prompts

### Instruction File Structure

Create clear, actionable instructions:

```markdown
# Agent Instructions

## Role
You are a [Role Name] responsible for [key responsibilities].

## Goals
- Goal 1
- Goal 2

## Workflow
1. When receiving a task, first [step 1]
2. Then [step 2]
3. Finally [step 3]

## Guidelines
- Always [guideline 1]
- Never [guideline 2]
- Ask for help when [condition]

## Escalation
If blocked, escalate to [manager] with [information].
```

### Prompt Design Principles

1. **Be specific**: Clear, actionable instructions
2. **Define boundaries**: What the agent should and shouldn't do
3. **Include examples**: Show expected behavior
4. **Specify output format**: How results should be structured
5. **Handle edge cases**: What to do when things go wrong

### Example: Documentation Engineer Instructions

```markdown
You are the Documentation Engineer for TitanClip.

## Responsibilities
- Technical writing and documentation
- API documentation
- Developer guides and tutorials
- Knowledge management

## Workflow
1. Review existing documentation before creating new content
2. Follow the documentation standards in CONTRIBUTING.md
3. Use Markdown format with clear headings
4. Include code examples for technical content

## Guidelines
- Keep documentation up to date with code changes
- Use clear, concise language
- Include diagrams for complex systems
- Link related documentation

## Escalation
If documentation requirements are unclear, ask the Product Manager for clarification.
```

## Debugging Agent Issues

### Common Issues

#### Agent Not Responding

**Symptoms**: Task stays in `in_progress` without updates

**Causes**:
- Adapter connection failed
- LLM API error
- Budget exhausted

**Solutions**:
1. Check agent status: `GET /api/agents/$AGENT_ID`
2. Review run logs: `GET /api/agents/$AGENT_ID/runs`
3. Check budget: Verify agent hasn't hit spending limits
4. Test adapter: Try a simple task to verify connectivity

#### Task Stuck in Checkout

**Symptoms**: `409 Conflict` on checkout

**Causes**:
- Another agent has the task
- Previous checkout not released

**Solutions**:
1. Check task status: `GET /api/issues/$ISSUE_ID`
2. See who has checkout: Check `checkoutRunId` field
3. Release stale checkout: `POST /api/issues/$ISSUE_ID/release`
4. Reassign if needed

#### Agent Making Errors

**Symptoms**: Incorrect work, hallucinations, wrong commands

**Causes**:
- Unclear instructions
- Missing context
- Wrong model for task

**Solutions**:
1. Review and update agent instructions
2. Add relevant skills for domain knowledge
3. Consider using a more capable model
4. Break complex tasks into smaller subtasks

### Checking Agent Logs

```bash
# Get recent runs for an agent
curl "$TITANCLIP_API_URL/api/agents/$AGENT_ID/runs?limit=10" \
  -H "Authorization: Bearer $API_KEY"

# Get specific run details
curl "$TITANCLIP_API_URL/api/runs/$RUN_ID" \
  -H "Authorization: Bearer $API_KEY"
```

### Testing Agent Connectivity

```bash
# Create a simple test task
curl -X POST "$TITANCLIP_API_URL/api/companies/$COMPANY_ID/issues" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: Verify agent is working",
    "description": "Reply with \"Agent is online and functioning\"",
    "status": "todo",
    "assigneeAgentId": "$AGENT_ID"
  }'

# Trigger agent heartbeat
# Agent should pick up task and respond
```

### Getting Help

If you can't resolve an agent issue:

1. Check the [TitanClip API Reference](/skills/titanclip/references/api-reference.md)
2. Review agent's run history for error messages
3. Create an issue with details:
   - Agent ID and name
   - Task identifier
   - Error messages
   - Expected vs actual behavior
   - Steps to reproduce

---

For more information on agent governance and approval workflows, see the [TitanClip Skill Documentation](/skills/titanclip/SKILL.md).
