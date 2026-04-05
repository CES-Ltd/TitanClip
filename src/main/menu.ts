import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from "electron";

export function createAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    // ── macOS App Menu ──────────────────────────────────────────────────
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Preferences...",
                accelerator: "CmdOrCtrl+,",
                click: () => sendNavigate(mainWindow, "/instance/settings/general"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),

    // ── File Menu ───────────────────────────────────────────────────────
    {
      label: "File",
      submenu: [
        {
          label: "New Agent...",
          accelerator: "CmdOrCtrl+N",
          click: () => sendNavigate(mainWindow, "/agents/new"),
        },
        {
          label: "New Issue...",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => sendAction(mainWindow, "new-issue"),
        },
        { type: "separator" },
        {
          label: "Import Company...",
          click: () => sendAction(mainWindow, "import-company"),
        },
        {
          label: "Export Company...",
          click: () => sendAction(mainWindow, "export-company"),
        },
        { type: "separator" },
        ...(isMac ? [] : [
          {
            label: "Settings",
            accelerator: "CmdOrCtrl+,",
            click: () => sendNavigate(mainWindow, "/instance/settings/general"),
          },
          { type: "separator" as const },
        ]),
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },

    // ── Edit Menu (CRITICAL for macOS copy/paste) ───────────────────────
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" as const },
              { role: "delete" as const },
              { role: "selectAll" as const },
              { type: "separator" as const },
              {
                label: "Speech",
                submenu: [
                  { role: "startSpeaking" as const },
                  { role: "stopSpeaking" as const },
                ],
              },
            ]
          : [
              { role: "delete" as const },
              { type: "separator" as const },
              { role: "selectAll" as const },
            ]),
      ],
    },

    // ── View Menu ───────────────────────────────────────────────────────
    {
      label: "View",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => sendNavigate(mainWindow, "/dashboard"),
        },
        {
          label: "Agents",
          accelerator: "CmdOrCtrl+2",
          click: () => sendNavigate(mainWindow, "/agents"),
        },
        {
          label: "Issues",
          accelerator: "CmdOrCtrl+3",
          click: () => sendNavigate(mainWindow, "/issues"),
        },
        {
          label: "Projects",
          accelerator: "CmdOrCtrl+4",
          click: () => sendNavigate(mainWindow, "/projects"),
        },
        {
          label: "Costs",
          accelerator: "CmdOrCtrl+5",
          click: () => sendNavigate(mainWindow, "/costs"),
        },
        { type: "separator" },
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+K",
          click: () => sendAction(mainWindow, "open-command-palette"),
        },
        { type: "separator" },
        {
          label: "Activity Log",
          click: () => sendNavigate(mainWindow, "/activity"),
        },
        {
          label: "Approvals",
          click: () => sendNavigate(mainWindow, "/approvals"),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    // ── Window Menu ─────────────────────────────────────────────────────
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },

    // ── Help Menu ───────────────────────────────────────────────────────
    {
      label: "Help",
      submenu: [
        {
          label: "TitanClip Documentation",
          click: () => shell.openExternal("https://docs.titanclip.com"),
        },
        {
          label: "Report an Issue",
          click: () =>
            shell.openExternal(
              "https://github.com/paperclipai/paperclip/issues"
            ),
        },
        { type: "separator" },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function sendNavigate(win: BrowserWindow, path: string): void {
  if (!win.isDestroyed()) {
    win.webContents.send("menu:navigate", path);
  }
}

function sendAction(win: BrowserWindow, action: string): void {
  if (!win.isDestroyed()) {
    win.webContents.send("menu:action", action);
  }
}
