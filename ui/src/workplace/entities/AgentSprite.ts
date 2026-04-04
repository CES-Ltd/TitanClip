import Phaser from "phaser";
import type { AgentState, DeskPosition, Waypoint } from "../types";
import { ROLE_COLORS } from "../types";

const FRAME_W = 24;
const FRAME_H = 32;
const WALK_SPEED = 60;
const DIRS = { down: 0, left: 1, up: 2, right: 3 };

const ROLE_ROW: Record<string, number> = {
  ceo: 0, cto: 1, engineer: 2, designer: 3, pm: 4, qa: 5, general: 6,
};

const BUBBLE_INDEX: Record<string, number> = {
  thinking: 0, coding: 1, error: 2, success: 3, paused: 4, queued: 5,
};

export class AgentSprite extends Phaser.GameObjects.Container {
  public agentId: string;
  public agentName: string;
  public agentRole: string;
  public agentState: AgentState = "idle";
  public deskPosition: DeskPosition;

  private sprite: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  private roleDot: Phaser.GameObjects.Graphics;
  private bubble: Phaser.GameObjects.Sprite | null = null;
  private interactIcon: Phaser.GameObjects.Image | null = null;
  private wanderTimer: Phaser.Time.TimerEvent | null = null;
  private waypoints: Waypoint[];
  private targetX = 0;
  private targetY = 0;
  private isMoving = false;
  declare public body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    role: string,
    desk: DeskPosition,
    waypoints: Waypoint[],
  ) {
    super(scene, desk.x, desk.y);
    this.agentId = agentId;
    this.agentName = name;
    this.agentRole = role;
    this.deskPosition = desk;
    this.waypoints = waypoints;
    this.targetX = desk.x;
    this.targetY = desk.y;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const rowIdx = ROLE_ROW[role] ?? 6;

    // Create walk animations for this agent
    for (const [dirName, dirIdx] of Object.entries(DIRS)) {
      const startFrame = rowIdx * 16 + dirIdx * 4;
      if (!scene.anims.exists(`agent-${agentId}-walk-${dirName}`)) {
        scene.anims.create({
          key: `agent-${agentId}-walk-${dirName}`,
          frames: scene.anims.generateFrameNumbers("agent-sprites", { start: startFrame, end: startFrame + 3 }),
          frameRate: 6,
          repeat: -1,
        });
      }
    }

    this.sprite = scene.add.sprite(0, 0, "agent-sprites", rowIdx * 16);
    this.sprite.setOrigin(0.5, 0.7);
    this.add(this.sprite);

    // Name label
    this.nameLabel = scene.add.text(0, 16, name.slice(0, 12), {
      fontSize: "7px",
      fontFamily: "monospace",
      color: "#e2e8f0",
      align: "center",
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Role dot
    this.roleDot = scene.add.graphics();
    this.roleDot.fillStyle(ROLE_COLORS[role] ?? 0x6b7280);
    this.roleDot.fillCircle(0, 0, 3);
    this.roleDot.setPosition(-14, -14);
    this.add(this.roleDot);

    this.body.setSize(16, 16);
    this.body.setOffset(-8, -8);

    this.startWandering();
  }

  setAgentState(state: AgentState) {
    if (this.agentState === state) return;
    this.agentState = state;

    this.clearBubble();

    switch (state) {
      case "working":
        this.stopWandering();
        this.walkTo(this.deskPosition.x, this.deskPosition.y, () => {
          this.showBubble("coding");
          this.sprite.setAlpha(1);
        });
        break;
      case "thinking":
        this.stopWandering();
        this.walkTo(this.deskPosition.x, this.deskPosition.y, () => {
          this.showBubble("thinking");
        });
        break;
      case "error":
        this.stopWandering();
        this.showBubble("error");
        this.sprite.setTint(0xff4444);
        break;
      case "paused":
        this.stopWandering();
        this.showBubble("paused");
        this.sprite.setAlpha(0.5);
        break;
      case "completed":
        this.showBubble("success");
        this.sprite.setTint(0xffffff);
        this.sprite.setAlpha(1);
        // Sparkle particles
        if (this.scene.add) {
          const particles = this.scene.add.particles(this.x, this.y - 10, "particle", {
            speed: { min: 30, max: 80 },
            lifespan: 600,
            quantity: 8,
            scale: { start: 1, end: 0 },
            emitting: false,
          });
          particles.explode(8);
          this.scene.time.delayedCall(1000, () => particles.destroy());
        }
        this.scene.time.delayedCall(2000, () => {
          if (this.agentState === "completed") {
            this.agentState = "idle";
            this.sprite.clearTint();
            this.startWandering();
          }
        });
        break;
      case "idle":
      default:
        this.sprite.clearTint();
        this.sprite.setAlpha(1);
        this.startWandering();
        break;
    }
  }

  showBubble(type: string) {
    this.clearBubble();
    const idx = BUBBLE_INDEX[type] ?? 0;
    this.bubble = this.scene.add.sprite(0, -24, "thought-bubbles");
    this.bubble.setFrame(idx);
    this.bubble.setOrigin(0.5);
    this.bubble.setCrop(idx * 32, 0, 32, 32);
    // Since we can't easily crop spritesheet frames from a generated texture,
    // use a simpler approach: recreate as image from texture region
    this.bubble.destroy();
    this.bubble = this.scene.add.sprite(0, -24, "thought-bubbles");
    this.bubble.setDisplaySize(24, 24);
    this.bubble.setOrigin(0.5);
    this.add(this.bubble);

    // Auto-hide after 4s (except for persistent states)
    if (type !== "coding" && type !== "paused") {
      this.scene.time.delayedCall(4000, () => this.clearBubble());
    }
  }

  clearBubble() {
    if (this.bubble) {
      this.bubble.destroy();
      this.bubble = null;
    }
  }

  showInteractIcon() {
    if (this.interactIcon) return;
    this.interactIcon = this.scene.add.image(0, -34, "interact-icon");
    this.interactIcon.setOrigin(0.5);
    this.add(this.interactIcon);
  }

  hideInteractIcon() {
    if (this.interactIcon) {
      this.interactIcon.destroy();
      this.interactIcon = null;
    }
  }

  private startWandering() {
    if (this.wanderTimer) return;
    this.wanderTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(4000, 8000),
      callback: () => {
        if (this.agentState !== "idle") return;
        // Pick random waypoint or desk
        const targets = [...this.waypoints, this.deskPosition];
        const target = Phaser.Utils.Array.GetRandom(targets);
        const tx = "x" in target ? target.x : this.deskPosition.x;
        const ty = "y" in target ? target.y : this.deskPosition.y;
        this.walkTo(tx + Phaser.Math.Between(-20, 20), ty + Phaser.Math.Between(-20, 20));
      },
      loop: true,
    });
  }

  private stopWandering() {
    if (this.wanderTimer) {
      this.wanderTimer.destroy();
      this.wanderTimer = null;
    }
  }

  private walkTo(tx: number, ty: number, onArrive?: () => void) {
    this.targetX = tx;
    this.targetY = ty;
    this.isMoving = true;
    this._onArrive = onArrive ?? null;
  }

  private _onArrive: (() => void) | null = null;

  update() {
    if (!this.isMoving) {
      this.body.setVelocity(0, 0);
      this.sprite.anims.stop();
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.body.setVelocity(0, 0);
      this.isMoving = false;
      this.sprite.anims.stop();
      if (this._onArrive) {
        this._onArrive();
        this._onArrive = null;
      }
      return;
    }

    const vx = (dx / dist) * WALK_SPEED;
    const vy = (dy / dist) * WALK_SPEED;
    this.body.setVelocity(vx, vy);

    // Determine direction for animation
    let dirName = "down";
    if (Math.abs(vx) > Math.abs(vy)) {
      dirName = vx < 0 ? "left" : "right";
    } else {
      dirName = vy < 0 ? "up" : "down";
    }
    this.sprite.anims.play(`agent-${this.agentId}-walk-${dirName}`, true);
  }

  destroy(fromScene?: boolean) {
    this.stopWandering();
    this.clearBubble();
    this.hideInteractIcon();
    super.destroy(fromScene);
  }
}
