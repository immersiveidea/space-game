import {
    AdvancedDynamicTexture,
    Button,
    Control,
    Rectangle,
    Slider,
    StackPanel,
    TextBlock
} from "@babylonjs/gui";
import { ReplayPlayer } from "./ReplayPlayer";
import { CameraMode, ReplayCamera } from "./ReplayCamera";
import debugLog from "../core/debug";

/**
 * UI controls for replay playback
 * Bottom control bar with play/pause, speed, scrubbing, etc.
 */
export class ReplayControls {
    private _texture: AdvancedDynamicTexture;
    private _player: ReplayPlayer;
    private _camera: ReplayCamera;

    // UI Elements
    private _controlBar: Rectangle;
    private _playPauseButton: Button;
    private _progressSlider: Slider;
    private _timeText: TextBlock;
    private _speedText: TextBlock;
    private _cameraButton: Button;

    private _onExitCallback: () => void;

    constructor(player: ReplayPlayer, camera: ReplayCamera, onExit: () => void) {
        this._player = player;
        this._camera = camera;
        this._onExitCallback = onExit;
    }

    /**
     * Initialize UI elements
     */
    public initialize(): void {
        this._texture = AdvancedDynamicTexture.CreateFullscreenUI("replayControls");

        // Create control bar at bottom
        this.createControlBar();

        // Create buttons and controls
        this.createPlayPauseButton();
        this.createStepButtons();
        this.createSpeedButtons();
        this.createProgressSlider();
        this.createTimeDisplay();
        this.createCameraButton();
        this.createExitButton();

        debugLog("ReplayControls: UI initialized");
    }

    /**
     * Create bottom control bar container
     */
    private createControlBar(): void {
        this._controlBar = new Rectangle("controlBar");
        this._controlBar.width = "100%";
        this._controlBar.height = "140px";
        this._controlBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this._controlBar.background = "rgba(26, 26, 46, 0.95)";
        this._controlBar.thickness = 0;
        this._texture.addControl(this._controlBar);

        // Inner container for spacing
        const innerPanel = new StackPanel("innerPanel");
        innerPanel.isVertical = true;
        innerPanel.paddingTop = "10px";
        innerPanel.paddingBottom = "10px";
        innerPanel.paddingLeft = "20px";
        innerPanel.paddingRight = "20px";
        this._controlBar.addControl(innerPanel);
    }

    /**
     * Create play/pause button
     */
    private createPlayPauseButton(): void {
        this._playPauseButton = Button.CreateSimpleButton("playPause", "▶ Play");
        this._playPauseButton.width = "120px";
        this._playPauseButton.height = "50px";
        this._playPauseButton.color = "white";
        this._playPauseButton.background = "#00ff88";
        this._playPauseButton.cornerRadius = 10;
        this._playPauseButton.thickness = 0;
        this._playPauseButton.fontSize = "20px";
        this._playPauseButton.fontWeight = "bold";

        this._playPauseButton.left = "20px";
        this._playPauseButton.top = "20px";
        this._playPauseButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._playPauseButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        this._playPauseButton.onPointerClickObservable.add(() => {
            this._player.togglePlayPause();
        });

        // Update button text based on play state
        this._player.onPlayStateChanged.add((isPlaying) => {
            this._playPauseButton.textBlock!.text = isPlaying ? "⏸ Pause" : "▶ Play";
        });

        this._controlBar.addControl(this._playPauseButton);
    }

    /**
     * Create frame step buttons
     */
    private createStepButtons(): void {
        // Step backward button
        const stepBackBtn = Button.CreateSimpleButton("stepBack", "◀◀");
        stepBackBtn.width = "60px";
        stepBackBtn.height = "50px";
        stepBackBtn.color = "white";
        stepBackBtn.background = "#555";
        stepBackBtn.cornerRadius = 10;
        stepBackBtn.thickness = 0;
        stepBackBtn.fontSize = "18px";

        stepBackBtn.left = "150px";
        stepBackBtn.top = "20px";
        stepBackBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stepBackBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        stepBackBtn.onPointerClickObservable.add(() => {
            this._player.stepBackward();
        });

        this._controlBar.addControl(stepBackBtn);

        // Step forward button
        const stepFwdBtn = Button.CreateSimpleButton("stepFwd", "▶▶");
        stepFwdBtn.width = "60px";
        stepFwdBtn.height = "50px";
        stepFwdBtn.color = "white";
        stepFwdBtn.background = "#555";
        stepFwdBtn.cornerRadius = 10;
        stepFwdBtn.thickness = 0;
        stepFwdBtn.fontSize = "18px";

        stepFwdBtn.left = "220px";
        stepFwdBtn.top = "20px";
        stepFwdBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stepFwdBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        stepFwdBtn.onPointerClickObservable.add(() => {
            this._player.stepForward();
        });

        this._controlBar.addControl(stepFwdBtn);
    }

    /**
     * Create speed control buttons
     */
    private createSpeedButtons(): void {
        // Speed label
        this._speedText = new TextBlock("speedLabel", "Speed: 1.0x");
        this._speedText.width = "120px";
        this._speedText.height = "30px";
        this._speedText.color = "white";
        this._speedText.fontSize = "16px";
        this._speedText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        this._speedText.left = "-320px";
        this._speedText.top = "10px";
        this._speedText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this._speedText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        this._controlBar.addControl(this._speedText);

        // 0.5x button
        const speed05Btn = Button.CreateSimpleButton("speed05", "0.5x");
        speed05Btn.width = "60px";
        speed05Btn.height = "40px";
        speed05Btn.color = "white";
        speed05Btn.background = "#444";
        speed05Btn.cornerRadius = 5;
        speed05Btn.thickness = 0;
        speed05Btn.fontSize = "14px";

        speed05Btn.left = "-250px";
        speed05Btn.top = "20px";
        speed05Btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        speed05Btn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        speed05Btn.onPointerClickObservable.add(() => {
            this._player.setPlaybackSpeed(0.5);
            this._speedText.text = "Speed: 0.5x";
        });

        this._controlBar.addControl(speed05Btn);

        // 1x button
        const speed1Btn = Button.CreateSimpleButton("speed1", "1.0x");
        speed1Btn.width = "60px";
        speed1Btn.height = "40px";
        speed1Btn.color = "white";
        speed1Btn.background = "#444";
        speed1Btn.cornerRadius = 5;
        speed1Btn.thickness = 0;
        speed1Btn.fontSize = "14px";

        speed1Btn.left = "-180px";
        speed1Btn.top = "20px";
        speed1Btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        speed1Btn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        speed1Btn.onPointerClickObservable.add(() => {
            this._player.setPlaybackSpeed(1.0);
            this._speedText.text = "Speed: 1.0x";
        });

        this._controlBar.addControl(speed1Btn);

        // 2x button
        const speed2Btn = Button.CreateSimpleButton("speed2", "2.0x");
        speed2Btn.width = "60px";
        speed2Btn.height = "40px";
        speed2Btn.color = "white";
        speed2Btn.background = "#444";
        speed2Btn.cornerRadius = 5;
        speed2Btn.thickness = 0;
        speed2Btn.fontSize = "14px";

        speed2Btn.left = "-110px";
        speed2Btn.top = "20px";
        speed2Btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        speed2Btn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        speed2Btn.onPointerClickObservable.add(() => {
            this._player.setPlaybackSpeed(2.0);
            this._speedText.text = "Speed: 2.0x";
        });

        this._controlBar.addControl(speed2Btn);
    }

    /**
     * Create progress slider for scrubbing
     */
    private createProgressSlider(): void {
        this._progressSlider = new Slider("progress");
        this._progressSlider.minimum = 0;
        this._progressSlider.maximum = this._player.getTotalFrames() - 1;
        this._progressSlider.value = 0;
        this._progressSlider.width = "60%";
        this._progressSlider.height = "30px";
        this._progressSlider.color = "#00ff88";
        this._progressSlider.background = "#333";
        this._progressSlider.borderColor = "#555";
        this._progressSlider.thumbColor = "#00ff88";
        this._progressSlider.thumbWidth = "20px";

        this._progressSlider.top = "80px";
        this._progressSlider.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this._progressSlider.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        let isDragging = false;

        this._progressSlider.onPointerDownObservable.add(() => {
            isDragging = true;
            this._player.pause(); // Pause while scrubbing
        });

        this._progressSlider.onPointerUpObservable.add(() => {
            isDragging = false;
        });

        this._progressSlider.onValueChangedObservable.add((value) => {
            if (isDragging) {
                this._player.scrubTo(Math.floor(value));
            }
        });

        this._controlBar.addControl(this._progressSlider);
    }

    /**
     * Create time display
     */
    private createTimeDisplay(): void {
        this._timeText = new TextBlock("time", "00:00 / 00:00");
        this._timeText.width = "150px";
        this._timeText.height = "30px";
        this._timeText.color = "white";
        this._timeText.fontSize = "18px";
        this._timeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        this._timeText.top = "80px";
        this._timeText.left = "-20px";
        this._timeText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this._timeText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        this._controlBar.addControl(this._timeText);
    }

    /**
     * Create camera mode toggle button
     */
    private createCameraButton(): void {
        this._cameraButton = Button.CreateSimpleButton("cameraMode", "📷 Free Camera");
        this._cameraButton.width = "180px";
        this._cameraButton.height = "40px";
        this._cameraButton.color = "white";
        this._cameraButton.background = "#3a3a4e";
        this._cameraButton.cornerRadius = 5;
        this._cameraButton.thickness = 0;
        this._cameraButton.fontSize = "16px";

        this._cameraButton.top = "20px";
        this._cameraButton.left = "-20px";
        this._cameraButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._cameraButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;

        this._cameraButton.onPointerClickObservable.add(() => {
            this._camera.toggleMode();
            const mode = this._camera.getMode();
            this._cameraButton.textBlock!.text = mode === CameraMode.FREE ? "📷 Free Camera" : "🎯 Following Ship";
        });

        this._texture.addControl(this._cameraButton);
    }

    /**
     * Create exit button
     */
    private createExitButton(): void {
        const exitBtn = Button.CreateSimpleButton("exit", "✕ Exit Replay");
        exitBtn.width = "150px";
        exitBtn.height = "40px";
        exitBtn.color = "white";
        exitBtn.background = "#cc3333";
        exitBtn.cornerRadius = 5;
        exitBtn.thickness = 0;
        exitBtn.fontSize = "16px";
        exitBtn.fontWeight = "bold";

        exitBtn.top = "20px";
        exitBtn.left = "20px";
        exitBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        exitBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

        exitBtn.onPointerClickObservable.add(() => {
            this._onExitCallback();
        });

        this._texture.addControl(exitBtn);
    }

    /**
     * Update UI (call every frame)
     */
    public update(): void {
        // Update progress slider (only if not being dragged by user)
        const currentFrame = this._player.getCurrentFrame();
        if (Math.abs(this._progressSlider.value - currentFrame) > 1) {
            this._progressSlider.value = currentFrame;
        }

        // Update time display
        const currentTime = this._player.getCurrentTime();
        const totalTime = this._player.getTotalDuration();
        this._timeText.text = `${this.formatTime(currentTime)} / ${this.formatTime(totalTime)}`;
    }

    /**
     * Format time in MM:SS
     */
    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Dispose of UI
     */
    public dispose(): void {
        this._texture.dispose();
        debugLog("ReplayControls: Disposed");
    }
}
