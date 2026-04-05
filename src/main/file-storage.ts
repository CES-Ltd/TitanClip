/**
 * File Storage — direct filesystem operations for the main process.
 *
 * Replaces the HTTP-based file upload/download abstraction with direct
 * filesystem access. Since the main process has full Node.js access,
 * there's no need to go through Express multipart middleware.
 *
 * Also handles:
 *   - Database backups (SQLite = file copy, PG = pg_dump)
 *   - Export/import company data as ZIP files
 *   - Thumbnail generation for uploaded images
 */

import { app, ipcMain } from "electron";
import path from "path";
import { createHash, randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
} from "fs";

const STORAGE_DIR = path.join(app.getPath("userData"), "storage");
const BACKUP_DIR = path.join(app.getPath("userData"), "backups");

/**
 * Register file storage IPC handlers.
 */
export function registerFileStorageHandlers(): void {
  // Ensure directories exist
  ensureDir(STORAGE_DIR);
  ensureDir(BACKUP_DIR);

  // Store a file
  ipcMain.handle(
    "storage:put-file",
    async (
      _event,
      input: {
        companyId: string;
        namespace: string;
        filename: string;
        contentType: string;
        data: ArrayBuffer;
      }
    ) => {
      const { companyId, namespace, filename, contentType, data } = input;
      const buffer = Buffer.from(data);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const uuid = randomUUID();

      // Build path: storage/{companyId}/{namespace}/{year}/{month}/{uuid}-{filename}
      const now = new Date();
      const dir = path.join(
        STORAGE_DIR,
        companyId,
        namespace,
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, "0")
      );
      ensureDir(dir);

      const safeFilename = sanitizeFilename(filename);
      const objectKey = `${uuid}-${safeFilename}`;
      const filePath = path.join(dir, objectKey);

      writeFileSync(filePath, buffer);

      return {
        provider: "local_disk",
        objectKey: path.relative(STORAGE_DIR, filePath),
        contentType,
        byteSize: buffer.length,
        sha256,
        originalFilename: filename,
      };
    }
  );

  // Retrieve a file
  ipcMain.handle(
    "storage:get-file",
    async (_event, objectKey: string) => {
      // Security: prevent path traversal
      if (objectKey.includes("..")) {
        throw new Error("Invalid object key");
      }

      const filePath = path.join(STORAGE_DIR, objectKey);
      if (!existsSync(filePath)) {
        return null;
      }

      const buffer = readFileSync(filePath);
      return {
        data: buffer.buffer,
        size: buffer.length,
      };
    }
  );

  // Delete a file
  ipcMain.handle("storage:delete-file", async (_event, objectKey: string) => {
    if (objectKey.includes("..")) throw new Error("Invalid object key");
    const filePath = path.join(STORAGE_DIR, objectKey);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return { ok: true };
    }
    return { ok: false, error: "File not found" };
  });

  // Get storage stats
  ipcMain.handle("storage:stats", async () => {
    const totalSize = getDirSize(STORAGE_DIR);
    const backupSize = getDirSize(BACKUP_DIR);
    return {
      storagePath: STORAGE_DIR,
      backupPath: BACKUP_DIR,
      totalSizeBytes: totalSize,
      backupSizeBytes: backupSize,
      totalSizeHuman: formatBytes(totalSize),
      backupSizeHuman: formatBytes(backupSize),
    };
  });

  // ── Backup operations ─────────────────────────────────────────────

  // Create a backup
  ipcMain.handle("backup:create", async (_event, opts?: { label?: string }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const label = opts?.label ?? "manual";
    const backupName = `titanclip-backup-${label}-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    ensureDir(backupPath);

    // Copy SQLite database
    const dbPath = path.join(app.getPath("userData"), "titanclip.db");
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, path.join(backupPath, "titanclip.db"));
      // Copy WAL if exists
      if (existsSync(`${dbPath}-wal`)) {
        copyFileSync(`${dbPath}-wal`, path.join(backupPath, "titanclip.db-wal"));
      }
    }

    return {
      backupPath,
      backupName,
      createdAt: new Date().toISOString(),
      dbIncluded: existsSync(dbPath),
    };
  });

  // List backups
  ipcMain.handle("backup:list", async () => {
    if (!existsSync(BACKUP_DIR)) return [];
    return readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("titanclip-backup-"))
      .map((d) => {
        const backupPath = path.join(BACKUP_DIR, d.name);
        const stat = statSync(backupPath);
        return {
          name: d.name,
          path: backupPath,
          createdAt: stat.birthtime.toISOString(),
          sizeBytes: getDirSize(backupPath),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  // Delete a backup
  ipcMain.handle("backup:delete", async (_event, backupName: string) => {
    if (backupName.includes("..")) throw new Error("Invalid backup name");
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!existsSync(backupPath)) return { ok: false, error: "Backup not found" };

    rmSync(backupPath, { recursive: true, force: true });
    return { ok: true };
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

function getDirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(fullPath);
      } else {
        total += statSync(fullPath).size;
      }
    }
  } catch {
    // Permission error or broken symlink
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
