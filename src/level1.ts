import {DefaultScene} from "./defaultScene";
import type {AudioEngineV2} from "@babylonjs/core";
import {
    AbstractMesh,
    Observable,
    PhysicsAggregate,
    Vector3,
    WebXRState
} from "@babylonjs/core";
import {Ship} from "./ship";
import Level from "./level";
import setLoadingMessage from "./setLoadingMessage";
import {LevelConfig} from "./levelConfig";
import {LevelDeserializer} from "./levelDeserializer";
import {BackgroundStars} from "./backgroundStars";
import debugLog from './debug';
import {PhysicsRecorder} from "./physicsRecorder";

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh | null;
    private _landingAggregate: PhysicsAggregate | null;
    private _endBase: AbstractMesh;
    private _levelConfig: LevelConfig;
    private _audioEngine: AudioEngineV2;
    private _deserializer: LevelDeserializer;
    private _backgroundStars: BackgroundStars;
    private _physicsRecorder: PhysicsRecorder;
    private _isReplayMode: boolean;

    constructor(levelConfig: LevelConfig, audioEngine: AudioEngineV2, isReplayMode: boolean = false) {
        this._levelConfig = levelConfig;
        this._audioEngine = audioEngine;
        this._isReplayMode = isReplayMode;
        this._deserializer = new LevelDeserializer(levelConfig);
        this._ship = new Ship(audioEngine, isReplayMode);

        // Only set up XR observables in game mode (not replay mode)
        if (!isReplayMode && DefaultScene.XR) {
            const xr = DefaultScene.XR;

            debugLog('Level1 constructor - Setting up XR observables');
            debugLog('XR input exists:', !!xr.input);
            debugLog('onControllerAddedObservable exists:', !!xr.input?.onControllerAddedObservable);

            xr.baseExperience.onInitialXRPoseSetObservable.add(() => {
                xr.baseExperience.camera.parent = this._ship.transformNode;
                const currPose =  xr.baseExperience.camera.globalPosition.y;
                xr.baseExperience.camera.position = new Vector3(0, 1.5, 0);

                // Start game timer when XR pose is set
                this._ship.gameStats.startTimer();
                debugLog('Game timer started');

                // Start physics recording when gameplay begins
                if (this._physicsRecorder) {
                    this._physicsRecorder.startRingBuffer();
                    debugLog('Physics recorder started');
                }

                const observer = xr.input.onControllerAddedObservable.add((controller) => {
                    debugLog('🎮 onControllerAddedObservable FIRED for:', controller.inputSource.handedness);
                    this._ship.addController(controller);
                });
            });
        }
        // Don't call initialize here - let Main call it after registering the observable
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    public async play() {
        if (this._isReplayMode) {
            throw new Error("Cannot call play() in replay mode");
        }

        // Create background music using AudioEngineV2
        if (this._audioEngine) {
            const background = await this._audioEngine.createSoundAsync("background", "/song1.mp3", {
                loop: true,
                volume: 0.5
            });
            background.play();
        }

        // If XR is available and session is active, check for controllers
        if (DefaultScene.XR && DefaultScene.XR.baseExperience.state === WebXRState.IN_XR) {
            // XR session already active, just check for controllers
            debugLog('XR session already active, checking for controllers. Count:', DefaultScene.XR.input.controllers.length);
            DefaultScene.XR.input.controllers.forEach((controller, index) => {
                debugLog(`Controller ${index} - handedness: ${controller.inputSource.handedness}`);
                this._ship.addController(controller);
            });

            // Wait and check again after a delay (controllers might connect later)
            debugLog('Waiting 2 seconds to check for controllers again...');
            setTimeout(() => {
                debugLog('After 2 second delay - controller count:', DefaultScene.XR.input.controllers.length);
                DefaultScene.XR.input.controllers.forEach((controller, index) => {
                    debugLog(`  Late controller ${index} - handedness: ${controller.inputSource.handedness}`);
                });
            }, 2000);
        } else if (DefaultScene.XR) {
            // XR available but not entered yet, try to enter
            try {
                const xr = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
                debugLog('Entered XR mode from play()');
                // Check for controllers
                DefaultScene.XR.input.controllers.forEach((controller, index) => {
                    debugLog(`Controller ${index} - handedness: ${controller.inputSource.handedness}`);
                    this._ship.addController(controller);
                });
            } catch (error) {
                debugLog('Failed to enter XR from play(), falling back to flat mode:', error);
                // Start flat mode
                this._ship.gameStats.startTimer();
                debugLog('Game timer started (flat mode)');

                if (this._physicsRecorder) {
                    this._physicsRecorder.startRingBuffer();
                    debugLog('Physics recorder started (flat mode)');
                }
            }
        } else {
            // Flat camera mode - start game timer and physics recording immediately
            debugLog('Playing in flat camera mode (no XR)');
            this._ship.gameStats.startTimer();
            debugLog('Game timer started');

            if (this._physicsRecorder) {
                this._physicsRecorder.startRingBuffer();
                debugLog('Physics recorder started');
            }
        }
    }

    public dispose() {
        if (this._startBase) {
            this._startBase.dispose();
        }
        this._endBase.dispose();
        if (this._backgroundStars) {
            this._backgroundStars.dispose();
        }
        if (this._physicsRecorder) {
            this._physicsRecorder.dispose();
        }
    }

    public async initialize() {
        debugLog('Initializing level from config:', this._levelConfig.difficulty);
        if (this._initialized) {
            console.error('Initialize called twice');
            return;
        }
        await this._ship.initialize();
        setLoadingMessage("Loading level from configuration...");

        // Use deserializer to create all entities from config
        const entities = await this._deserializer.deserialize(this._ship.scoreboard.onScoreObservable);

        this._startBase = entities.startBase;
        this._landingAggregate = entities.landingAggregate;

        // Setup resupply system if landing aggregate exists
        if (this._landingAggregate) {
            this._ship.setLandingZone(this._landingAggregate);
        }

        // sun and planets are already created by deserializer

        // Initialize scoreboard with total asteroid count
        this._ship.scoreboard.setRemainingCount(entities.asteroids.length);
        debugLog(`Initialized scoreboard with ${entities.asteroids.length} asteroids`);

        // Create background starfield
        setLoadingMessage("Creating starfield...");
        this._backgroundStars = new BackgroundStars(DefaultScene.MainScene, {
            count: 5000,
            radius: 5000,
            minBrightness: 0.3,
            maxBrightness: 1.0,
            pointSize: 2
        });

        // Set up camera follow for stars (keeps stars at infinite distance)
        DefaultScene.MainScene.onBeforeRenderObservable.add(() => {
            if (this._backgroundStars) {
                const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
                if (camera) {
                    this._backgroundStars.followCamera(camera.position);
                }
            }
        });

        // Initialize physics recorder (but don't start it yet - will start on XR pose)
        // Only create recorder in game mode, not replay mode
        if (!this._isReplayMode) {
            setLoadingMessage("Initializing physics recorder...");
            this._physicsRecorder = new PhysicsRecorder(DefaultScene.MainScene, this._levelConfig);
            debugLog('Physics recorder initialized (will start on XR pose)');
        }

        // Wire up recording keyboard shortcuts (only in game mode)
        if (!this._isReplayMode) {
            this._ship.keyboardInput.onRecordingActionObservable.add((action) => {
                this.handleRecordingAction(action);
            });
        }

        this._initialized = true;

        // Notify that initialization is complete
        this._onReadyObservable.notifyObservers(this);
    }

    /**
     * Handle recording keyboard shortcuts
     */
    private handleRecordingAction(action: string): void {
        switch (action) {
            case "exportRingBuffer":
                // R key: Export last 30 seconds from ring buffer
                const ringRecording = this._physicsRecorder.exportRingBuffer(30);
                this._physicsRecorder.downloadRecording(ringRecording, "ring-buffer-30s");
                debugLog("Exported ring buffer (last 30 seconds)");
                break;

            case "toggleLongRecording":
                // Ctrl+R: Toggle long recording
                const stats = this._physicsRecorder.getStats();
                if (stats.isLongRecording) {
                    this._physicsRecorder.stopLongRecording();
                    debugLog("Long recording stopped");
                } else {
                    this._physicsRecorder.startLongRecording();
                    debugLog("Long recording started");
                }
                break;

            case "exportLongRecording":
                // Shift+R: Export long recording
                const longRecording = this._physicsRecorder.exportLongRecording();
                if (longRecording.snapshots.length > 0) {
                    this._physicsRecorder.downloadRecording(longRecording, "long-recording");
                    debugLog("Exported long recording");
                } else {
                    debugLog("No long recording data to export");
                }
                break;
        }
    }


    /**
     * Get the physics recorder instance
     */
    public get physicsRecorder(): PhysicsRecorder {
        return this._physicsRecorder;
    }
}