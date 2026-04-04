import Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  private statsText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Stats HUD (top-right) — dark indigo theme
    this.statsText = this.add.text(w - 16, 16, "", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#c7d2fe", // indigo-200
      backgroundColor: "rgba(15, 23, 42, 0.85)",
      padding: { x: 10, y: 8 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    // Controls hint (bottom-center)
    this.controlsText = this.add.text(w / 2, h - 16,
      "WASD: Move  |  E: Interact with Agent", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#6366f1",
      backgroundColor: "rgba(9, 9, 11, 0.85)",
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);

    // Title (top-left)
    this.add.text(16, 16, "WORKPLACE", {
      fontSize: "16px",
      fontFamily: "monospace",
      fontStyle: "bold",
      color: "#6366f1",
      backgroundColor: "rgba(9, 9, 11, 0.85)",
      padding: { x: 10, y: 8 },
    }).setScrollFactor(0).setDepth(1000);

    this.game.events.on("stats-updated", this.handleStatsUpdated, this);
    this.scale.on("resize", this.handleResize, this);
  }

  private handleStatsUpdated = (stats: {
    agentCount: number;
    workingCount: number;
    idleCount: number;
    errorCount: number;
    taskCount: number;
  }) => {
    this.statsText.setText([
      `Agents: ${stats.agentCount}`,
      `  Working: ${stats.workingCount}  Idle: ${stats.idleCount}  Error: ${stats.errorCount}`,
      `Tasks in queue: ${stats.taskCount}`,
    ].join("\n"));
  };

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    this.statsText.setPosition(gameSize.width - 16, 16);
    this.controlsText.setPosition(gameSize.width / 2, gameSize.height - 16);
  };

  destroy() {
    this.game.events.off("stats-updated", this.handleStatsUpdated, this);
    this.scale.off("resize", this.handleResize, this);
  }
}
