# Plugin Authoring Guide

This guide covers everything you need to know about developing plugins for TitanClip (Paperclip).

## Table of Contents

- [Plugin Architecture Overview](#plugin-architecture-overview)
- [Plugin SDK and APIs](#plugin-sdk-and-apis)
- [Creating a New Plugin](#creating-a-new-plugin)
- [Plugin Lifecycle and Events](#plugin-lifecycle-and-events)
- [UI Components for Plugins](#ui-components-for-plugins)
- [Plugin Distribution](#plugin-distribution)
- [Plugin Security Guidelines](#plugin-security-guidelines)
- [Example Plugins](#example-plugins)

## Plugin Architecture Overview

TitanClip plugins extend the platform with custom functionality through a worker + UI architecture:

```
┌─────────────────────────────────────────────────────┐
│                  TitanClip Host                     │
│  ┌─────────────┐         ┌─────────────────────┐   │
│  │ Plugin UI   │<───────>│ Plugin Worker       │   │
│  │ (React)     │  JSON   │ (Node.js)           │   │
│  │             │  RPC    │                     │   │
│  └─────────────┘         └─────────────────────┘   │
│         ↑                       ↑                   │
│         │                       │                   │
│  ┌─────────────┐         ┌─────────────────────┐   │
│  │ Host APIs   │         │ Host APIs           │   │
│  │ - Issues    │         │ - Events            │   │
│  │ - Agents    │         │ - State             │   │
│  │ - Projects  │         │ - Tools             │   │
│  └─────────────┘         └─────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Concepts

- **Plugin Worker**: Node.js process that runs plugin logic, handles events, and exposes tools/actions
- **Plugin UI**: React components rendered in the TitanClip interface
- **Manifest**: Declaration of plugin metadata, capabilities, and entry points
- **Slots**: Mount points in the host UI where plugin components render
- **Launchers**: Buttons/menu items that open plugin UI

### Current Runtime Model

**Important**: The current plugin runtime treats plugins as **trusted code**:

- Plugin workers have access to capability-gated host APIs
- Plugin UI runs as same-origin JavaScript (not sandboxed)
- Manifest capabilities control worker API access, not UI
- Both worker and UI should be treated as trusted as the host itself

## Plugin SDK and APIs

### Package Structure

| Package | Import | Purpose |
|---------|--------|---------|
| `@paperclipai/plugin-sdk` | Worker SDK | `definePlugin`, context, lifecycle |
| `@paperclipai/plugin-sdk/ui` | UI SDK | React hooks and slot props |
| `@paperclipai/plugin-sdk/testing` | Testing | In-memory host harness |
| `@paperclipai/plugin-sdk/bundlers` | Bundlers | esbuild/rollup presets |
| `@paperclipai/plugin-sdk/dev-server` | Dev server | Static UI server + SSE reload |

### Installation

```bash
pnpm add @paperclipai/plugin-sdk
```

### Worker SDK Quick Start

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    // Subscribe to events
    ctx.events.on("issue.created", async (event) => {
      ctx.logger.info("Issue created", { issueId: event.entityId });
    });

    // Register data endpoints
    ctx.data.register("health", async () => ({ status: "ok" }));

    // Register actions
    ctx.actions.register("ping", async () => ({ pong: true }));

    // Register tools
    ctx.tools.register("calculator", {
      displayName: "Calculator",
      description: "Basic math operations",
      parametersSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" }
        },
        required: ["a", "b"]
      }
    }, async (params) => {
      const { a, b } = params as { a: number; b: number };
      return { content: `Result: ${a + b}`, data: { result: a + b } };
    });
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### Context APIs Available in Worker

| Category | APIs |
|----------|------|
| **Events** | `ctx.events.on()`, `ctx.events.emit()` |
| **Jobs** | `ctx.jobs.register()` for scheduled tasks |
| **State** | `ctx.state.get/set/delete()` |
| **Data** | `ctx.data.register()` for plugin data endpoints |
| **Actions** | `ctx.actions.register()` for user-triggered actions |
| **Tools** | `ctx.tools.register()` for agent-callable tools |
| **HTTP** | `ctx.http.get/post/put/delete()` |
| **Secrets** | `ctx.secrets.get/set()` |
| **Entities** | `ctx.companies`, `ctx.projects`, `ctx.issues`, `ctx.agents` |
| **Logging** | `ctx.logger.info/warn/error/debug()` |

## Creating a New Plugin

### Using the Scaffold Tool (Recommended)

```bash
# Build the scaffold tool
pnpm --filter @titanclipai/create-titanclip-plugin build

# Create a new plugin
node packages/plugins/create-titanclip-plugin/dist/index.js <plugin-name> \
  --output <target-directory>

# Example: Create in examples folder
node packages/plugins/create-titanclip-plugin/dist/index.js @acme/my-plugin \
  --output packages/plugins/examples/ \
  --sdk-path /absolute/path/to/titanclip/packages/plugins/sdk
```

### Generated Structure

```
my-plugin/
├── src/
│   ├── manifest.ts      # Plugin manifest
│   ├── worker.ts        # Worker entry point
│   └── ui/
│       └── index.tsx    # UI components
├── tests/
│   └── plugin.spec.ts   # Plugin tests
├── package.json
└── tsconfig.json
```

### Manifest Configuration

```typescript
// src/manifest.ts
import { defineManifest } from "@paperclipai/plugin-sdk";

export const manifest = defineManifest({
  id: "acme-my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  description: "A TitanClip plugin",
  author: "ACME Corp",
  
  // Entry points
  entrypoints: {
    worker: "dist/worker.js",
    ui: "dist/ui",
  },
  
  // Capabilities (gates worker API access)
  capabilities: [
    "events.subscribe",
    "events.emit",
    "plugin.state.write",
    "jobs.schedule",
  ],
  
  // UI slots
  ui: {
    slots: [
      {
        type: "issue_detail_toolbar",
        id: "my-plugin-toolbar",
        displayName: "My Plugin Toolbar",
        exportName: "MyPluginToolbar",
        entityTypes: ["issue"],
      },
    ],
    launchers: [
      {
        id: "my-plugin-launcher",
        displayName: "Open My Plugin",
        placement: "top_nav",
        exportName: "MyPluginLauncher",
      },
    ],
  },
  
  // Scheduled jobs
  jobs: [
    {
      jobKey: "daily-sync",
      displayName: "Daily Sync",
      schedule: "0 2 * * *", // Daily at 2 AM
    },
  ],
});
```

## Plugin Lifecycle and Events

### Lifecycle Hooks

```typescript
const plugin = definePlugin({
  // Required: Called once at startup
  async setup(ctx) {
    // Register everything here
  },
  
  // Optional: Health check endpoint
  async onHealth() {
    return { status: "ok", message: "Plugin is healthy" };
  },
  
  // Optional: Handle config changes without restart
  async onConfigChanged(newConfig) {
    // Apply new configuration
  },
  
  // Optional: Cleanup before process exit
  async onShutdown() {
    // Clean up resources
  },
  
  // Optional: Validate config in settings UI
  async onValidateConfig(config) {
    return { ok: true, warnings: [], errors: [] };
  },
  
  // Required if webhooks declared
  async onWebhook(input) {
    // Handle webhook request
    return { status: "success" };
  },
});
```

### Event Subscription

```typescript
ctx.events.on("issue.created", async (event) => {
  ctx.logger.info("New issue created", {
    issueId: event.entityId,
    companyId: event.companyId,
  });
});

// With filter (only receive matching events)
ctx.events.on(
  "issue.updated",
  { projectId: "project-123" }, // Filter
  async (event) => {
    // Only receives events for project-123
  }
);

// Emit plugin-scoped events
ctx.events.emit("sync-complete", companyId, { count: 10 });
// Other plugins can subscribe to: plugin.<your-plugin-id>.sync-complete
```

### Core Domain Events

| Event Category | Events |
|----------------|--------|
| **Company** | `company.created`, `company.updated` |
| **Project** | `project.created`, `project.updated`, `project.workspace_created` |
| **Issue** | `issue.created`, `issue.updated`, `issue.comment.created` |
| **Agent** | `agent.created`, `agent.status_changed`, `agent.run.started`, `agent.run.finished` |
| **Goal** | `goal.created`, `goal.updated` |
| **Approval** | `approval.created`, `approval.decided` |
| **Activity** | `activity.logged` |

## UI Components for Plugins

### UI SDK Hooks

```typescript
import { 
  usePluginData, 
  usePluginAction, 
  usePluginStream,
  useHostContext 
} from "@paperclipai/plugin-sdk/ui";
```

### Slot Component Example

```typescript
// src/ui/index.tsx
import React from "react";
import { usePluginData, usePluginAction } from "@paperclipai/plugin-sdk/ui";

interface IssueDetailToolbarProps {
  issue: { id: string; title: string; status: string };
  companyId: string;
}

export function MyPluginToolbar({ issue, companyId }: IssueDetailToolbarProps) {
  const { data, loading, error } = usePluginData("health");
  const { trigger, loading: actionLoading } = usePluginAction("sync-issue");
  
  const handleSync = async () => {
    await trigger({ issueId: issue.id });
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div className="my-plugin-toolbar">
      <button onClick={handleSync} disabled={actionLoading}>
        Sync Issue
      </button>
      <span>Status: {data?.status}</span>
    </div>
  );
}
```

### Available Slot Types

| Slot Type | Location | Purpose |
|-----------|----------|---------|
| `issue_detail_toolbar` | Issue detail page | Actions for specific issue |
| `issue_list_toolbar` | Issue list page | Bulk actions, filters |
| `project_detail_toolbar` | Project detail page | Project-level actions |
| `agent_detail_toolbar` | Agent detail page | Agent configuration |
| `top_nav` | Top navigation bar | Global plugin access |
| `settings_panel` | Settings page | Plugin configuration UI |

## Plugin Distribution

### Development Workflow

```bash
# 1. Build the plugin
pnpm --filter my-plugin build

# 2. Type-check
pnpm --filter my-plugin typecheck

# 3. Test
pnpm --filter my-plugin test

# 4. Install locally in TitanClip
# In TitanClip instance, install from absolute path
curl -X POST "$PAPERCLIP_API_URL/api/companies/$COMPANY_ID/plugins" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"source": "/absolute/path/to/my-plugin"}'
```

### Production Deployment (npm Package)

```bash
# 1. Build for production
pnpm build

# 2. Publish to npm
npm publish --access public

# 3. Install in TitanClip
curl -X POST "$PAPERCLIP_API_URL/api/companies/$COMPANY_ID/plugins" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"source": "@acme/my-plugin@1.0.0"}'
```

### Package.json Configuration

```json
{
  "name": "@acme/my-plugin",
  "version": "1.0.0",
  "main": "dist/worker.js",
  "scripts": {
    "build": "tsc && node build.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Plugin Security Guidelines

### Current Security Model

**Important**: The current plugin runtime does **not** sandbox plugins:

1. **Plugin workers are trusted code** - They have access to capability-gated APIs but run with full privileges
2. **Plugin UI is trusted same-origin code** - Not sandboxed, can call any host API
3. **Manifest capabilities are honor-based** - They gate worker API access but don't enforce UI restrictions

### Best Practices

1. **Minimize capabilities**: Only request capabilities you actually need
2. **Validate all inputs**: Treat data from users and external APIs as untrusted
3. **Use secrets API**: Store sensitive data via `ctx.secrets`, never hardcode
4. **Rate limit external calls**: Implement backoff for external API calls
5. **Log appropriately**: Use structured logging, avoid logging sensitive data
6. **Handle errors gracefully**: Don't expose internal errors to users

### Security Checklist

- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all external data
- [ ] Error messages don't leak internal details
- [ ] HTTPS for all external API calls
- [ ] Rate limiting on user-triggered actions
- [ ] Audit logging for sensitive operations

## Example Plugins

### Simple Event Logger

```typescript
// worker.ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      ctx.logger.info("Issue created", {
        issueId: event.entityId,
        title: event.details?.title,
      });
    });
    
    ctx.events.on("agent.run.finished", async (event) => {
      ctx.logger.info("Agent run completed", {
        runId: event.entityId,
        status: event.details?.status,
      });
    });
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### Scheduled Sync Job

```typescript
// manifest.ts
export const manifest = defineManifest({
  // ... other fields
  capabilities: ["jobs.schedule", "plugin.state.write"],
  jobs: [
    {
      jobKey: "daily-sync",
      displayName: "Daily External Sync",
      schedule: "0 2 * * *", // Daily at 2 AM
    },
  ],
});

// worker.ts
ctx.jobs.register("daily-sync", async (job) => {
  ctx.logger.info("Starting daily sync", { runId: job.runId });
  
  try {
    // Perform sync operation
    const result = await syncExternalSystem();
    
    // Store last sync time
    await ctx.state.set(
      { scopeKind: "instance", stateKey: "last-sync" },
      new Date().toISOString()
    );
    
    ctx.logger.info("Sync completed", { itemsSynced: result.count });
  } catch (error) {
    ctx.logger.error("Sync failed", { error: error.message });
    throw error; // Mark job as failed
  }
});
```

### Custom Tool for Agents

```typescript
// worker.ts
ctx.tools.register("web-search", {
  displayName: "Web Search",
  description: "Search the web for current information",
  parametersSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      numResults: { type: "number", default: 5 }
    },
    required: ["query"]
  }
}, async (params, context) => {
  const { query, numResults = 5 } = params as { query: string; numResults?: number };
  
  const response = await ctx.http.get(`https://api.search.com/search?q=${encodeURIComponent(query)}&limit=${numResults}`);
  
  return {
    content: `Found ${response.results.length} results for "${query}"`,
    data: response.results
  };
});
```

---

## Additional Resources

- [Plugin SDK README](/packages/plugins/sdk/README.md) - Full API reference
- [Plugin Spec](/doc/plugins/PLUGIN_SPEC.md) - Future-looking specification
- [Scaffold Tool](/packages/plugins/create-titanclip-plugin/) - Plugin generator

## Getting Help

For plugin development questions:

1. Check the SDK README for detailed API documentation
2. Review example plugins in `packages/plugins/examples/`
3. Create an issue with plugin development questions
