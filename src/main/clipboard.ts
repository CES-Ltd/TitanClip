/**
 * Clipboard Integration — native clipboard operations for the renderer.
 *
 * Provides IPC handlers for:
 *   - Reading/writing text and HTML to clipboard
 *   - Reading images from clipboard (for pasting screenshots into issues)
 *   - Copying structured data (agent configs, issue details as markdown)
 */

import { clipboard, ipcMain, nativeImage } from "electron";

/**
 * Register clipboard IPC handlers.
 */
export function registerClipboardHandlers(): void {
  // Read text from clipboard
  ipcMain.handle("clipboard:read-text", () => {
    return clipboard.readText();
  });

  // Write text to clipboard
  ipcMain.handle("clipboard:write-text", (_event, text: string) => {
    clipboard.writeText(text);
  });

  // Read HTML from clipboard
  ipcMain.handle("clipboard:read-html", () => {
    return clipboard.readHTML();
  });

  // Write HTML to clipboard (also sets plain text fallback)
  ipcMain.handle(
    "clipboard:write-html",
    (_event, html: string, plainText?: string) => {
      clipboard.write({
        html,
        text: plainText ?? html.replace(/<[^>]*>/g, ""),
      });
    }
  );

  // Check if clipboard has an image
  ipcMain.handle("clipboard:has-image", () => {
    const image = clipboard.readImage();
    return !image.isEmpty();
  });

  // Read image from clipboard as data URL (for pasting screenshots)
  ipcMain.handle("clipboard:read-image", () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;

    return {
      dataUrl: image.toDataURL(),
      size: image.getSize(),
      buffer: image.toPNG(),
    };
  });

  // Write rich content (markdown + HTML + plain text)
  ipcMain.handle(
    "clipboard:write-rich",
    (
      _event,
      content: { text?: string; html?: string; markdown?: string }
    ) => {
      const writeData: Electron.Data = {};
      if (content.text) writeData.text = content.text;
      if (content.html) writeData.html = content.html;
      // Markdown goes as plain text if no separate text provided
      if (content.markdown && !content.text) {
        writeData.text = content.markdown;
      }
      clipboard.write(writeData);
    }
  );

  // Copy issue details as markdown
  ipcMain.handle(
    "clipboard:copy-issue-markdown",
    (
      _event,
      issue: {
        identifier?: string;
        title: string;
        status: string;
        priority: string;
        description?: string;
        assignee?: string;
      }
    ) => {
      const lines: string[] = [];
      if (issue.identifier) {
        lines.push(`# ${issue.identifier}: ${issue.title}`);
      } else {
        lines.push(`# ${issue.title}`);
      }
      lines.push("");
      lines.push(`**Status:** ${issue.status}`);
      lines.push(`**Priority:** ${issue.priority}`);
      if (issue.assignee) lines.push(`**Assignee:** ${issue.assignee}`);
      if (issue.description) {
        lines.push("");
        lines.push(issue.description);
      }

      const markdown = lines.join("\n");
      clipboard.write({
        text: markdown,
        html: `<h1>${issue.identifier ? `${issue.identifier}: ` : ""}${issue.title}</h1><p><b>Status:</b> ${issue.status} | <b>Priority:</b> ${issue.priority}</p>${issue.description ? `<p>${issue.description}</p>` : ""}`,
      });
    }
  );

  // Copy agent config as JSON
  ipcMain.handle(
    "clipboard:copy-agent-config",
    (_event, config: Record<string, unknown>) => {
      const json = JSON.stringify(config, null, 2);
      clipboard.writeText(json);
    }
  );
}
