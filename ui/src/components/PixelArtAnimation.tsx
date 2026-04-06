import { useEffect, useRef, useState } from "react";
import { VILLAIN_SPRITES, type PixelArtSprite } from "../data/pixel-art-villains";

const SWITCH_INTERVAL_MS = 9000;
const TRANSITION_DURATION_MS = 1200;
const PIXEL_GAP = 1;
const SCANLINE_ALPHA = 0.08;

interface Pixel {
  /** Target grid position */
  tx: number;
  ty: number;
  /** Current animated position */
  cx: number;
  cy: number;
  /** Scatter origin */
  sx: number;
  sy: number;
  color: string;
  delay: number;
}

function buildPixels(sprite: PixelArtSprite, cellSize: number, offsetX: number, offsetY: number): Pixel[] {
  const pixels: Pixel[] = [];
  for (let r = 0; r < sprite.grid.length; r++) {
    const row = sprite.grid[r]!;
    for (let c = 0; c < row.length; c++) {
      const idx = row[c]!;
      if (idx === 0) continue;
      const color = sprite.palette[idx] ?? "#888";
      const tx = offsetX + c * (cellSize + PIXEL_GAP);
      const ty = offsetY + r * (cellSize + PIXEL_GAP);
      pixels.push({
        tx, ty,
        cx: tx, cy: ty,
        sx: tx + (Math.random() - 0.5) * 400,
        sy: ty + (Math.random() - 0.5) * 400,
        color,
        delay: Math.random() * 0.4,
      });
    }
  }
  return pixels;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function PixelArtAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.floor(Math.random() * VILLAIN_SPRITES.length)
  );
  const [tagline, setTagline] = useState(VILLAIN_SPRITES[currentIndex]?.tagline ?? "");
  const animStateRef = useRef<{
    pixels: Pixel[];
    phase: "idle" | "scatter-out" | "scatter-in";
    phaseStart: number;
    nextIndex: number;
  }>({ pixels: [], phase: "idle", phaseStart: 0, nextIndex: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let switchTimer: ReturnType<typeof setInterval>;
    const state = animStateRef.current;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildCurrentSprite();
    }

    function rebuildCurrentSprite() {
      const rect = canvas!.getBoundingClientRect();
      const sprite = VILLAIN_SPRITES[currentIndex]!;
      const gridW = sprite.grid[0]?.length ?? 16;
      const gridH = sprite.grid.length;
      const maxCellW = (rect.width - (gridW - 1) * PIXEL_GAP) / gridW;
      const maxCellH = ((rect.height * 0.75) - (gridH - 1) * PIXEL_GAP) / gridH;
      const cellSize = Math.floor(Math.min(maxCellW, maxCellH));
      const totalW = gridW * (cellSize + PIXEL_GAP) - PIXEL_GAP;
      const totalH = gridH * (cellSize + PIXEL_GAP) - PIXEL_GAP;
      const offsetX = (rect.width - totalW) / 2;
      const offsetY = (rect.height * 0.75 - totalH) / 2;
      state.pixels = buildPixels(sprite, cellSize, offsetX, offsetY);
    }

    function startTransition() {
      const next = (currentIndex + 1 + Math.floor(Math.random() * (VILLAIN_SPRITES.length - 1))) % VILLAIN_SPRITES.length;
      state.nextIndex = next;
      state.phase = "scatter-out";
      state.phaseStart = performance.now();
    }

    function draw(time: number) {
      raf = requestAnimationFrame(draw);
      const rect = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, rect.width, rect.height);

      const halfDuration = TRANSITION_DURATION_MS / 2;

      if (state.phase === "scatter-out") {
        const elapsed = time - state.phaseStart;
        const progress = Math.min(1, elapsed / halfDuration);
        for (const p of state.pixels) {
          const t = easeOutCubic(Math.min(1, Math.max(0, (progress - p.delay) / (1 - p.delay))));
          p.cx = p.tx + (p.sx - p.tx) * t;
          p.cy = p.ty + (p.sy - p.ty) * t;
        }
        if (progress >= 1) {
          // Switch sprite
          const sprite = VILLAIN_SPRITES[state.nextIndex]!;
          const gridW = sprite.grid[0]?.length ?? 16;
          const gridH = sprite.grid.length;
          const maxCellW = (rect.width - (gridW - 1) * PIXEL_GAP) / gridW;
          const maxCellH = ((rect.height * 0.75) - (gridH - 1) * PIXEL_GAP) / gridH;
          const cellSize = Math.floor(Math.min(maxCellW, maxCellH));
          const totalW = gridW * (cellSize + PIXEL_GAP) - PIXEL_GAP;
          const totalH = gridH * (cellSize + PIXEL_GAP) - PIXEL_GAP;
          const offsetX = (rect.width - totalW) / 2;
          const offsetY = (rect.height * 0.75 - totalH) / 2;
          state.pixels = buildPixels(sprite, cellSize, offsetX, offsetY);
          // Scatter positions for incoming
          for (const p of state.pixels) {
            p.sx = p.tx + (Math.random() - 0.5) * 400;
            p.sy = p.ty + (Math.random() - 0.5) * 400;
            p.cx = p.sx;
            p.cy = p.sy;
            p.delay = Math.random() * 0.4;
          }
          state.phase = "scatter-in";
          state.phaseStart = time;
          setCurrentIndex(state.nextIndex);
          setTagline(sprite.tagline);
        }
      } else if (state.phase === "scatter-in") {
        const elapsed = time - state.phaseStart;
        const progress = Math.min(1, elapsed / halfDuration);
        for (const p of state.pixels) {
          const t = easeOutCubic(Math.min(1, Math.max(0, (progress - p.delay) / (1 - p.delay))));
          p.cx = p.sx + (p.tx - p.sx) * t;
          p.cy = p.sy + (p.ty - p.sy) * t;
        }
        if (progress >= 1) {
          state.phase = "idle";
        }
      } else {
        // Idle — subtle breathing
        const breathe = Math.sin(time * 0.002) * 2;
        for (const p of state.pixels) {
          p.cx = p.tx;
          p.cy = p.ty + breathe;
        }
      }

      // Compute cell size from first two pixels
      let cellSize = 12;
      if (state.pixels.length >= 2) {
        const p0 = state.pixels[0]!;
        const p1 = state.pixels.find(pp => pp.tx !== p0.tx);
        if (p1) cellSize = Math.abs(p1.tx - p0.tx) - PIXEL_GAP;
      }

      // Draw pixels
      for (const p of state.pixels) {
        ctx!.fillStyle = p.color;
        ctx!.fillRect(Math.round(p.cx), Math.round(p.cy), cellSize, cellSize);
      }

      // CRT scanlines
      ctx!.fillStyle = `rgba(0,0,0,${SCANLINE_ALPHA})`;
      for (let y = 0; y < rect.height; y += 3) {
        ctx!.fillRect(0, y, rect.width, 1);
      }
    }

    resize();
    raf = requestAnimationFrame(draw);
    switchTimer = setInterval(startTransition, SWITCH_INTERVAL_MS);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(switchTimer);
      resizeObserver.disconnect();
    };
  }, [currentIndex]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative">
      <canvas
        ref={canvasRef}
        className="w-full flex-1 min-h-0"
        aria-hidden="true"
      />
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p
          className="text-sm font-bold tracking-wide text-emerald-400/80 drop-shadow-lg"
          style={{ fontFamily: "monospace", textShadow: "0 0 12px rgba(52,211,153,0.3)" }}
        >
          {tagline}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
          {VILLAIN_SPRITES[currentIndex]?.name}
        </p>
      </div>
    </div>
  );
}
