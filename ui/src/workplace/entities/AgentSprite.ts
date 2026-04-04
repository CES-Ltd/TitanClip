import Phaser from "phaser";
import type { AgentState, DeskPosition, Waypoint } from "../types";
import { ROLE_COLORS } from "../types";

const WALK_SPEED = 88; // Slower than boss (160 * 0.55)
const AGENT_SPRITE_KEYS = ["agent_01", "agent_02", "agent_03", "agent_04", "agent_05", "agent_06"];

// Map agent state to emote animation
const STATE_EMOTES: Record<AgentState, string | null> = {
  idle: null,
  working: "emote:device",
  thinking: "emote:thinking",
  error: "emote:fail",
  paused: "emote:sleep",
  completed: "emote:star",
};

export class AgentSprite extends Phaser.GameObjects.Container {
  public agentId: string;
  public agentName: string;
  public agentRole: string;
  public agentState: AgentState = "idle";
  public deskPosition: DeskPosition;

  private sprite: Phaser.GameObjects.Sprite;
  private spriteKey: string;
  private nameLabel: Phaser.GameObjects.Text;
  private roleDot: Phaser.GameObjects.Graphics;
  private emoteSprite: Phaser.GameObjects.Sprite | null = null;
  private interactIcon: Phaser.GameObjects.Image | null = null;
  private wanderTimer: Phaser.Time.TimerEvent | null = null;
  private waypoints: Waypoint[];
  private targetX = 0;
  private targetY = 0;
  private isMoving = false;
  private _onArrive: (() => void) | null = null;
  private facing: "down" | "up" | "left" | "right" = "down";
  declare public body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    role: string,
    desk: DeskPosition,
    waypoints: Waypoint[],
    spriteIndex: number,
  ) {
    super(scene, desk.x, desk.y);
    this.agentId = agentId;
    this.agentName = name;
    this.agentRole = role;
    this.deskPosition = desk;
    this.waypoints = waypoints;
    this.targetX = desk.x;
    this.targetY = desk.y;
    this.spriteKey = AGENT_SPRITE_KEYS[spriteIndex % AGENT_SPRITE_KEYS.length];

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.sprite = scene.add.sprite(0, -16, this.spriteKey);
    this.sprite.setOrigin(0.5, 0.75);
    this.add(this.sprite);

    // Name label
    this.nameLabel = scene.add.text(0, 20, name.slice(0, 14), {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#e2e8f0",
      align: "center",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Role color dot
    this.roleDot = scene.add.graphics();
    this.roleDot.fillStyle(ROLE_COLORS[role] ?? 0x6b7280);
    this.roleDot.fillCircle(0, 0, 4);
    this.roleDot.lineStyle(1, 0x000000);
    this.roleDot.strokeCircle(0, 0, 4);
    this.roleDot.setPosition(-18, -40);
    this.add(this.roleDot);

    // Physics body at feet
    this.body.setSize(24, 20);
    this.body.setOffset(-12, -10);

    // Start idle
    this.sprite.play(`${this.spriteKey}:idle-down`);
    this.startWandering();
  }

  setAgentState(state: AgentState) {
    if (this.agentState === state) return;
    this.agentState = state;
    this.clearEmote();

    switch (state) {
      case "working":
        this.stopWandering();
        this.walkTo(this.deskPosition.x, this.deskPosition.y, () => {
          this.showEmote("emote:device");
          this.sprite.setAlpha(1);
          this.sprite.clearTint();
        });
        break;
      case "thinking":
        this.stopWandering();
        this.walkTo(this.deskPosition.x, this.deskPosition.y, () => {
          this.showEmote("emote:thinking");
        });
        break;
      case "error":
        this.stopWandering();
        this.showEmote("emote:fail");
        this.sprite.setTint(0xff6666);
        break;
      case "paused":
        this.stopWandering();
        this.showEmote("emote:sleep");
        this.sprite.setAlpha(0.5);
        break;
      case "completed":
        this.showEmote("emote:star");
        this.sprite.setTint(0xffffff);
        this.sprite.setAlpha(1);
        // Sparkle particles
        const particles = this.scene.add.particles(this.x, this.y - 30, "particle", {
          speed: { min: 40, max: 100 },
          lifespan: 800,
          quantity: 12,
          scale: { start: 1.5, end: 0 },
          emitting: false,
        });
        particles.explode(12);
        this.scene.time.delayedCall(1200, () => particles.destroy());
        this.scene.time.delayedCall(3000, () => {
          if (this.agentState === "completed") {
            this.agentState = "idle";
            this.sprite.clearTint();
            this.clearEmote();
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

  showEmote(animKey: string) {
    this.clearEmote();
    this.emoteSprite = this.scene.add.sprite(0, -52, "emotes");
    this.emoteSprite.setOrigin(0.5, 1);
    this.emoteSprite.play(animKey);
    this.add(this.emoteSprite);
  }

  clearEmote() {
    if (this.emoteSprite) {
      this.emoteSprite.destroy();
      this.emoteSprite = null;
    }
  }

  showInteractIcon() {
    if (this.interactIcon) return;
    this.interactIcon = this.scene.add.image(0, -60, "interact-icon");
    this.interactIcon.setOrigin(0.5);
    this.add(this.interactIcon);
    // Bounce tween
    this.scene.tweens.add({
      targets: this.interactIcon,
      y: -65,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  hideInteractIcon() {
    if (this.interactIcon) {
      this.scene.tweens.killTweensOf(this.interactIcon);
      this.interactIcon.destroy();
      this.interactIcon = null;
    }
  }

  private startWandering() {
    if (this.wanderTimer) return;
    const delay = Phaser.Math.Between(3000, 8000);
    this.wanderTimer = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.agentState !== "idle") return;
        const targets = [...this.waypoints, this.deskPosition];
        const target = Phaser.Utils.Array.GetRandom(targets);
        const tx = target.x + Phaser.Math.Between(-24, 24);
        const ty = target.y + Phaser.Math.Between(-24, 24);
        this.walkTo(tx, ty);
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

  update() {
    if (!this.isMoving) {
      this.body.setVelocity(0, 0);
      this.sprite.play(`${this.spriteKey}:idle-${this.facing}`, true);
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 6) {
      this.body.setVelocity(0, 0);
      this.isMoving = false;
      this.sprite.play(`${this.spriteKey}:idle-${this.facing}`, true);
      if (this._onArrive) {
        this._onArrive();
        this._onArrive = null;
      }
      return;
    }

    const vx = (dx / dist) * WALK_SPEED;
    const vy = (dy / dist) * WALK_SPEED;
    this.body.setVelocity(vx, vy);

    if (Math.abs(vx) > Math.abs(vy)) {
      this.facing = vx < 0 ? "left" : "right";
    } else {
      this.facing = vy < 0 ? "up" : "down";
    }
    this.sprite.play(`${this.spriteKey}:walk-${this.facing}`, true);
  }

  destroy(fromScene?: boolean) {
    this.stopWandering();
    this.clearEmote();
    this.hideInteractIcon();
    super.destroy(fromScene);
  }
}
