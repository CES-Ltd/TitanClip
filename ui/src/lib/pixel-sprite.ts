/**
 * Procedural pixel-art sprite generator.
 * Creates deterministic character avatars from a seed string + role.
 */

// Seeded PRNG (simple hash-based LCG)
function seedRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(h) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Role-based color palettes: [body, outline, accent, bg]
const ROLE_PALETTES: Record<string, [string, string, string, string]> = {
  ceo:        ["#f59e0b", "#92400e", "#fbbf24", "#451a03"],
  cto:        ["#6366f1", "#312e81", "#818cf8", "#1e1b4b"],
  cmo:        ["#ec4899", "#831843", "#f472b6", "#500724"],
  cfo:        ["#10b981", "#064e3b", "#34d399", "#022c22"],
  engineer:   ["#3b82f6", "#1e3a5f", "#60a5fa", "#172554"],
  designer:   ["#a855f7", "#581c87", "#c084fc", "#3b0764"],
  pm:         ["#8b5cf6", "#4c1d95", "#a78bfa", "#2e1065"],
  qa:         ["#22c55e", "#14532d", "#4ade80", "#052e16"],
  devops:     ["#f97316", "#7c2d12", "#fb923c", "#431407"],
  researcher: ["#06b6d4", "#164e63", "#22d3ee", "#083344"],
  general:    ["#64748b", "#1e293b", "#94a3b8", "#0f172a"],
};

const DEFAULT_PALETTE: [string, string, string, string] = ["#64748b", "#1e293b", "#94a3b8", "#0f172a"];

// Character body template (7 wide x 8 tall, left half + center column)
// 1 = always filled (body), 2 = random fill chance, 0 = always empty
const BODY_TEMPLATE = [
  [0, 0, 2, 1, 2, 0, 0], // head top
  [0, 2, 1, 1, 1, 2, 0], // head
  [0, 2, 1, 1, 1, 2, 0], // face
  [0, 0, 1, 1, 1, 0, 0], // neck
  [0, 2, 1, 1, 1, 2, 0], // shoulders
  [2, 1, 1, 1, 1, 1, 2], // torso
  [0, 2, 1, 1, 1, 2, 0], // waist
  [0, 1, 0, 0, 0, 1, 0], // legs
];

const SPRITE_W = 7;
const SPRITE_H = 8;
const CANVAS_SIZE = 64;
const PIXEL_SIZE = Math.floor(CANVAS_SIZE / Math.max(SPRITE_W, SPRITE_H));
const OFFSET_X = Math.floor((CANVAS_SIZE - SPRITE_W * PIXEL_SIZE) / 2);
const OFFSET_Y = Math.floor((CANVAS_SIZE - SPRITE_H * PIXEL_SIZE) / 2);

// Memoization cache
const spriteCache = new Map<string, string>();

export function generateSprite(seed: string, role: string): string {
  const cacheKey = `${seed}:${role}`;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey)!;

  const rng = seedRng(seed);
  const [body, outline, accent, bg] = ROLE_PALETTES[role] ?? DEFAULT_PALETTE;

  // Generate the sprite grid with symmetry
  const grid: (string | null)[][] = [];
  for (let y = 0; y < SPRITE_H; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < SPRITE_W; x++) {
      const template = BODY_TEMPLATE[y][x];
      // Apply symmetry: mirror from center
      const mirrorX = SPRITE_W - 1 - x;
      const isLeftHalf = x < Math.floor(SPRITE_W / 2);
      const isCenter = x === Math.floor(SPRITE_W / 2);

      if (template === 1) {
        // Always filled — choose body or accent color
        row.push(rng() > 0.7 ? accent : body);
      } else if (template === 2) {
        // Random fill with symmetry
        if (isCenter || isLeftHalf) {
          row.push(rng() > 0.4 ? outline : null);
        } else {
          // Mirror the left side
          row.push(grid[y]?.[mirrorX] ?? null);
        }
      } else {
        row.push(null);
      }
    }
    grid.push(row);
  }

  // Enforce symmetry on the grid
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = Math.ceil(SPRITE_W / 2); x < SPRITE_W; x++) {
      grid[y][x] = grid[y][SPRITE_W - 1 - x];
    }
  }

  // Add eye pixels (row 2, symmetric positions)
  const eyeColor = "#ffffff";
  if (grid[2][2]) grid[2][2] = eyeColor;
  if (grid[2][4]) grid[2][4] = eyeColor;

  // Render to canvas
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Background circle
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw pixels
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const color = grid[y][x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(OFFSET_X + x * PIXEL_SIZE, OFFSET_Y + y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }

  const dataUrl = canvas.toDataURL("image/png");
  spriteCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/** Generate a deterministic 4-digit agent number from a seed */
export function generateAgentNumber(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return 1000 + (Math.abs(h) % 9000); // 1000-9999
}

/** Famous villain character names for Fun Mode agent naming */
export const VILLAIN_NAMES = [
  // Bollywood
  "Mogambo", "Gabbar", "Shakaal", "Bulla", "GoGo", "Kancha",
  "Ranjeet", "Danny", "Gulshan", "Ballu", "Ramadhir", "Sultan",
  "Langda", "Chedi", "Ajgar", "Prem",
  // Hollywood
  "Joker", "Thanos", "Magneto", "Bane", "Loki", "Moriarty",
  "Hannibal", "Vader", "Voldemort", "Krueger", "Pennywise",
  "Sauron", "Ultron", "Scarecrow", "Jigsaw", "Draco",
];

/** Generate a fun mode agent name using a random villain name */
export function generateVillainAgentName(): string {
  const name = VILLAIN_NAMES[Math.floor(Math.random() * VILLAIN_NAMES.length)]!;
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${name}_${num}`;
}
