import Phaser from "phaser";

/**
 * UIScene: HUD overlay showing company stats.
 * Runs in parallel with OfficeScene.
 */
export class UIScene extends Phaser.Scene {
  private statsText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    // Stats HUD (top-right)
    this.statsText = this.add.text(this.cameras.main.width - 16, 16, "", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#e2e8f0",
      backgroundColor: "rgba(15, 23, 42, 0.8)",
      padding: { x: 8, y: 6 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Controls hint (bottom-left)
    this.controlsText = this.add.text(16, this.cameras.main.height - 16,
      "WASD: Move  |  E: Interact", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#94a3b8",
      backgroundColor: "rgba(15, 23, 42, 0.7)",
      padding: { x: 6, y: 4 },
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(100);

    // Title (top-left)
    this.add.text(16, 16, "WORKPLACE", {
      fontSize: "14px",
      fontFamily: "monospace",
      fontStyle: "bold",
      color: "#fbbf24",
      backgroundColor: "rgba(15, 23, 42, 0.8)",
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(100);

    // Listen for stats updates
    this.game.events.on("stats-updated", this.handleStatsUpdated, this);

    // Handle resize
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
      `Tasks: ${stats.taskCount}`,
    ].join("\n"));
  };

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    this.statsText.setPosition(gameSize.width - 16, 16);
    this.controlsText.setPosition(16, gameSize.height - 16);
  };

  destroy() {
    this.game.events.off("stats-updated", this.handleStatsUpdated, this);
    this.scale.off("resize", this.handleResize, this);
  }
}
