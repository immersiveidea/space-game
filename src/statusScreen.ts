import {
    AdvancedDynamicTexture,
    Control,
    Rectangle,
    StackPanel,
    TextBlock
} from "@babylonjs/gui";
import {
    Camera,
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    Vector3
} from "@babylonjs/core";
import { GameStats } from "./gameStats";

/**
 * Status screen that displays game statistics
 * Floats in front of the user and can be toggled on/off
 */
export class StatusScreen {
    private _scene: Scene;
    private _gameStats: GameStats;
    private _screenMesh: Mesh | null = null;
    private _texture: AdvancedDynamicTexture | null = null;
    private _isVisible: boolean = false;
    private _camera: Camera | null = null;

    // Text blocks for statistics
    private _gameTimeText: TextBlock;
    private _asteroidsText: TextBlock;
    private _hullDamageText: TextBlock;
    private _shotsFiredText: TextBlock;
    private _accuracyText: TextBlock;
    private _fuelConsumedText: TextBlock;

    constructor(scene: Scene, gameStats: GameStats) {
        this._scene = scene;
        this._gameStats = gameStats;
    }

    /**
     * Initialize the status screen mesh and UI
     */
    public initialize(camera: Camera): void {
        this._camera = camera;

        // Create a plane mesh for the status screen
        this._screenMesh = MeshBuilder.CreatePlane(
            "statusScreen",
            { width: 1.5, height: 1.0 },
            this._scene
        );

        // Parent to camera for automatic following
        this._screenMesh.parent = this._camera;
        this._screenMesh.position = new Vector3(0, 0, 2); // 2 meters forward in local space
        //this._screenMesh.rotation.y = Math.PI; // Face backward (toward user)
        this._screenMesh.renderingGroupId = 3; // Always render on top

        // Create material
        const material = new StandardMaterial("statusScreenMaterial", this._scene);
        this._screenMesh.material = material;

        // Create AdvancedDynamicTexture
        this._texture = AdvancedDynamicTexture.CreateForMesh(
            this._screenMesh,
            1024,
            768
        );
        this._texture.background = "#1a1a2e";

        // Create main container
        const mainPanel = new StackPanel("mainPanel");
        mainPanel.width = "100%";
        mainPanel.height = "100%";
        mainPanel.isVertical = true;
        mainPanel.paddingTop = "40px";
        mainPanel.paddingBottom = "40px";
        mainPanel.paddingLeft = "60px";
        mainPanel.paddingRight = "60px";

        // Title
        const title = this.createTitleText("GAME STATISTICS");
        mainPanel.addControl(title);

        // Add spacing
        const spacer1 = this.createSpacer(40);
        mainPanel.addControl(spacer1);

        // Create statistics display
        this._gameTimeText = this.createStatText("Game Time: 00:00");
        mainPanel.addControl(this._gameTimeText);

        this._asteroidsText = this.createStatText("Asteroids Destroyed: 0");
        mainPanel.addControl(this._asteroidsText);

        this._hullDamageText = this.createStatText("Hull Damage Taken: 0%");
        mainPanel.addControl(this._hullDamageText);

        this._shotsFiredText = this.createStatText("Shots Fired: 0");
        mainPanel.addControl(this._shotsFiredText);

        this._accuracyText = this.createStatText("Accuracy: 0%");
        mainPanel.addControl(this._accuracyText);

        this._fuelConsumedText = this.createStatText("Fuel Consumed: 0%");
        mainPanel.addControl(this._fuelConsumedText);

        this._texture.addControl(mainPanel);

        // Initially hide the screen
        this._screenMesh.setEnabled(false);
        this._isVisible = false;
    }

    /**
     * Create title text block
     */
    private createTitleText(text: string): TextBlock {
        const textBlock = new TextBlock();
        textBlock.text = text;
        textBlock.color = "#00ff88";
        textBlock.fontSize = "80px";
        textBlock.height = "100px";
        textBlock.fontWeight = "bold";
        textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        return textBlock;
    }

    /**
     * Create stat text block
     */
    private createStatText(text: string): TextBlock {
        const textBlock = new TextBlock();
        textBlock.text = text;
        textBlock.color = "#ffffff";
        textBlock.fontSize = "50px";
        textBlock.height = "70px";
        textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        textBlock.paddingTop = "10px";
        textBlock.paddingBottom = "10px";
        return textBlock;
    }

    /**
     * Create spacer for layout
     */
    private createSpacer(height: number): Rectangle {
        const spacer = new Rectangle();
        spacer.height = `${height}px`;
        spacer.thickness = 0;
        return spacer;
    }

    /**
     * Toggle visibility of status screen
     */
    public toggle(): void {
        if (this._isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show the status screen
     */
    public show(): void {
        if (!this._screenMesh) {
            return;
        }

        // Update statistics before showing
        this.updateStatistics();

        // Simply enable the mesh - position/rotation handled by parenting
        this._screenMesh.setEnabled(true);
        this._isVisible = true;
    }

    /**
     * Hide the status screen
     */
    public hide(): void {
        if (!this._screenMesh) {
            return;
        }

        this._screenMesh.setEnabled(false);
        this._isVisible = false;
    }

    /**
     * Update displayed statistics
     */
    public updateStatistics(): void {
        const stats = this._gameStats.getStats();

        this._gameTimeText.text = `Game Time: ${stats.gameTime}`;
        this._asteroidsText.text = `Asteroids Destroyed: ${stats.asteroidsDestroyed}`;
        this._hullDamageText.text = `Hull Damage Taken: ${stats.hullDamageTaken}%`;
        this._shotsFiredText.text = `Shots Fired: ${stats.shotsFired}`;
        this._accuracyText.text = `Accuracy: ${stats.accuracy}%`;
        this._fuelConsumedText.text = `Fuel Consumed: ${stats.fuelConsumed}%`;
    }

    /**
     * Check if status screen is visible
     */
    public get isVisible(): boolean {
        return this._isVisible;
    }

    /**
     * Dispose of status screen resources
     */
    public dispose(): void {
        if (this._texture) {
            this._texture.dispose();
        }
        if (this._screenMesh) {
            this._screenMesh.dispose();
        }
    }
}
