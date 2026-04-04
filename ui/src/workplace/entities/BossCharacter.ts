import Phaser from "phaser";

const SPEED = 140;
const FRAME_W = 24;
const DIRS = { down: 0, left: 1, up: 2, right: 3 };

export class BossCharacter extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private nameLabel: Phaser.GameObjects.Text;
  declare public body: Phaser.Physics.Arcade.Body;
  private facing = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create animations
    for (const [name, row] of Object.entries(DIRS)) {
      const startFrame = row * 4;
      scene.anims.create({
        key: `boss-walk-${name}`,
        frames: scene.anims.generateFrameNumbers("boss", { start: startFrame, end: startFrame + 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    this.sprite = scene.add.sprite(0, 0, "boss", 0);
    this.sprite.setOrigin(0.5, 0.7);
    this.add(this.sprite);

    this.nameLabel = scene.add.text(0, 14, "BOSS", {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#fbbf24",
      align: "center",
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    this.body.setSize(16, 16);
    this.body.setOffset(-8, -8);

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
      // Determine facing direction
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx < 0 ? DIRS.left : DIRS.right;
      } else {
        this.facing = vy < 0 ? DIRS.up : DIRS.down;
      }
      const dirName = Object.entries(DIRS).find(([, v]) => v === this.facing)?.[0] ?? "down";
      this.sprite.anims.play(`boss-walk-${dirName}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(this.facing * 4);
    }
  }
}
