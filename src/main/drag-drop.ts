/**
 * Native Drag & Drop — enables dragging items from TitanClip to other apps
 * and dropping files into TitanClip.
 *
 * Supports:
 *   - Drag agent configs out as JSON files
 *   - Drag issue details out as markdown files
 *   - Drop files into issue attachments
 *   - Drop images into issue descriptions
 */

import { ipcMain, BrowserWindow, app, nativeImage } from "electron";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

/**
 * Register drag & drop IPC handlers.
 */
export function registerDragDropHandlers(): void {
  // Start a native drag operation from the renderer
  ipcMain.handle(
    "drag:start-drag",
    (event, data: { type: string; content: string; filename: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;

      // Write content to a temp file for the drag operation
      const tempDir = path.join(app.getPath("temp"), "titanclip-drag");
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, data.filename);
      writeFileSync(tempPath, data.content, "utf-8");

      // Start the native drag
      event.sender.startDrag({
        file: tempPath,
        icon: getNativeDragIcon(),
      });
    }
  );

  // Drag an agent config as a JSON file
  ipcMain.handle(
    "drag:agent-config",
    (event, agent: { name: string; config: Record<string, unknown> }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;

      const tempDir = path.join(app.getPath("temp"), "titanclip-drag");
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

      const filename = `${sanitizeFilename(agent.name)}-config.json`;
      const tempPath = path.join(tempDir, filename);
      writeFileSync(tempPath, JSON.stringify(agent.config, null, 2), "utf-8");

      event.sender.startDrag({
        file: tempPath,
        icon: getNativeDragIcon(),
      });
    }
  );

  // Drag issue details as a markdown file
  ipcMain.handle(
    "drag:issue-details",
    (
      event,
      issue: {
        identifier?: string;
        title: string;
        description?: string;
        status: string;
        priority: string;
      }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;

      const tempDir = path.join(app.getPath("temp"), "titanclip-drag");
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

      const markdown = [
        `# ${issue.identifier ? `${issue.identifier}: ` : ""}${issue.title}`,
        "",
        `**Status:** ${issue.status}`,
        `**Priority:** ${issue.priority}`,
        ...(issue.description ? ["", issue.description] : []),
      ].join("\n");

      const filename = `${sanitizeFilename(issue.identifier ?? issue.title)}.md`;
      const tempPath = path.join(tempDir, filename);
      writeFileSync(tempPath, markdown, "utf-8");

      event.sender.startDrag({
        file: tempPath,
        icon: getNativeDragIcon(),
      });
    }
  );
}

/**
 * Get a native drag icon. Uses a small transparent image as the drag icon.
 */
function getNativeDragIcon(): Electron.NativeImage {
  // Create a minimal 1x1 transparent PNG for the drag icon
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB" +
    "Nl7BcQAAAABJRU5ErkJggg==",
    "base64"
  );
  return nativeImage.createFromBuffer(pngBuffer, { scaleFactor: 1.0 });
}

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
