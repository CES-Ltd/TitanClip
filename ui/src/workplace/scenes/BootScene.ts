import Phaser from "phaser";

/**
 * Sprite layout: 48×96 frames, 56 columns per row.
 * Row 0: preview thumbnails
 * Row 1: idle — right(6) · up(6) · left(6) · down(6)
 * Row 2: walk — right(6) · up(6) · left(6) · down(6)
 */
export const FRAME_W = 48;
export const FRAME_H = 96;
export const SHEET_COLS = 56;
export const FRAMES_PER_DIR = 6;
export const DIRECTIONS = ["right", "up", "left", "down"] as const;

const CHARACTER_SPRITES = [
  { key: "boss", path: "/workplace/characters/boss.png" },
  { key: "agent_01", path: "/workplace/characters/agent_01.png" },
  { key: "agent_02", path: "/workplace/characters/agent_02.png" },
  { key: "agent_03", path: "/workplace/characters/agent_03.png" },
  { key: "agent_04", path: "/workplace/characters/agent_04.png" },
  { key: "agent_05", path: "/workplace/characters/agent_05.png" },
  { key: "agent_06", path: "/workplace/characters/agent_06.png" },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Character spritesheets
    for (const { key, path } of CHARACTER_SPRITES) {
      this.load.spritesheet(key, path, {
        frameWidth: FRAME_W,
        frameHeight: FRAME_H,
      });
    }

    // Emotes spritesheet (10x10 grid of 48x48 frames)
    this.load.spritesheet("emotes", "/workplace/sprites/emotes_48x48.png", {
      frameWidth: 48,
      frameHeight: 48,
    });

    // Office map data
    this.load.json("office-map", "/workplace/office-map.json");
  }

  create() {
    // Build character animations for all sprites
    for (const { key } of CHARACTER_SPRITES) {
      this.buildCharacterAnims(key);
    }

    // Build emote animations
    this.buildEmoteAnims();

    // Generate procedural textures for the office
    this.generateOfficeTiles();

    this.scene.start("OfficeScene");
    this.scene.start("UIScene");
  }

  private buildCharacterAnims(spriteKey: string) {
    for (const [dirIdx, dir] of DIRECTIONS.entries()) {
      // Idle animations (row 1)
      const idleStart = 1 * SHEET_COLS + dirIdx * FRAMES_PER_DIR;
      this.anims.create({
        key: `${spriteKey}:idle-${dir}`,
        frames: this.anims.generateFrameNumbers(spriteKey, {
          start: idleStart,
          end: idleStart + FRAMES_PER_DIR - 1,
        }),
        frameRate: 8,
        repeat: -1,
      });

      // Walk animations (row 2)
      const walkStart = 2 * SHEET_COLS + dirIdx * FRAMES_PER_DIR;
      this.anims.create({
        key: `${spriteKey}:walk-${dir}`,
        frames: this.anims.generateFrameNumbers(spriteKey, {
          start: walkStart,
          end: walkStart + FRAMES_PER_DIR - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  private buildEmoteAnims() {
    const emotes: { key: string; frames: number[]; rate: number; repeat: number }[] = [
      { key: "emote:thinking", frames: [52, 53], rate: 2, repeat: -1 },
      { key: "emote:device", frames: [58, 59], rate: 2, repeat: -1 },
      { key: "emote:wrench", frames: [74, 75], rate: 2, repeat: -1 },
      { key: "emote:dots", frames: [92, 93], rate: 2, repeat: -1 },
      { key: "emote:sleep", frames: [56, 57], rate: 2, repeat: -1 },
      { key: "emote:alert", frames: [40, 41], rate: 4, repeat: 3 },
      { key: "emote:fail", frames: [50, 51], rate: 4, repeat: 3 },
      { key: "emote:star", frames: [64, 65], rate: 3, repeat: 3 },
      { key: "emote:heart", frames: [54, 55], rate: 2, repeat: 3 },
      { key: "emote:music", frames: [66, 67], rate: 3, repeat: -1 },
      { key: "emote:confused", frames: [62, 63], rate: 2, repeat: -1 },
      { key: "emote:angry", frames: [70, 71], rate: 3, repeat: 3 },
    ];

    for (const e of emotes) {
      this.anims.create({
        key: e.key,
        frames: e.frames.map((f) => ({ key: "emotes", frame: f })),
        frameRate: e.rate,
        repeat: e.repeat,
      });
    }
  }

  private generateOfficeTiles() {
    // Floor tile — dark theme inspired
    const floor = this.add.graphics();
    floor.fillStyle(0x1e1e2e); // dark blue-gray
    floor.fillRect(0, 0, 48, 48);
    floor.lineStyle(1, 0x2a2a3e, 0.4);
    floor.strokeRect(0, 0, 48, 48);
    floor.lineStyle(1, 0x252538, 0.2);
    floor.lineBetween(0, 16, 48, 16);
    floor.lineBetween(0, 32, 48, 32);
    floor.generateTexture("floor", 48, 48);
    floor.destroy();

    // Wall tile — darker
    const wall = this.add.graphics();
    wall.fillStyle(0x111122);
    wall.fillRect(0, 0, 48, 48);
    wall.fillStyle(0x0d0d1a);
    wall.fillRect(0, 44, 48, 4);
    wall.fillStyle(0x6366f1); // indigo accent line
    wall.fillRect(0, 0, 48, 2);
    wall.generateTexture("wall", 48, 48);
    wall.destroy();

    // Desk tile
    const desk = this.add.graphics();
    desk.fillStyle(0x2d2d3f);
    desk.fillRoundedRect(2, 6, 44, 32, 4);
    desk.fillStyle(0x3a3a50);
    desk.fillRoundedRect(4, 8, 40, 28, 3);
    // Monitor
    desk.fillStyle(0x0f172a);
    desk.fillRoundedRect(12, 10, 24, 16, 2);
    desk.fillStyle(0x6366f1); // indigo screen glow
    desk.fillRoundedRect(14, 12, 20, 12, 1);
    // Stand
    desk.fillStyle(0x4a4a5e);
    desk.fillRect(22, 26, 4, 6);
    desk.fillRect(18, 32, 12, 2);
    desk.generateTexture("desk", 48, 48);
    desk.destroy();

    // Plant tile
    const plant = this.add.graphics();
    plant.fillStyle(0x3a2e1c);
    plant.fillRoundedRect(14, 28, 20, 16, 3);
    plant.fillStyle(0x2e1f0f);
    plant.fillRect(12, 26, 24, 4);
    plant.fillStyle(0x166534);
    plant.fillCircle(24, 18, 12);
    plant.fillStyle(0x15803d);
    plant.fillCircle(18, 16, 7);
    plant.fillCircle(30, 16, 7);
    plant.fillCircle(24, 10, 6);
    plant.generateTexture("plant", 48, 48);
    plant.destroy();

    // Particle
    const part = this.add.graphics();
    part.fillStyle(0x6366f1);
    part.fillCircle(4, 4, 4);
    part.fillStyle(0xa5b4fc);
    part.fillCircle(4, 4, 2);
    part.generateTexture("particle", 8, 8);
    part.destroy();

    // Interact icon (E key)
    const eKey = this.add.graphics();
    eKey.fillStyle(0x6366f1);
    eKey.fillRoundedRect(0, 0, 24, 24, 6);
    eKey.fillStyle(0xffffff);
    eKey.fillRect(7, 5, 10, 2);
    eKey.fillRect(7, 5, 2, 14);
    eKey.fillRect(7, 11, 8, 2);
    eKey.fillRect(7, 17, 10, 2);
    eKey.generateTexture("interact-icon", 24, 24);
    eKey.destroy();
  }
}
