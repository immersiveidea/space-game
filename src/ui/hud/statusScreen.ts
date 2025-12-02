import {
    AdvancedDynamicTexture,
    Button,
    Control,
    Rectangle,
    StackPanel,
    TextBlock
} from "@babylonjs/gui";
import {
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import { GameStats } from "../../game/gameStats";
import { DefaultScene } from "../../core/defaultScene";
import { ProgressionManager } from "../../game/progression";
import { AuthService } from "../../services/authService";
import { addButtonHoverEffect } from "../utils/buttonEffects";
import { FacebookShare, ShareData } from "../../services/facebookShare";
import { InputControlManager } from "../../ship/input/inputControlManager";
import { formatStars } from "../../game/scoreCalculator";
import { GameResultsService } from "../../services/gameResultsService";
import log from "../../core/logger";

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
    private _shipNode: TransformNode;
    private _parTime: number = 120; // Default par time in seconds

    // Text blocks for statistics
    private _gameTimeText: TextBlock;
    private _asteroidsText: TextBlock;
    private _hullDamageText: TextBlock;
    private _shotsFiredText: TextBlock;
    private _accuracyText: TextBlock;
    private _fuelConsumedText: TextBlock;

    // Text blocks for score display
    private _scoreTitleText: TextBlock;
    private _finalScoreText: TextBlock;
    private _scoreBreakdownText: TextBlock;
    private _starsContainer: StackPanel;
    private _totalStarsText: TextBlock;

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

    // Track current level info for progression and results
    private _currentLevelName: string | null = null;
    private _currentLevelId: string | null = null;
    private _totalAsteroids: number = 0;

    // Track if result has been recorded (prevent duplicates)
    private _resultRecorded: boolean = false;

    constructor(scene: Scene, shipNode: TransformNode, gameStats: GameStats, onReplay?: () => void, onExit?: () => void, onResume?: () => void, onNextLevel?: () => void) {
        this._scene = scene;
        this._shipNode = shipNode;
        this._gameStats = gameStats;
        this._onReplayCallback = onReplay || null;
        this._onExitCallback = onExit || null;
        this._onResumeCallback = onResume || null;
        this._onNextLevelCallback = onNextLevel || null;
    }

    /**
     * Initialize the status screen mesh and UI
     */
    public initialize(): void {
        // Create a plane mesh for the status screen
        this._screenMesh = MeshBuilder.CreatePlane(
            "statusScreen",
            { width: 1.5, height: 2.25 },
            this._scene
        );

        // Parent to ship for fixed cockpit position
        this._screenMesh.parent = this._shipNode;
        this._screenMesh.position = new Vector3(0, 1.1, 2); // 2 meters forward in local space
        //this._screenMesh.renderingGroupId = 3; // Always render on top
        this._screenMesh.metadata = { uiPickable: true }; // TAG: VR UI - allow pointer selection

        // Create material
        const material = new StandardMaterial("statusScreenMaterial", this._scene);
        this._screenMesh.material = material;

        // Create AdvancedDynamicTexture
        this._texture = AdvancedDynamicTexture.CreateForMesh(
            this._screenMesh,
            1024,
            1536
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

        // Add spacing before score section
        const spacer2 = this.createSpacer(40);
        mainPanel.addControl(spacer2);

        // Score section divider
        const scoreDivider = new Rectangle("scoreDivider");
        scoreDivider.height = "2px";
        scoreDivider.width = "700px";
        scoreDivider.background = "#00ff88";
        scoreDivider.thickness = 0;
        mainPanel.addControl(scoreDivider);

        const spacer2b = this.createSpacer(30);
        mainPanel.addControl(spacer2b);

        // Score title (changes based on game state)
        this._scoreTitleText = this.createTitleText("CURRENT SCORE");
        this._scoreTitleText.fontSize = "50px";
        this._scoreTitleText.height = "70px";
        mainPanel.addControl(this._scoreTitleText);

        this._finalScoreText = new TextBlock();
        this._finalScoreText.text = "0";
        this._finalScoreText.color = "#FFD700"; // Gold color
        this._finalScoreText.fontSize = "80px";
        this._finalScoreText.height = "100px";
        this._finalScoreText.fontWeight = "bold";
        this._finalScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainPanel.addControl(this._finalScoreText);

        // Score breakdown
        this._scoreBreakdownText = new TextBlock();
        this._scoreBreakdownText.text = "";
        this._scoreBreakdownText.color = "#aaaaaa";
        this._scoreBreakdownText.fontSize = "20px";
        this._scoreBreakdownText.height = "120px";
        this._scoreBreakdownText.width = "100%";
        this._scoreBreakdownText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this._scoreBreakdownText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._scoreBreakdownText.textWrapping = true;
        mainPanel.addControl(this._scoreBreakdownText);

        // Star ratings container (populated in updateStatistics)
        this._starsContainer = new StackPanel("starsContainer");
        this._starsContainer.isVertical = false;
        this._starsContainer.height = "100px";
        this._starsContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainPanel.addControl(this._starsContainer);

        // Total stars display
        this._totalStarsText = new TextBlock();
        this._totalStarsText.text = "";
        this._totalStarsText.color = "#FFD700";
        this._totalStarsText.fontSize = "32px";
        this._totalStarsText.height = "50px";
        this._totalStarsText.fontWeight = "bold";
        this._totalStarsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainPanel.addControl(this._totalStarsText);

        // Add spacing before buttons
        const spacer3 = this.createSpacer(40);
        mainPanel.addControl(spacer3);

        // Create button bar
        const buttonBar = new StackPanel("buttonBar");
        buttonBar.isVertical = false;
        buttonBar.height = "80px";
        buttonBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonBar.spacing = 20;
        buttonBar.paddingLeft = 20;
        buttonBar.paddingRight = 20;
        buttonBar.clipChildren = false;

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
        addButtonHoverEffect(this._resumeButton);
        this._resumeButton.onPointerClickObservable.add(() => {
            if (this._onResumeCallback) {
                this._onResumeCallback();
            }
        });
        buttonBar.addControl(this._resumeButton);

        // Create Next Level button (only shown when game has ended and there's a next level)
        /*this._nextLevelButton = Button.CreateSimpleButton("nextLevelButton", "NEXT LEVEL");
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
        buttonBar.addControl(this._replayButton);*/

        // Create Exit VR button
        this._exitButton = Button.CreateSimpleButton("exitButton", "EXIT");
        this._exitButton.width = "300px";
        this._exitButton.height = "60px";
        this._exitButton.color = "white";
        this._exitButton.background = "#cc3333";
        this._exitButton.cornerRadius = 10;
        this._exitButton.thickness = 0;
        this._exitButton.fontSize = "30px";
        this._exitButton.fontWeight = "bold";
        addButtonHoverEffect(this._exitButton, "#cc3333", "#ff4444");
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
     * Create a star rating column with stars on top and label below
     */
    private createStarRatingColumn(stars: number, label: string): StackPanel {
        const column = new StackPanel();
        column.isVertical = true;
        column.width = "150px";

        const starsText = new TextBlock();
        starsText.text = formatStars(stars);
        starsText.color = "#FFD700";
        starsText.fontSize = "36px";
        starsText.height = "50px";
        starsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        column.addControl(starsText);

        const labelText = new TextBlock();
        labelText.text = label;
        labelText.color = "#aaaaaa";
        labelText.fontSize = "24px";
        labelText.height = "35px";
        labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        column.addControl(labelText);

        return column;
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
     * Set the current level info for progression tracking and results
     */
    public setCurrentLevel(levelId: string, levelName: string, totalAsteroids: number): void {
        log.info('[StatusScreen] setCurrentLevel called:', { levelId, levelName, totalAsteroids });
        this._currentLevelId = levelId;
        this._currentLevelName = levelName;
        this._totalAsteroids = totalAsteroids;
    }

    /**
     * Set the par time for score calculation
     * @param parTime - Expected completion time in seconds
     */
    public setParTime(parTime: number): void {
        this._parTime = parTime;
    }

    /**
     * Show the status screen
     * @param isGameEnded - true if game has ended (death/stranded/victory), false if manually paused
     * @param victory - true if the level was completed successfully
     * @param endReason - specific reason for game end ('victory' | 'death' | 'stranded')
     */
    public show(isGameEnded: boolean = false, victory: boolean = false, endReason?: 'victory' | 'death' | 'stranded'): void {
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

        // Record game result when game ends (not on manual pause)
        if (isGameEnded && endReason && !this._resultRecorded) {
            this.recordGameResult(endReason);
            this._resultRecorded = true;
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
                    log.error('Failed to initialize Facebook SDK:', error);
                });
            }
        }

        // Disable ship controls and enable pointer selection via InputControlManager
        const inputManager = InputControlManager.getInstance();
        inputManager.disableShipControls("StatusScreen");

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

        // Re-enable ship controls and disable pointer selection via InputControlManager
        const inputManager = InputControlManager.getInstance();
        inputManager.enableShipControls("StatusScreen");

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

        // Calculate score - only include end-game bonuses if game has ended
        const scoreCalc = this._gameStats.getFinalScore(this._isGameEnded);

        // Update score title based on game state
        this._scoreTitleText.text = this._isGameEnded ? "FINAL SCORE" : "CURRENT SCORE";

        // Update score value
        this._finalScoreText.text = scoreCalc.finalScore.toLocaleString();

        // Update score breakdown - show bonuses only at game end
        if (this._isGameEnded) {
            this._scoreBreakdownText.text =
                `Asteroids: ${scoreCalc.asteroidScore.toLocaleString()}  |  ` +
                `Acc: +${scoreCalc.bonuses.accuracy.toLocaleString()}\n` +
                `Fuel: +${scoreCalc.bonuses.fuel.toLocaleString()}  |  ` +
                `Hull: +${scoreCalc.bonuses.hull.toLocaleString()}`;
        } else {
            this._scoreBreakdownText.text = `Points from asteroid destruction`;
        }

        // Rebuild star rating columns
        this._starsContainer.clearControls();
        this._starsContainer.addControl(this.createStarRatingColumn(scoreCalc.stars.asteroids, "Kills"));
        this._starsContainer.addControl(this.createStarRatingColumn(scoreCalc.stars.accuracy, "Acc"));
        this._starsContainer.addControl(this.createStarRatingColumn(scoreCalc.stars.fuel, "Fuel"));
        this._starsContainer.addControl(this.createStarRatingColumn(scoreCalc.stars.hull, "Hull"));

        // Update total stars
        this._totalStarsText.text = `${scoreCalc.stars.total}/12 Stars`;
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
                    log.info('Results copied to clipboard!');

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
     * Record game result to the results service
     */
    private recordGameResult(endReason: 'victory' | 'death' | 'stranded'): void {
        log.info('[StatusScreen] recordGameResult called with endReason:', endReason);
        log.info('[StatusScreen] Level info:', {
            levelId: this._currentLevelId,
            levelName: this._currentLevelName,
            totalAsteroids: this._totalAsteroids,
            parTime: this._parTime
        });

        // Only record if we have level info
        if (!this._currentLevelId || !this._currentLevelName) {
            log.warn('[StatusScreen] Cannot record result - missing level info');
            log.debug('[StatusScreen] Cannot record result - missing level info');
            return;
        }

        try {
            const result = GameResultsService.buildResult(
                this._currentLevelId,
                this._currentLevelName,
                this._gameStats,
                this._totalAsteroids,
                endReason
            );

            log.info('[StatusScreen] Built result:', result);

            const service = GameResultsService.getInstance();
            service.saveResult(result);
            log.info('[StatusScreen] Game result saved successfully');
            log.debug('[StatusScreen] Game result recorded:', result.id, result.finalScore, result.endReason);
        } catch (error) {
            log.error('[StatusScreen] Failed to record game result:', error);
            log.debug('[StatusScreen] Failed to record game result:', error);
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
