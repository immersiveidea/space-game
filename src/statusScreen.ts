import {
    AdvancedDynamicTexture,
    Button,
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
import { DefaultScene } from "./defaultScene";
import { ProgressionManager } from "./progression";
import { AuthService } from "./authService";
import { FacebookShare, ShareData } from "./facebookShare";

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

    // Buttons
    private _replayButton: Button;
    private _exitButton: Button;
    private _resumeButton: Button;
    private _nextLevelButton: Button;
    private _shareButton: Button | null = null;

    // Callbacks
    private _onReplayCallback: (() => void) | null = null;
    private _onExitCallback: (() => void) | null = null;
    private _onResumeCallback: (() => void) | null = null;
    private _onNextLevelCallback: (() => void) | null = null;

    // Track whether game has ended
    private _isGameEnded: boolean = false;

    // Track current level name for progression
    private _currentLevelName: string | null = null;

    constructor(scene: Scene, gameStats: GameStats, onReplay?: () => void, onExit?: () => void, onResume?: () => void, onNextLevel?: () => void) {
        this._scene = scene;
        this._gameStats = gameStats;
        this._onReplayCallback = onReplay || null;
        this._onExitCallback = onExit || null;
        this._onResumeCallback = onResume || null;
        this._onNextLevelCallback = onNextLevel || null;
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

        // Add spacing before buttons
        const spacer2 = this.createSpacer(50);
        mainPanel.addControl(spacer2);

        // Create button bar
        const buttonBar = new StackPanel("buttonBar");
        buttonBar.isVertical = false;
        buttonBar.height = "80px";
        buttonBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonBar.spacing = 20;

        // Create Resume button (only shown when game hasn't ended)
        this._resumeButton = Button.CreateSimpleButton("resumeButton", "RESUME GAME");
        this._resumeButton.width = "300px";
        this._resumeButton.height = "60px";
        this._resumeButton.color = "white";
        this._resumeButton.background = "#00ff88";
        this._resumeButton.cornerRadius = 10;
        this._resumeButton.thickness = 0;
        this._resumeButton.fontSize = "30px";
        this._resumeButton.fontWeight = "bold";
        this._resumeButton.onPointerClickObservable.add(() => {
            if (this._onResumeCallback) {
                this._onResumeCallback();
            }
        });
        buttonBar.addControl(this._resumeButton);

        // Create Next Level button (only shown when game has ended and there's a next level)
        this._nextLevelButton = Button.CreateSimpleButton("nextLevelButton", "NEXT LEVEL");
        this._nextLevelButton.width = "300px";
        this._nextLevelButton.height = "60px";
        this._nextLevelButton.color = "white";
        this._nextLevelButton.background = "#0088ff";
        this._nextLevelButton.cornerRadius = 10;
        this._nextLevelButton.thickness = 0;
        this._nextLevelButton.fontSize = "30px";
        this._nextLevelButton.fontWeight = "bold";
        this._nextLevelButton.onPointerClickObservable.add(() => {
            if (this._onNextLevelCallback) {
                this._onNextLevelCallback();
            }
        });
        buttonBar.addControl(this._nextLevelButton);

        // Create Replay button (only shown when game has ended)
        this._replayButton = Button.CreateSimpleButton("replayButton", "REPLAY");
        this._replayButton.width = "300px";
        this._replayButton.height = "60px";
        this._replayButton.color = "white";
        this._replayButton.background = "#00ff88";
        this._replayButton.cornerRadius = 10;
        this._replayButton.thickness = 0;
        this._replayButton.fontSize = "30px";
        this._replayButton.fontWeight = "bold";
        this._replayButton.onPointerClickObservable.add(() => {
            if (this._onReplayCallback) {
                this._onReplayCallback();
            }
        });
        buttonBar.addControl(this._replayButton);

        // Create Exit VR button
        this._exitButton = Button.CreateSimpleButton("exitButton", "EXIT VR");
        this._exitButton.width = "300px";
        this._exitButton.height = "60px";
        this._exitButton.color = "white";
        this._exitButton.background = "#cc3333";
        this._exitButton.cornerRadius = 10;
        this._exitButton.thickness = 0;
        this._exitButton.fontSize = "30px";
        this._exitButton.fontWeight = "bold";
        this._exitButton.onPointerClickObservable.add(() => {
            if (this._onExitCallback) {
                this._onExitCallback();
            }
        });
        buttonBar.addControl(this._exitButton);

        mainPanel.addControl(buttonBar);

        // Create share button bar (separate row for social sharing)
        const shareBar = new StackPanel("shareBar");
        shareBar.isVertical = false;
        shareBar.height = "80px";
        shareBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        shareBar.spacing = 20;
        shareBar.paddingTop = "20px";

        // Create Share button (only shown when user is authenticated with Facebook)
        this._shareButton = Button.CreateSimpleButton("shareButton", "📱 SHARE ON FACEBOOK");
        this._shareButton.width = "400px";
        this._shareButton.height = "60px";
        this._shareButton.color = "white";
        this._shareButton.background = "#1877f2"; // Facebook blue
        this._shareButton.cornerRadius = 10;
        this._shareButton.thickness = 0;
        this._shareButton.fontSize = "28px";
        this._shareButton.fontWeight = "bold";
        this._shareButton.isVisible = false; // Hidden by default, shown only for Facebook users
        this._shareButton.onPointerClickObservable.add(() => {
            this.handleShareClick();
        });
        shareBar.addControl(this._shareButton);

        mainPanel.addControl(shareBar);

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
     * Enable VR controller picking for button interaction
     */
    private enablePointerSelection(): void {
        // Get the stored pointer selection feature
        const pointerFeature = (DefaultScene.XR as any)?.pointerSelectionFeature;
        if (pointerFeature && DefaultScene.XR?.baseExperience?.state === 2) { // WebXRState.IN_XR = 2
            try {
                // Attach the feature to enable pointer interaction
                pointerFeature.attach();
            } catch (error) {
                console.warn('Failed to attach pointer selection:', error);
            }
        }
    }

    /**
     * Disable VR controller picking
     */
    private disablePointerSelection(): void {
        // Get the stored pointer selection feature
        const pointerFeature = (DefaultScene.XR as any)?.pointerSelectionFeature;
        if (pointerFeature) {
            try {
                // Detach the feature to disable pointer interaction
                pointerFeature.detach();
            } catch (error) {
                console.warn('Failed to detach pointer selection:', error);
            }
        }
    }

    /**
     * Set the current level name for progression tracking
     */
    public setCurrentLevel(levelName: string): void {
        this._currentLevelName = levelName;
    }

    /**
     * Show the status screen
     * @param isGameEnded - true if game has ended (death/stranded/victory), false if manually paused
     * @param victory - true if the level was completed successfully
     */
    public show(isGameEnded: boolean = false, victory: boolean = false): void {
        if (!this._screenMesh) {
            return;
        }

        // Store game ended state
        this._isGameEnded = isGameEnded;

        // Mark level as complete if victory and we have a level name
        const progression = ProgressionManager.getInstance();
        if (victory && this._currentLevelName) {
            const stats = this._gameStats.getStats();
            const gameTimeSeconds = this.parseGameTime(stats.gameTime);
            progression.markLevelComplete(this._currentLevelName, {
                completionTime: gameTimeSeconds,
                accuracy: stats.accuracy // Already a number from getAccuracy()
            });
        }

        // Determine if there's a next level
        const nextLevel = progression.getNextLevel();
        const hasNextLevel = nextLevel !== null;

        // Show/hide appropriate buttons based on whether game has ended
        if (this._resumeButton) {
            this._resumeButton.isVisible = !isGameEnded;
        }
        if (this._replayButton) {
            this._replayButton.isVisible = isGameEnded;
        }
        if (this._nextLevelButton) {
            // Only show Next Level if game ended in victory and there's a next level
            this._nextLevelButton.isVisible = isGameEnded && victory && hasNextLevel;
        }

        // Show share button only if game ended in victory and user is authenticated with Facebook
        if (this._shareButton) {
            const authService = AuthService.getInstance();
            const isFacebookUser = authService.isAuthenticatedWithFacebook();
            this._shareButton.isVisible = isGameEnded && victory && isFacebookUser;

            // Initialize Facebook SDK if needed
            if (this._shareButton.isVisible) {
                const fbShare = FacebookShare.getInstance();
                fbShare.initialize().catch(error => {
                    console.error('Failed to initialize Facebook SDK:', error);
                });
            }
        }

        // Enable pointer selection for button interaction
        this.enablePointerSelection();

        // Update statistics before showing
        this.updateStatistics();

        // Simply enable the mesh - position/rotation handled by parenting
        this._screenMesh.setEnabled(true);
        this._isVisible = true;
    }

    /**
     * Parse game time string (MM:SS) to seconds
     */
    private parseGameTime(timeString: string): number {
        const parts = timeString.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            return minutes * 60 + seconds;
        }
        return 0;
    }

    /**
     * Hide the status screen
     */
    public hide(): void {
        if (!this._screenMesh) {
            return;
        }

        // Disable pointer selection when hiding
        this.disablePointerSelection();

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
     * Handle Facebook share button click
     */
    private async handleShareClick(): Promise<void> {
        const stats = this._gameStats.getStats();
        const fbShare = FacebookShare.getInstance();

        // Prepare share data
        const shareData: ShareData = {
            levelName: this._currentLevelName || 'Unknown Level',
            gameTime: stats.gameTime,
            asteroidsDestroyed: stats.asteroidsDestroyed,
            accuracy: stats.accuracy,
            completed: true
        };

        // Try to share via Facebook SDK
        const success = await fbShare.shareResults(shareData);

        if (!success) {
            // Fallback to Web Share API or copy to clipboard
            const webShareSuccess = await fbShare.shareWithWebAPI(shareData);

            if (!webShareSuccess) {
                // Final fallback - copy to clipboard
                const copied = await fbShare.copyToClipboard(shareData);
                if (copied) {
                    // Show notification (you could add a toast notification here)
                    console.log('Results copied to clipboard!');

                    // Update button text temporarily to show feedback
                    if (this._shareButton) {
                        const originalText = this._shareButton.textBlock?.text;
                        if (this._shareButton.textBlock) {
                            this._shareButton.textBlock.text = "✓ COPIED TO CLIPBOARD";
                        }
                        setTimeout(() => {
                            if (this._shareButton?.textBlock && originalText) {
                                this._shareButton.textBlock.text = originalText;
                            }
                        }, 2000);
                    }
                }
            }
        } else {
            // Success! Show feedback
            if (this._shareButton) {
                const originalText = this._shareButton.textBlock?.text;
                const originalColor = this._shareButton.background;

                if (this._shareButton.textBlock) {
                    this._shareButton.textBlock.text = "✓ SHARED!";
                }
                this._shareButton.background = "#00ff88";

                setTimeout(() => {
                    if (this._shareButton?.textBlock && originalText) {
                        this._shareButton.textBlock.text = originalText;
                        this._shareButton.background = originalColor;
                    }
                }, 2000);
            }
        }
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
