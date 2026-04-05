#!/usr/bin/env tsx
/**
 * Auto-generate SQLite schema files from PostgreSQL schema files.
 *
 * Converts:
 *   - pgTable → sqliteTable
 *   - uuid → text
 *   - jsonb → text
 *   - timestamp → text
 *   - boolean → integer (with mode: "boolean")
 *   - serial → integer
 *   - .defaultRandom() → .$defaultFn(() => crypto.randomUUID())
 *   - .defaultNow() → .$defaultFn(() => new Date().toISOString())
 *   - type AnyPgColumn → type AnySQLiteColumn
 *   - uniqueIndex → uniqueIndex (same)
 *   - index → index (same)
 *
 * Usage: tsx packages/db/src/generate-sqlite-schema.ts
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const PG_SCHEMA_DIR = join(import.meta.dirname ?? __dirname, "schema");
const SQLITE_SCHEMA_DIR = join(import.meta.dirname ?? __dirname, "schema-sqlite");

// Ensure output directory exists
if (!existsSync(SQLITE_SCHEMA_DIR)) {
  mkdirSync(SQLITE_SCHEMA_DIR, { recursive: true });
}

const files = readdirSync(PG_SCHEMA_DIR).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts"
);

let converted = 0;
let skipped = 0;

for (const file of files) {
  const inputPath = join(PG_SCHEMA_DIR, file);
  const outputPath = join(SQLITE_SCHEMA_DIR, file);

  let content = readFileSync(inputPath, "utf-8");

  // ── Transform imports ─────────────────────────────────────────────
  // Replace pg-core imports with sqlite-core
  content = content.replace(
    /from\s+["']drizzle-orm\/pg-core["']/g,
    'from "drizzle-orm/sqlite-core"'
  );

  // Replace type AnyPgColumn with AnySQLiteColumn
  content = content.replace(/AnyPgColumn/g, "AnySQLiteColumn");

  // Replace pgTable with sqliteTable
  content = content.replace(/\bpgTable\b/g, "sqliteTable");

  // ── Transform column types ────────────────────────────────────────

  // uuid("name") → text("name")
  // Handle uuid with chaining like .primaryKey().defaultRandom()
  content = content.replace(/\buuid\("([^"]+)"\)/g, 'text("$1")');

  // .defaultRandom() → .$defaultFn(() => crypto.randomUUID())
  content = content.replace(
    /\.defaultRandom\(\)/g,
    '.$defaultFn(() => crypto.randomUUID())'
  );

  // jsonb("name") → text("name")
  // Note: .$type<T>() can stay since it's a TypeScript-only annotation
  content = content.replace(/\bjsonb\("([^"]+)"\)/g, 'text("$1")');

  // timestamp("name", { withTimezone: true }) → text("name")
  // timestamp("name") → text("name")
  content = content.replace(
    /\btimestamp\("([^"]+)"(?:,\s*\{[^}]*\})?\)/g,
    'text("$1")'
  );

  // .defaultNow() → .$defaultFn(() => new Date().toISOString())
  content = content.replace(
    /\.defaultNow\(\)/g,
    '.$defaultFn(() => new Date().toISOString())'
  );

  // boolean("name") → integer("name", { mode: "boolean" })
  content = content.replace(
    /\bboolean\("([^"]+)"\)/g,
    'integer("$1", { mode: "boolean" })'
  );

  // serial("name") → integer("name") (SQLite autoincrement is via primaryKey)
  content = content.replace(/\bserial\("([^"]+)"\)/g, 'integer("$1")');

  // Remove { onDelete: "..." } from references (SQLite handles this differently)
  // Actually SQLite DOES support onDelete, so keep it

  // Handle partial indexes with .where() — SQLite supports these since 3.15.0
  // No change needed for basic partial indexes

  // ── Add crypto import if defaultRandom was used ───────────────────
  if (content.includes("crypto.randomUUID()") && !content.includes('import crypto')) {
    // crypto is a global in Node.js 19+, no import needed
    // But add a note
  }

  // ── Remove imports that are no longer used ────────────────────────
  // Remove 'uuid' from import list since we replaced it with 'text'
  // But text might already be imported, so just ensure no duplicate imports
  // Remove uuid from import destructuring
  content = content.replace(
    /(\bimport\s*\{[^}]*)\buuid\b,?\s*/g,
    (match, prefix) => {
      // Remove uuid from the import list, handling trailing commas
      return prefix;
    }
  );

  // Clean up double commas from removed imports
  content = content.replace(/,\s*,/g, ",");
  // Clean up leading commas after {
  content = content.replace(/\{\s*,/g, "{");
  // Clean up trailing commas before }
  content = content.replace(/,\s*\}/g, " }");

  // ── Fix sql import ────────────────────────────────────────────────
  // drizzle-orm sql works the same for both PG and SQLite

  // ── Write output ──────────────────────────────────────────────────
  writeFileSync(outputPath, content, "utf-8");
  converted++;
  console.log(`  Converted: ${file}`);
}

console.log(`\nDone! Converted ${converted} schema files, skipped ${skipped}`);
console.log(`Output: ${SQLITE_SCHEMA_DIR}`);
