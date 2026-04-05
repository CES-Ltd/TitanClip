import { useEffect, useRef } from "react";

/**
 * Enterprise Security-themed animation for the TitanClip onboarding panel.
 * Features: floating shield icons, lock symbols, encrypted data streams,
 * hexagonal grid, and security key particles.
 */

const TARGET_FPS = 24;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

// Security-themed ASCII sprites
const SHIELD_SPRITES = [
  [
    "  ╭───╮  ",
    " ╭╯ ✦ ╰╮ ",
    " │ ╭─╮ │ ",
    " │ │✓│ │ ",
    " │ ╰─╯ │ ",
    " ╰╮   ╭╯ ",
    "  ╰─┬─╯  ",
    "    ▼    ",
  ],
  [
    "  ╭───╮  ",
    " ╭╯ ◈ ╰╮ ",
    " │     │ ",
    " │ ◆◇◆ │ ",
    " │     │ ",
    " ╰╮   ╭╯ ",
    "  ╰───╯  ",
    "         ",
  ],
] as const;

const LOCK_SPRITES = [
  [
    " ╭──╮ ",
    " │  │ ",
    "╭╯  ╰╮",
    "│ ●● │",
    "│ ▼  │",
    "╰────╯",
  ],
  [
    "  ┌┐  ",
    " ╭╯╰╮ ",
    " │🔑│ ",
    " ╰──╯ ",
  ],
] as const;

const KEY_SPRITES = [
  [
    "○──┤",
    "   │",
  ],
  [
    "◇━━┥",
  ],
] as const;

type Sprite = readonly string[];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drift: number;
  sprite: Sprite;
  width: number;
  height: number;
  kind: "shield" | "lock" | "key" | "data";
}

// Hex grid chars for background
const HEX_CHARS = [" ", "·", "∙", "⬡", "⬢"] as const;
const DATA_CHARS = "0123456789ABCDEFabcdef";

function measureChar(container: HTMLElement): { w: number; h: number } {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;font-size:11px;font-family:monospace;line-height:1;";
  container.appendChild(span);
  const rect = span.getBoundingClientRect();
  container.removeChild(span);
  return { w: rect.width, h: rect.height };
}

function spriteSize(sprite: Sprite): { width: number; height: number } {
  let width = 0;
  for (const row of sprite) width = Math.max(width, row.length);
  return { width, height: sprite.length };
}

export function AsciiArtAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!preRef.current) return;
    const preEl: HTMLPreElement = preRef.current;
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = document.visibilityState !== "hidden";
    let loopActive = false;
    let lastRenderAt = 0;
    let tick = 0;
    let cols = 0;
    let rows = 0;
    let charW = 7;
    let charH = 11;
    let trail = new Float32Array(0);
    let colWave = new Float32Array(0);
    let rowWave = new Float32Array(0);
    let spriteMask = new Uint16Array(0);
    let particles: Particle[] = [];
    let lastOutput = "";
    // Data stream columns — random hex data flowing down
    let dataColumns: { col: number; speed: number; offset: number; len: number }[] = [];

    function toGlyph(value: number): string {
      const clamped = Math.max(0, Math.min(0.999, value));
      const idx = Math.floor(clamped * HEX_CHARS.length);
      return HEX_CHARS[idx] ?? " ";
    }

    function rebuildGrid() {
      const nextCols = Math.max(0, Math.ceil(preEl.clientWidth / Math.max(1, charW)));
      const nextRows = Math.max(0, Math.ceil(preEl.clientHeight / Math.max(1, charH)));
      if (nextCols === cols && nextRows === rows) return;

      cols = nextCols;
      rows = nextRows;
      const cellCount = cols * rows;
      trail = new Float32Array(cellCount);
      colWave = new Float32Array(cols);
      rowWave = new Float32Array(rows);
      spriteMask = new Uint16Array(cellCount);
      particles = particles.filter((p) =>
        p.x > -p.width - 2 && p.x < cols + 2 && p.y > -p.height - 2 && p.y < rows + 2
      );
      // Reinitialize data streams
      dataColumns = [];
      const streamCount = Math.max(3, Math.floor(cols / 12));
      for (let i = 0; i < streamCount; i++) {
        dataColumns.push({
          col: Math.floor(Math.random() * cols),
          speed: 0.15 + Math.random() * 0.25,
          offset: Math.random() * rows * 2,
          len: 4 + Math.floor(Math.random() * 8),
        });
      }
      lastOutput = "";
    }

    function drawStaticFrame() {
      if (cols <= 0 || rows <= 0) {
        preEl.textContent = "";
        return;
      }
      const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));

      // Hexagonal grid background
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const hexVal = (Math.sin(c * 0.15 + r * 0.08) + Math.cos(r * 0.12 - c * 0.05)) * 0.14 + 0.18;
          grid[r][c] = toGlyph(hexVal);
        }
      }

      // Stamp shields in a pattern
      const gapX = 20;
      const gapY = 14;
      for (let baseRow = 2; baseRow < rows - 9; baseRow += gapY) {
        const startX = Math.floor(baseRow / gapY) % 2 === 0 ? 3 : 13;
        for (let baseCol = startX; baseCol < cols - 10; baseCol += gapX) {
          const sprite = SHIELD_SPRITES[(baseCol + baseRow) % SHIELD_SPRITES.length]!;
          for (let sr = 0; sr < sprite.length; sr++) {
            const line = sprite[sr]!;
            for (let sc = 0; sc < line.length; sc++) {
              const ch = line[sc] ?? " ";
              if (ch === " ") continue;
              const row = baseRow + sr;
              const col = baseCol + sc;
              if (row >= 0 && row < rows && col >= 0 && col < cols) {
                grid[row]![col] = ch;
              }
            }
          }
        }
      }

      const output = grid.map((line) => line.join("")).join("\n");
      preEl.textContent = output;
      lastOutput = output;
    }

    function spawnParticle() {
      const kindRoll = Math.random();
      let sprite: Sprite;
      let kind: Particle["kind"];

      if (kindRoll < 0.45) {
        sprite = SHIELD_SPRITES[Math.floor(Math.random() * SHIELD_SPRITES.length)]!;
        kind = "shield";
      } else if (kindRoll < 0.7) {
        sprite = LOCK_SPRITES[Math.floor(Math.random() * LOCK_SPRITES.length)]!;
        kind = "lock";
      } else if (kindRoll < 0.85) {
        sprite = KEY_SPRITES[Math.floor(Math.random() * KEY_SPRITES.length)]!;
        kind = "key";
      } else {
        // Data fragment — a short hex string
        const len = 3 + Math.floor(Math.random() * 5);
        let frag = "";
        for (let i = 0; i < len; i++) frag += DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)];
        sprite = [frag];
        kind = "data";
      }

      const size = spriteSize(sprite);
      const edge = Math.random();
      let x = 0, y = 0, vx = 0, vy = 0;

      if (edge < 0.6) {
        x = Math.random() < 0.5 ? -size.width - 1 : cols + 1;
        y = Math.random() * Math.max(1, rows - size.height);
        vx = x < 0 ? 0.03 + Math.random() * 0.04 : -(0.03 + Math.random() * 0.04);
        vy = (Math.random() - 0.5) * 0.01;
      } else {
        x = Math.random() * Math.max(1, cols - size.width);
        y = Math.random() < 0.5 ? -size.height - 1 : rows + 1;
        vx = (Math.random() - 0.5) * 0.01;
        vy = y < 0 ? 0.02 + Math.random() * 0.03 : -(0.02 + Math.random() * 0.03);
      }

      particles.push({
        x, y, vx, vy,
        life: 0,
        maxLife: 300 + Math.random() * 250,
        drift: (Math.random() - 0.5) * 1.0,
        sprite, width: size.width, height: size.height, kind,
      });
    }

    function stampParticle(p: Particle, alpha: number) {
      const baseCol = Math.round(p.x);
      const baseRow = Math.round(p.y);
      for (let sr = 0; sr < p.sprite.length; sr++) {
        const line = p.sprite[sr]!;
        const row = baseRow + sr;
        if (row < 0 || row >= rows) continue;
        for (let sc = 0; sc < line.length; sc++) {
          const ch = line[sc] ?? " ";
          if (ch === " ") continue;
          const col = baseCol + sc;
          if (col < 0 || col >= cols) continue;
          const idx = row * cols + col;
          const intensity = ch === "│" || ch === "─" || ch === "━" ? 0.75 : 0.9;
          trail[idx] = Math.max(trail[idx] ?? 0, alpha * intensity);
          spriteMask[idx] = ch.charCodeAt(0);
        }
      }
    }

    function step(time: number) {
      if (!loopActive) return;
      frameRef.current = requestAnimationFrame(step);
      if (time - lastRenderAt < FRAME_INTERVAL_MS || cols <= 0 || rows <= 0) return;

      const delta = Math.min(2, lastRenderAt === 0 ? 1 : (time - lastRenderAt) / 16.6667);
      lastRenderAt = time;
      tick += delta;

      const cellCount = cols * rows;
      const targetCount = Math.max(4, Math.floor(cellCount / 1800));
      while (particles.length < targetCount) spawnParticle();

      // Decay trails
      for (let i = 0; i < trail.length; i++) trail[i] *= 0.93;
      spriteMask.fill(0);

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.life += delta;

        const wobbleX = Math.sin((p.y + p.drift + tick * 0.1) * 0.07) * 0.0015;
        const wobbleY = Math.cos((p.x - p.drift - tick * 0.08) * 0.06) * 0.001;
        p.vx = (p.vx + wobbleX) * 0.998;
        p.vy = (p.vy + wobbleY) * 0.998;
        p.x += p.vx * delta;
        p.y += p.vy * delta;

        if (p.life >= p.maxLife || p.x < -p.width - 2 || p.x > cols + 2 || p.y < -p.height - 2 || p.y > rows + 2) {
          particles.splice(i, 1);
          continue;
        }

        const life = p.life / p.maxLife;
        const alpha = life < 0.1 ? life / 0.1 : life > 0.9 ? (1 - life) / 0.1 : 1;
        stampParticle(p, alpha);
      }

      // Waves
      for (let c = 0; c < cols; c++) colWave[c] = Math.sin(c * 0.06 + tick * 0.04);
      for (let r = 0; r < rows; r++) rowWave[r] = Math.cos(r * 0.08 - tick * 0.035);

      // Render
      let output = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const maskChar = spriteMask[idx];
          if (maskChar > 0) {
            output += String.fromCharCode(maskChar);
            continue;
          }

          // Data stream overlay
          let isDataStream = false;
          for (const ds of dataColumns) {
            if (c === ds.col) {
              const streamPos = (r + ds.offset + tick * ds.speed) % (rows + ds.len);
              if (streamPos >= 0 && streamPos < ds.len) {
                const streamAlpha = streamPos < 1 ? streamPos : streamPos > ds.len - 1 ? ds.len - streamPos : 1;
                if (streamAlpha > 0.3) {
                  output += DATA_CHARS[Math.floor((tick * 3 + r * 7 + c) % DATA_CHARS.length)];
                  isDataStream = true;
                  break;
                }
              }
            }
          }
          if (isDataStream) continue;

          // Hexagonal grid background with waves
          const ambient = (colWave[c] + rowWave[r]) * 0.06 + 0.08;
          const intensity = Math.max(trail[idx] ?? 0, ambient * 0.4);
          output += toGlyph(intensity);
        }
        if (r < rows - 1) output += "\n";
      }

      if (output !== lastOutput) {
        preEl.textContent = output;
        lastOutput = output;
      }
    }

    function syncLoop() {
      const canRender = cols > 0 && rows > 0;
      if (motionMedia.matches) {
        if (loopActive) {
          loopActive = false;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        if (canRender) drawStaticFrame();
        return;
      }
      if (!isVisible || !canRender) {
        if (loopActive) {
          loopActive = false;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        return;
      }
      if (!loopActive) {
        loopActive = true;
        lastRenderAt = 0;
        frameRef.current = requestAnimationFrame(step);
      }
    }

    const observer = new ResizeObserver(() => {
      const size = measureChar(preEl);
      charW = size.w;
      charH = size.h;
      rebuildGrid();
      syncLoop();
    });
    observer.observe(preEl);

    const onVisibilityChange = () => {
      isVisible = document.visibilityState !== "hidden";
      syncLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onMotionChange = () => syncLoop();
    motionMedia.addEventListener("change", onMotionChange);

    const charSize = measureChar(preEl);
    charW = charSize.w;
    charH = charSize.h;
    rebuildGrid();
    syncLoop();

    return () => {
      loopActive = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMedia.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <pre
      ref={preRef}
      className="w-full h-full m-0 p-0 overflow-hidden text-emerald-500/40 select-none leading-none"
      style={{ fontSize: "11px", fontFamily: "monospace" }}
      aria-hidden="true"
    />
  );
}
