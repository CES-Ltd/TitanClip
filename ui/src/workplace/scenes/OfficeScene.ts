import Phaser from "phaser";
import type { OfficeMapData, AgentState } from "../types";
import { BossCharacter } from "../entities/BossCharacter";
import { AgentSprite } from "../entities/AgentSprite";

const TILE = 48;
const INTERACT_DISTANCE = 72;
const MAP_W = 24;
const MAP_H = 16;

export class OfficeScene extends Phaser.Scene {
  private boss!: BossCharacter;
  private agentSprites = new Map<string, AgentSprite>();
  private mapData!: OfficeMapData;
  private nearestAgent: AgentSprite | null = null;

  constructor() {
    super({ key: "OfficeScene" });
  }

  create() {
    this.mapData = this.cache.json.get("office-map") as OfficeMapData;
    const mapW = MAP_W * TILE;
    const mapH = MAP_H * TILE;

    this.cameras.main.setBackgroundColor(0x09090b);

    // Draw floor
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, "floor");
      }
    }

    // Draw walls
    for (let x = 0; x < MAP_W; x++) {
      this.add.image(x * TILE + TILE / 2, TILE / 2, "wall");
      this.add.image(x * TILE + TILE / 2, (MAP_H - 1) * TILE + TILE / 2, "wall");
    }
    for (let y = 0; y < MAP_H; y++) {
      this.add.image(TILE / 2, y * TILE + TILE / 2, "wall");
      this.add.image((MAP_W - 1) * TILE + TILE / 2, y * TILE + TILE / 2, "wall");
    }

    // Desk positions (3 rows of 3, well-spaced)
    const deskPositions = [
      { index: 0, x: 5 * TILE, y: 4 * TILE },
      { index: 1, x: 10 * TILE, y: 4 * TILE },
      { index: 2, x: 15 * TILE, y: 4 * TILE },
      { index: 3, x: 5 * TILE, y: 8 * TILE },
      { index: 4, x: 10 * TILE, y: 8 * TILE },
      { index: 5, x: 15 * TILE, y: 8 * TILE },
      { index: 6, x: 5 * TILE, y: 12 * TILE },
      { index: 7, x: 10 * TILE, y: 12 * TILE },
      { index: 8, x: 15 * TILE, y: 12 * TILE },
    ];
    this.mapData.deskPositions = deskPositions;

    // Draw desks
    for (const desk of deskPositions) {
      this.add.image(desk.x, desk.y - TILE / 2, "desk").setDepth(1);
    }

    // Plants in corners
    const margin = TILE * 2;
    for (const [px, py] of [[margin, margin], [mapW - margin, margin], [margin, mapH - margin], [mapW - margin, mapH - margin]]) {
      this.add.image(px, py, "plant").setDepth(1);
    }

    // Waypoints
    this.mapData.waypoints = [
      { name: "breakRoom", x: (MAP_W - 3) * TILE, y: 3 * TILE },
      { name: "waterCooler", x: (MAP_W - 3) * TILE, y: 7 * TILE },
      { name: "whiteboard", x: MAP_W / 2 * TILE, y: 2 * TILE },
      { name: "entrance", x: MAP_W / 2 * TILE, y: (MAP_H - 2) * TILE },
      { name: "lounge", x: 3 * TILE, y: (MAP_H - 3) * TILE },
    ];

    // Spawn point
    const spawnX = (MAP_W / 2) * TILE;
    const spawnY = (MAP_H - 3) * TILE;

    // Boss character
    this.boss = new BossCharacter(this, spawnX, spawnY);
    this.boss.setDepth(10);

    // Camera
    this.cameras.main.startFollow(this.boss, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setZoom(0.9);
    this.physics.world.setBounds(TILE, TILE, mapW - TILE * 2, mapH - TILE * 2);
    this.boss.body.setCollideWorldBounds(true);

    // Listen for data from React
    this.game.events.on("agents-updated", this.handleAgentsUpdated, this);
    this.game.events.on("runs-updated", this.handleRunsUpdated, this);
    this.game.events.on("agent-state-change", this.handleAgentStateChange, this);
  }

  update() {
    this.boss.update();

    for (const agent of this.agentSprites.values()) {
      agent.update();
    }

    // Proximity check for interaction
    let nearest: AgentSprite | null = null;
    let nearestDist = INTERACT_DISTANCE;
    for (const agent of this.agentSprites.values()) {
      const dist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, agent.x, agent.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = agent;
      }
    }

    if (nearest !== this.nearestAgent) {
      if (this.nearestAgent) this.nearestAgent.hideInteractIcon();
      if (nearest) nearest.showInteractIcon();
      this.nearestAgent = nearest;
    }

    if (this.nearestAgent && this.boss.interactPressed) {
      this.game.events.emit("assign-task", this.nearestAgent.agentId);
    }

    // Depth sort all characters by y position
    this.boss.setDepth(this.boss.y);
    for (const agent of this.agentSprites.values()) {
      agent.setDepth(agent.y);
    }
  }

  private handleAgentsUpdated = (agents: any[]) => {
    if (!agents) return;
    const currentIds = new Set(agents.map((a: any) => a.id));

    for (const [id, sprite] of this.agentSprites) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.agentSprites.delete(id);
      }
    }

    agents.forEach((agent: any, idx: number) => {
      if (agent.status === "terminated") return;

      let sprite = this.agentSprites.get(agent.id);
      if (!sprite) {
        const deskIdx = idx % this.mapData.deskPositions.length;
        const desk = this.mapData.deskPositions[deskIdx];
        sprite = new AgentSprite(
          this,
          agent.id,
          agent.name,
          agent.role ?? "general",
          desk,
          this.mapData.waypoints,
          idx,
        );
        sprite.body.setCollideWorldBounds(true);
        this.agentSprites.set(agent.id, sprite);
      }

      const state = this.mapAgentStatus(agent.status);
      sprite.setAgentState(state);
    });
  };

  private handleRunsUpdated = (runs: any[]) => {
    if (!runs) return;
    for (const run of runs) {
      const sprite = this.agentSprites.get(run.agentId);
      if (!sprite) continue;
      if (run.status === "running") sprite.setAgentState("working");
      else if (run.status === "queued") sprite.setAgentState("thinking");
    }
  };

  private handleAgentStateChange = (data: { agentId: string; state: AgentState }) => {
    const sprite = this.agentSprites.get(data.agentId);
    if (sprite) sprite.setAgentState(data.state);
  };

  private mapAgentStatus(status: string): AgentState {
    switch (status) {
      case "running": return "working";
      case "paused": return "paused";
      case "error": return "error";
      default: return "idle";
    }
  }

  destroy() {
    this.game.events.off("agents-updated", this.handleAgentsUpdated, this);
    this.game.events.off("runs-updated", this.handleRunsUpdated, this);
    this.game.events.off("agent-state-change", this.handleAgentStateChange, this);
  }
}
