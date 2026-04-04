export interface OfficeMapData {
  width: number;
  height: number;
  tileSize: number;
  spawnX: number;
  spawnY: number;
  deskPositions: DeskPosition[];
  waypoints: Waypoint[];
  walls: { top: number; bottom: number; left: number; right: number };
}

export interface DeskPosition {
  index: number;
  x: number;
  y: number;
}

export interface Waypoint {
  name: string;
  x: number;
  y: number;
}

export type AgentState = "idle" | "working" | "thinking" | "error" | "paused" | "completed";

export interface WorkplaceAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  agentState: AgentState;
  deskIndex: number;
}

export const ROLE_COLORS: Record<string, number> = {
  ceo: 0xfbbf24,
  cto: 0x3b82f6,
  engineer: 0x10b981,
  designer: 0x8b5cf6,
  pm: 0xf97316,
  qa: 0x14b8a6,
  devops: 0xef4444,
  researcher: 0x6366f1,
  general: 0x6b7280,
  cmo: 0xec4899,
  cfo: 0x84cc16,
};
