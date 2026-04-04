import Phaser from "phaser";
import type { OfficeMapData, AgentState } from "../types";
import { BossCharacter } from "../entities/BossCharacter";
import { AgentSprite } from "../entities/AgentSprite";

const INTERACT_DISTANCE = 56;

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
    const { width, height, tileSize } = this.mapData;
    const mapW = width * tileSize;
    const mapH = height * tileSize;

    // Draw floor
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.add.image(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, "floor");
      }
    }

    // Draw walls
    for (let x = 0; x < width; x++) {
      this.add.image(x * tileSize + tileSize / 2, tileSize / 2, "wall");
      this.add.image(x * tileSize + tileSize / 2, (height - 1) * tileSize + tileSize / 2, "wall");
    }
    for (let y = 0; y < height; y++) {
      this.add.image(tileSize / 2, y * tileSize + tileSize / 2, "wall");
      this.add.image((width - 1) * tileSize + tileSize / 2, y * tileSize + tileSize / 2, "wall");
    }

    // Draw desks
    this.mapData.deskPositions.forEach((desk) => {
      this.add.image(desk.x, desk.y - tileSize / 2, "desk");
    });

    // Draw plants in corners
    const margin = tileSize * 2;
    [
      [margin, margin], [mapW - margin, margin],
      [margin, mapH - margin], [mapW - margin, mapH - margin],
    ].forEach(([px, py]) => {
      this.add.image(px, py, "plant");
    });

    // Boss character
    this.boss = new BossCharacter(this, this.mapData.spawnX, this.mapData.spawnY);
    this.boss.setDepth(10);

    // Camera
    this.cameras.main.startFollow(this.boss, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.physics.world.setBounds(tileSize, tileSize, mapW - tileSize * 2, mapH - tileSize * 2);
    this.boss.body.setCollideWorldBounds(true);

    // Listen for agent data from React
    this.game.events.on("agents-updated", this.handleAgentsUpdated, this);
    this.game.events.on("runs-updated", this.handleRunsUpdated, this);
    this.game.events.on("agent-state-change", this.handleAgentStateChange, this);
  }

  update() {
    this.boss.update();

    // Update all agent sprites
    this.agentSprites.forEach((agent) => agent.update());

    // Check proximity for interaction
    let nearest: AgentSprite | null = null;
    let nearestDist = INTERACT_DISTANCE;
    for (const agent of this.agentSprites.values()) {
      const dist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, agent.x, agent.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = agent;
      }
    }

    // Show/hide interact icon
    if (nearest !== this.nearestAgent) {
      if (this.nearestAgent) this.nearestAgent.hideInteractIcon();
      if (nearest) nearest.showInteractIcon();
      this.nearestAgent = nearest;
    }

    // Handle interaction
    if (this.nearestAgent && this.boss.interactPressed) {
      this.game.events.emit("assign-task", this.nearestAgent.agentId);
    }
  }

  private handleAgentsUpdated = (agents: any[]) => {
    if (!agents) return;

    const currentIds = new Set(agents.map((a: any) => a.id));

    // Remove agents no longer present
    this.agentSprites.forEach((sprite, id) => {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.agentSprites.delete(id);
      }
    });

    // Add/update agents
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
        );
        sprite.setDepth(5);
        sprite.body.setCollideWorldBounds(true);
        this.agentSprites.set(agent.id, sprite);
      }

      // Map agent status to game state
      const state = this.mapAgentStatus(agent.status);
      sprite.setAgentState(state);
    });
  };

  private handleRunsUpdated = (runs: any[]) => {
    if (!runs) return;
    runs.forEach((run: any) => {
      const sprite = this.agentSprites.get(run.agentId);
      if (!sprite) return;
      if (run.status === "running") sprite.setAgentState("working");
      else if (run.status === "queued") sprite.setAgentState("thinking");
    });
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
      case "idle":
      case "active":
      default: return "idle";
    }
  }

  destroy() {
    this.game.events.off("agents-updated", this.handleAgentsUpdated, this);
    this.game.events.off("runs-updated", this.handleRunsUpdated, this);
    this.game.events.off("agent-state-change", this.handleAgentStateChange, this);
  }
}
