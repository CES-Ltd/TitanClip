import Phaser from "phaser";

const SPEED = 160;
const SPRITE_KEY = "boss";

export class BossCharacter extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private nameLabel: Phaser.GameObjects.Text;
  declare public body: Phaser.Physics.Arcade.Body;
  private facing: "down" | "up" | "left" | "right" = "down";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.sprite = scene.add.sprite(0, -16, SPRITE_KEY);
    this.sprite.setOrigin(0.5, 0.75);
    this.add(this.sprite);

    this.nameLabel = scene.add.text(0, 20, "YOU", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#fbbf24",
      align: "center",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Physics body — smaller hitbox at feet
    this.body.setSize(24, 20);
    this.body.setOffset(-12, -10);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard.addKey("W"),
        A: scene.input.keyboard.addKey("A"),
        S: scene.input.keyboard.addKey("S"),
        D: scene.input.keyboard.addKey("D"),
      };
      this.interactKey = scene.input.keyboard.addKey("E");
    }

    // Start idle
    this.sprite.play(`${SPRITE_KEY}:idle-down`);
  }

  get interactPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.interactKey);
  }

  update() {
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;

    let vx = 0, vy = 0;
    if (left) vx = -SPEED;
    else if (right) vx = SPEED;
    if (up) vy = -SPEED;
    else if (down) vy = SPEED;

    this.body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx < 0 ? "left" : "right";
      } else {
        this.facing = vy < 0 ? "up" : "down";
      }
      this.sprite.play(`${SPRITE_KEY}:walk-${this.facing}`, true);
    } else {
      this.sprite.play(`${SPRITE_KEY}:idle-${this.facing}`, true);
    }
  }
}
