# IPC Channel Reference

## Overview

ZeusClip uses Electron IPC for all communication between the main process and renderer. The full type definitions are in `packages/shared/src/ipc-channels.ts`.

## Core Channels (Main Process)

| Channel | Args | Result | Description |
|---------|------|--------|-------------|
| `app:get-version` | void | string | App version |
| `app:get-platform` | void | string | "darwin", "win32", "linux" |
| `app:get-locale` | void | string | System locale |
| `app:get-path` | string | string | Electron app path |
| `app:quit` | void | void | Quit the app |
| `shell:open-external` | string | void | Open URL in browser |
| `shell:show-item-in-folder` | string | void | Reveal file in Finder |
| `nav:back` | void | void | Browser history back |
| `nav:forward` | void | void | Browser history forward |
| `nav:can-go-back` | void | boolean | Can navigate back |
| `nav:can-go-forward` | void | boolean | Can navigate forward |
| `theme:set` | "dark" \| "light" | void | Update title bar overlay |

## Native Feature Channels

| Channel | Args | Result | Description |
|---------|------|--------|-------------|
| `dialog:open-file` | OpenDialogOptions | { canceled, filePaths } | Native file picker |
| `dialog:save-file` | SaveDialogOptions | { canceled, filePath } | Native save dialog |
| `dialog:message-box` | MessageBoxOptions | { response } | Native message box |
| `notification:show` | { title, body, navigateTo?, urgency? } | void | OS notification |
| `tray:set-tooltip` | string | void | Update tray tooltip |
| `tray:set-badge` | number | void | Set dock badge count |
| `clipboard:read-text` | void | string | Read clipboard |
| `clipboard:write-text` | string | void | Write to clipboard |
| `clipboard:read-image` | void | { dataUrl, size } \| null | Read clipboard image |
| `clipboard:copy-issue-markdown` | issue object | void | Copy issue as markdown |
| `clipboard:copy-agent-config` | config object | void | Copy config as JSON |
| `context-menu:show` | items[] | string \| null | Show native context menu |
| `dock:set-progress` | number, mode? | void | Set dock progress |

## Push Events (Main → Renderer)

| Event | Payload | Description |
|-------|---------|-------------|
| `menu:navigate` | string (path) | Navigate to a route |
| `menu:action` | string (action) | Trigger a UI action |
| `live:event` | LiveEvent | Real-time update |
| `updater:downloading` | string (version) | Update downloading |
| `adapter:log` | { pid, runId, stream, data } | Adapter process output |
| `adapter:exit` | { pid, runId, exitCode, signal } | Adapter process exited |

## Business Logic Channels (296 URL→IPC patterns)

The full list of API routes mapped to IPC channels is in `ui/src/api/client.ts`. Key domains:

### Companies
`companies:list`, `companies:get`, `companies:create`, `companies:update`, `companies:delete`, `companies:export`, `companies:import`

### Agents
`agents:list`, `agents:get`, `agents:create`, `agents:hire`, `agents:update`, `agents:pause`, `agents:resume`, `agents:terminate`, `agents:delete`, `agents:wakeup`, `agents:get-configuration`, `agents:get-config-revisions`, `agents:get-instructions-bundle`, `agents:update-permissions`, `agents:list-keys`, `agents:create-key`, `agents:get-skills`, `agents:sync-skills`, `agents:get-runtime-state`, `agents:reset-session`

### Issues
`issues:list`, `issues:get`, `issues:create`, `issues:update`, `issues:checkout`, `issues:delete`, `issues:add-comment`, `issues:list-documents`, `issues:upsert-document`, `issues:create-work-product`, `issues:mark-read`, `issues:archive-from-inbox`, `issues:release`

### Projects
`projects:list`, `projects:get`, `projects:create`, `projects:update`, `projects:delete`, `projects:list-workspaces`, `projects:create-workspace`

### Goals
`goals:list`, `goals:get`, `goals:create`, `goals:update`, `goals:delete`

### Approvals
`approvals:list`, `approvals:get`, `approvals:create`, `approvals:resolve`, `approvals:request-revision`, `approvals:resubmit`, `approvals:add-comment`

### Routines
`routines:list`, `routines:get`, `routines:create`, `routines:update`, `routines:run`, `routines:list-runs`, `routines:create-trigger`

### Costs & Finance
`costs:summary`, `costs:by-agent`, `costs:by-provider`, `costs:by-project`, `costs:finance-summary`, `costs:window-spend`, `budgets:overview`, `budgets:upsert-policy`

### Dashboard & Activity
`dashboard:summary`, `activity:list`, `sidebar-badges:get`, `heartbeat-runs:list`, `heartbeat-runs:get`, `heartbeat-runs:cancel`

### Instance Settings
`instance:get-general-settings`, `instance:patch-general-settings`, `instance:get-experimental-settings`, `instance:get-admin-settings`

### SLA & Escalation
`sla:list-policies`, `sla:create-policy`, `sla:update-policy`, `sla:dashboard`, `sla:list-tracking`, `sla:start-tracking`, `escalation:list-rules`, `escalation:create-rule`

### Dependencies & Workflows
`dependencies:list`, `dependencies:create`, `dependencies:delete`, `dependencies:critical-path`, `workflows:list`, `workflows:get`, `workflows:create`, `workflows:update`, `workflows:execute`

### Plugins
`plugins:list`, `plugins:get`, `plugins:install`, `plugins:uninstall`, `plugins:enable`, `plugins:disable`, `plugins:health`, `plugins:ui-contributions`, `plugins:get-data`, `plugins:perform-action`
