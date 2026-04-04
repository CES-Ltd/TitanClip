import Phaser from "phaser";
import type { OfficeMapData } from "../types";

/**
 * BootScene: Generates all textures procedurally (no external images needed)
 * and loads the office map JSON, then starts the OfficeScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.json("office-map", "/workplace/office-map.json");
  }

  create() {
    this.generateFloorTile();
    this.generateWallTile();
    this.generateDeskTile();
    this.generatePlantTile();
    this.generateBossSprite();
    this.generateAgentSprite();
    this.generateThoughtBubbles();
    this.generateParticle();
    this.generateInteractIcon();

    this.scene.start("OfficeScene");
    this.scene.start("UIScene");
  }

  private generateFloorTile() {
    const g = this.add.graphics();
    g.fillStyle(0xc4a882);
    g.fillRect(0, 0, 32, 32);
    g.lineStyle(1, 0xb89b72);
    g.strokeRect(0, 0, 32, 32);
    // Subtle wood grain
    g.lineStyle(1, 0xb89b72, 0.3);
    g.lineBetween(0, 8, 32, 8);
    g.lineBetween(0, 16, 32, 16);
    g.lineBetween(0, 24, 32, 24);
    g.generateTexture("floor", 32, 32);
    g.destroy();
  }

  private generateWallTile() {
    const g = this.add.graphics();
    g.fillStyle(0x374151);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x1f2937);
    g.fillRect(0, 28, 32, 4);
    g.fillRect(0, 0, 32, 2);
    g.generateTexture("wall", 32, 32);
    g.destroy();
  }

  private generateDeskTile() {
    const g = this.add.graphics();
    // Desk body
    g.fillStyle(0x92400e);
    g.fillRect(2, 4, 28, 20);
    g.fillStyle(0xb45309);
    g.fillRect(4, 6, 24, 16);
    // Monitor
    g.fillStyle(0x1e293b);
    g.fillRect(9, 7, 14, 10);
    g.fillStyle(0x6366f1);
    g.fillRect(10, 8, 12, 8);
    // Monitor stand
    g.fillStyle(0x475569);
    g.fillRect(14, 17, 4, 3);
    g.generateTexture("desk", 32, 32);
    g.destroy();
  }

  private generatePlantTile() {
    const g = this.add.graphics();
    // Pot
    g.fillStyle(0x92400e);
    g.fillRect(10, 20, 12, 10);
    g.fillStyle(0x78350f);
    g.fillRect(8, 18, 16, 4);
    // Leaves
    g.fillStyle(0x166534);
    g.fillCircle(16, 12, 8);
    g.fillStyle(0x15803d);
    g.fillCircle(12, 10, 5);
    g.fillCircle(20, 10, 5);
    g.fillCircle(16, 6, 4);
    g.generateTexture("plant", 32, 32);
    g.destroy();
  }

  private generateBossSprite() {
    const g = this.add.graphics();
    const fw = 24, fh = 32;
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        const x = (dir * 4 + frame) * fw;
        const bob = frame % 2 === 0 ? 0 : -1;
        // Body (gold suit)
        g.fillStyle(0xfbbf24);
        g.fillRect(x + 6, 10 + bob, 12, 14);
        // Head
        g.fillStyle(0xfde68a);
        g.fillRect(x + 7, 2 + bob, 10, 10);
        // Crown
        g.fillStyle(0xf59e0b);
        g.fillRect(x + 8, bob, 8, 3);
        g.fillRect(x + 9, bob - 1, 2, 2);
        g.fillRect(x + 13, bob - 1, 2, 2);
        // Eyes
        g.fillStyle(0x1e293b);
        if (dir === 0 || dir === 2) { g.fillRect(x + 9, 6 + bob, 2, 2); g.fillRect(x + 13, 6 + bob, 2, 2); }
        else { g.fillRect(x + 11, 6 + bob, 2, 2); }
        // Legs
        g.fillStyle(0x92400e);
        const lo = frame === 1 ? 2 : frame === 3 ? -2 : 0;
        g.fillRect(x + 8, 24 + bob, 3, 6);
        g.fillRect(x + 13, 24 + bob + lo, 3, 6);
      }
    }
    g.generateTexture("boss", fw * 16, fh);
    g.destroy();
  }

  private generateAgentSprite() {
    const g = this.add.graphics();
    const fw = 24, fh = 32;
    const roleColors = [0xfbbf24, 0x3b82f6, 0x10b981, 0x8b5cf6, 0xf97316, 0x14b8a6, 0x6b7280, 0xf43f5e];

    roleColors.forEach((color, roleIdx) => {
      for (let dir = 0; dir < 4; dir++) {
        for (let frame = 0; frame < 4; frame++) {
          const x = (dir * 4 + frame) * fw;
          const y = roleIdx * fh;
          const bob = frame % 2 === 0 ? 0 : -1;
          // Body
          g.fillStyle(color);
          g.fillRect(x + 6, y + 10 + bob, 12, 14);
          // Head
          g.fillStyle(0xfdd8d8);
          g.fillRect(x + 7, y + 2 + bob, 10, 10);
          // Eyes
          g.fillStyle(0x1e293b);
          if (dir === 0 || dir === 2) { g.fillRect(x + 9, y + 6 + bob, 2, 2); g.fillRect(x + 13, y + 6 + bob, 2, 2); }
          else { g.fillRect(x + 11, y + 6 + bob, 2, 2); }
          // Legs
          g.fillStyle(0x334155);
          const lo = frame === 1 ? 2 : frame === 3 ? -2 : 0;
          g.fillRect(x + 8, y + 24 + bob, 3, 6);
          g.fillRect(x + 13, y + 24 + bob + lo, 3, 6);
        }
      }
    });

    g.generateTexture("agent-sprites", fw * 16, fh * roleColors.length);
    g.destroy();
  }

  private generateThoughtBubbles() {
    const g = this.add.graphics();
    const size = 32;
    const icons = ["thinking", "coding", "error", "success", "paused", "queued"];

    icons.forEach((_, idx) => {
      const x = idx * size;
      // Bubble
      g.fillStyle(0xffffff);
      g.fillCircle(x + 16, 12, 12);
      g.lineStyle(1, 0x94a3b8);
      g.strokeCircle(x + 16, 12, 12);
      // Tail
      g.fillStyle(0xffffff);
      g.fillRect(x + 14, 22, 4, 4);
      g.fillRect(x + 12, 26, 2, 3);
    });
    // Icons inside bubbles
    // 0: thinking (...)
    g.fillStyle(0x64748b);
    g.fillCircle(9 + 2, 12, 2); g.fillCircle(16, 12, 2); g.fillCircle(23 - 2, 12, 2);
    // 1: coding (gear)
    g.fillStyle(0x6366f1);
    g.fillRect(32 + 12, 8, 8, 8);
    // 2: error (!)
    g.fillStyle(0xef4444);
    g.fillRect(64 + 15, 6, 2, 8); g.fillRect(64 + 15, 16, 2, 2);
    // 3: success (check)
    g.lineStyle(2, 0x22c55e);
    g.lineBetween(96 + 10, 12, 96 + 14, 16); g.lineBetween(96 + 14, 16, 96 + 22, 8);
    // 4: paused (||)
    g.fillStyle(0x94a3b8);
    g.fillRect(128 + 12, 7, 3, 10); g.fillRect(128 + 17, 7, 3, 10);
    // 5: queued (clock)
    g.lineStyle(2, 0xf59e0b);
    g.strokeCircle(160 + 16, 12, 6);
    g.lineBetween(160 + 16, 9, 160 + 16, 12); g.lineBetween(160 + 16, 12, 160 + 19, 12);

    g.generateTexture("thought-bubbles", size * 6, size);
    g.destroy();
  }

  private generateParticle() {
    const g = this.add.graphics();
    g.fillStyle(0xfbbf24);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xfef3c7);
    g.fillCircle(4, 4, 2);
    g.generateTexture("particle", 8, 8);
    g.destroy();
  }

  private generateInteractIcon() {
    const g = this.add.graphics();
    // "E" key icon
    g.fillStyle(0x1e293b);
    g.fillRoundedRect(0, 0, 20, 20, 4);
    g.fillStyle(0xffffff);
    g.fillRect(6, 4, 8, 2);
    g.fillRect(6, 4, 2, 12);
    g.fillRect(6, 9, 6, 2);
    g.fillRect(6, 14, 8, 2);
    g.generateTexture("interact-icon", 20, 20);
    g.destroy();
  }
}
