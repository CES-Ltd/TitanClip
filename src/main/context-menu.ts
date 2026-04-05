/**
 * Native Context Menus — provides right-click context menus for the renderer.
 *
 * Handles text editing context menus (cut/copy/paste) and custom
 * entity-specific context menus triggered from the renderer via IPC.
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions, ipcMain, clipboard, shell } from "electron";

/**
 * Register context menu IPC handlers and set up default text context menu.
 */
export function registerContextMenuHandlers(mainWindow: BrowserWindow): void {
  // Default text editing context menu (right-click on any text area)
  mainWindow.webContents.on("context-menu", (_event, params) => {
    const menuTemplate: MenuItemConstructorOptions[] = [];

    // Text editing actions (only show when there's editable text)
    if (params.isEditable) {
      menuTemplate.push(
        { role: "undo", enabled: params.editFlags.canUndo },
        { role: "redo", enabled: params.editFlags.canRedo },
        { type: "separator" },
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { role: "selectAll", enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText) {
      // Non-editable text selected — offer copy
      menuTemplate.push(
        { role: "copy", enabled: params.editFlags.canCopy }
      );
    }

    // Link actions
    if (params.linkURL) {
      if (menuTemplate.length > 0) menuTemplate.push({ type: "separator" });
      menuTemplate.push(
        {
          label: "Copy Link Address",
          click: () => clipboard.writeText(params.linkURL),
        },
        {
          label: "Open in Browser",
          click: () => shell.openExternal(params.linkURL),
        }
      );
    }

    // Spell check suggestions
    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      menuTemplate.unshift(
        ...params.dictionarySuggestions.map((suggestion) => ({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        })),
        { type: "separator" as const }
      );
    }

    // Dev tools in development
    if (!app.isPackaged) {
      if (menuTemplate.length > 0) menuTemplate.push({ type: "separator" });
      menuTemplate.push({
        label: "Inspect Element",
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y);
        },
      });
    }

    if (menuTemplate.length > 0) {
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup();
    }
  });

  // Custom context menus triggered from renderer via IPC
  ipcMain.handle(
    "context-menu:show",
    async (_event, items: Array<{ id: string; label: string; enabled?: boolean }>) => {
      return new Promise<string | null>((resolve) => {
        let resolved = false;
        const safeResolve = (value: string | null) => {
          if (!resolved) {
            resolved = true;
            resolve(value);
          }
        };

        const template: MenuItemConstructorOptions[] = items.map((item) => ({
          label: item.label,
          enabled: item.enabled !== false,
          click: () => safeResolve(item.id),
        }));

        const menu = Menu.buildFromTemplate(template);
        menu.on("menu-will-close", () => {
          setTimeout(() => safeResolve(null), 100);
        });
        menu.popup();
      });
    }
  );
}
