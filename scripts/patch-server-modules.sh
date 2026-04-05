#!/bin/bash
# Patch server node_modules for production compatibility.
# Fixes ESM/CJS interop issues that prevent the server from starting
# when spawned via Electron's ELECTRON_RUN_AS_NODE.
#
# The @exodus/bytes package is "type": "module" but is require()'d by
# html-encoding-sniffer. Node 20 (Electron 33) can't require() ESM modules.
# Solution: Create CJS wrappers for the required files.

set -e

MODULES_DIR="${1:-/tmp/titanclip-server-modules}"

echo "=== Patching server modules for production ==="

# Fix @exodus/bytes: ESM module that's require()'d by html-encoding-sniffer
BYTES_DIR="$MODULES_DIR/@exodus/bytes"
if [ -d "$BYTES_DIR" ]; then
  echo "  Patching @exodus/bytes (ESM -> CJS wrapper)..."

  # Create CJS wrapper for encoding-lite.js
  cat > "$BYTES_DIR/encoding-lite.cjs" << 'WRAPPER'
// CJS wrapper for ESM module - auto-generated for Electron compatibility
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const path = require('path');

let _mod;
async function load() {
  if (!_mod) {
    const fileUrl = pathToFileURL(path.join(__dirname, 'encoding-lite.js')).href;
    _mod = await import(fileUrl);
  }
  return _mod;
}

// Synchronous fallback: re-export with dynamic import trick
// This works because Node.js caches the module after first load
const mod = require('./fallback/encoding-lite-cjs.js');
module.exports = mod;
WRAPPER

  # Create a proper CJS fallback
  mkdir -p "$BYTES_DIR/fallback"
  cat > "$BYTES_DIR/fallback/encoding-lite-cjs.js" << 'CJS'
"use strict";
// Minimal CJS stub for @exodus/bytes/encoding-lite
// Provides just what html-encoding-sniffer needs: getBOMEncoding, labelToName

function getBOMEncoding(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return "UTF-8";
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) return "UTF-16BE";
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) return "UTF-16LE";
  return null;
}

const ENCODING_LABELS = new Map([
  ["utf-8", "UTF-8"], ["utf8", "UTF-8"], ["unicode-1-1-utf-8", "UTF-8"],
  ["utf-16be", "UTF-16BE"], ["utf-16le", "UTF-16LE"], ["utf-16", "UTF-16LE"],
  ["ascii", "windows-1252"], ["us-ascii", "windows-1252"],
  ["iso-8859-1", "windows-1252"], ["latin1", "windows-1252"],
  ["iso-8859-2", "ISO-8859-2"], ["iso-8859-3", "ISO-8859-3"],
  ["iso-8859-4", "ISO-8859-4"], ["iso-8859-5", "ISO-8859-5"],
  ["iso-8859-6", "ISO-8859-6"], ["iso-8859-7", "ISO-8859-7"],
  ["iso-8859-8", "ISO-8859-8"], ["iso-8859-10", "ISO-8859-10"],
  ["iso-8859-13", "ISO-8859-13"], ["iso-8859-14", "ISO-8859-14"],
  ["iso-8859-15", "ISO-8859-15"], ["iso-8859-16", "ISO-8859-16"],
  ["windows-1250", "windows-1250"], ["windows-1251", "windows-1251"],
  ["windows-1252", "windows-1252"], ["windows-1253", "windows-1253"],
  ["windows-1254", "windows-1254"], ["windows-1255", "windows-1255"],
  ["windows-1256", "windows-1256"], ["windows-1257", "windows-1257"],
  ["windows-1258", "windows-1258"],
  ["euc-jp", "EUC-JP"], ["shift_jis", "Shift_JIS"], ["iso-2022-jp", "ISO-2022-JP"],
  ["euc-kr", "EUC-KR"], ["gb2312", "GBK"], ["gbk", "GBK"], ["gb18030", "gb18030"],
  ["big5", "Big5"],
]);

function labelToName(label) {
  if (typeof label !== "string") return null;
  const normalized = label.trim().toLowerCase();
  return ENCODING_LABELS.get(normalized) || null;
}

module.exports = { getBOMEncoding, labelToName };
CJS

  # Rename to .cjs so Node doesn't treat it as ESM (package.json "type": "module")
  mv "$BYTES_DIR/fallback/encoding-lite-cjs.js" "$BYTES_DIR/fallback/encoding-lite-cjs.cjs" 2>/dev/null || true

  # Replace html-encoding-sniffer entirely with a CJS-compatible version
  SNIFFER="$MODULES_DIR/html-encoding-sniffer/lib/html-encoding-sniffer.js"
  if [ -f "$SNIFFER" ]; then
    echo "  Patching html-encoding-sniffer to use CJS fallback..."
    cat > "$SNIFFER" << 'SNIFFER_PATCH'
"use strict";
// Patched for Electron production: bypass @exodus/bytes ESM package
const path = require("path");
const cjsFallbackPath = path.join(__dirname, "..", "..", "@exodus", "bytes", "fallback", "encoding-lite-cjs.cjs");
const { getBOMEncoding, labelToName } = require(cjsFallbackPath);

function sniffHTMLEncoding(buffer, { transportLayerEncodingLabel, defaultEncoding = "windows-1252" } = {}) {
  let encoding = getBOMEncoding(buffer);
  if (encoding === null && transportLayerEncodingLabel !== undefined) {
    encoding = labelToName(transportLayerEncodingLabel);
  }
  if (encoding === null) {
    const length = Math.min(buffer.length, 1024);
    for (let i = 0; i < length; i++) {
      if (buffer[i] === 0x3C) {
        const slice = buffer.slice(i, Math.min(i + 100, length)).toString("ascii").toLowerCase();
        const m = slice.match(/charset\s*=\s*"?([^\s";>]+)/);
        if (m) { const l = labelToName(m[1]); if (l) { encoding = l; break; } }
      }
    }
  }
  if (encoding === null) encoding = defaultEncoding;
  return encoding;
}
module.exports = sniffHTMLEncoding;
SNIFFER_PATCH
  fi

  echo "  Done!"
else
  echo "  @exodus/bytes not found, skipping"
fi

echo "=== Patching complete ==="
