import {DefaultScene} from "../core/defaultScene";
import type {AudioEngineV2, StaticSound} from "@babylonjs/core";
import {
    AbstractMesh,
    Observable,
    PhysicsAggregate,
    Vector3,
    WebXRState
} from "@babylonjs/core";
import {Ship} from "../ship/ship";
import Level from "./level";
import setLoadingMessage from "../utils/setLoadingMessage";
import {LevelConfig} from "./config/levelConfig";
import {LevelDeserializer} from "./config/levelDeserializer";
import {BackgroundStars} from "../environment/background/backgroundStars";
import debugLog from '../core/debug';
import {PhysicsRecorder} from "../replay/recording/physicsRecorder";
import {getAnalytics} from "../analytics";
import {MissionBrief} from "../ui/hud/missionBrief";
import {LevelRegistry, LevelDirectoryEntry} from "./storage/levelRegistry";
import { InputControlManager } from "../ship/input/inputControlManager";

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh | null;
    private _landingAggregate: PhysicsAggregate | null;
    private _endBase: AbstractMesh;
    private _levelConfig: LevelConfig;
    private _levelId: string | null = null;
    private _audioEngine: AudioEngineV2;
    private _deserializer: LevelDeserializer;
    private _backgroundStars: BackgroundStars;
    private _physicsRecorder: PhysicsRecorder | null = null;
    private _isReplayMode: boolean;
    private _backgroundMusic: StaticSound;
    private _missionBrief: MissionBrief;
    private _gameStarted: boolean = false;
    private _missionBriefShown: boolean = false;

    constructor(levelConfig: LevelConfig, audioEngine: AudioEngineV2, isReplayMode: boolean = false, levelId?: string) {
        this._levelConfig = levelConfig;
        this._levelId = levelId || null;
        this._audioEngine = audioEngine;
        this._isReplayMode = isReplayMode;
        this._deserializer = new LevelDeserializer(levelConfig);
        this._ship = new Ship(audioEngine, isReplayMode);
        this._missionBrief = new MissionBrief();

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

                // Track WebXR session start
                try {
                    const analytics = getAnalytics();
                    analytics.track('webxr_session_start', {
                        deviceName: navigator.userAgent,
                        isImmersive: true
                    });
                } catch (error) {
                    debugLog('Analytics tracking failed:', error);
                }

                // Add controllers
                const observer = xr.input.onControllerAddedObservable.add((controller) => {
                    debugLog('🎮 onControllerAddedObservable FIRED for:', controller.inputSource.handedness);
                    this._ship.addController(controller);
                });

                // Show mission brief instead of starting immediately
                debugLog('[Level1] Showing mission brief on XR entry');
                this.showMissionBrief();
            });
        }
        // Don't call initialize here - let Main call it after registering the observable
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    /**
     * Show mission brief with directory entry data
     * Public so it can be called from main.ts when XR is already active
     */
    public async showMissionBrief(): Promise<void> {
        // Prevent showing twice
        if (this._missionBriefShown) {
            console.log('[Level1] Mission brief already shown, skipping');
            return;
        }

        this._missionBriefShown = true;
        console.log('[Level1] showMissionBrief() called');

        let directoryEntry: LevelDirectoryEntry | null = null;

        // Try to get directory entry if we have a level ID
        if (this._levelId) {
            try {
                const registry = LevelRegistry.getInstance();
                console.log('[Level1] ======================================');
                console.log('[Level1] Getting all levels from registry...');
                const allLevels = registry.getAllLevels();
                console.log('[Level1] Total levels in registry:', allLevels.size);
                console.log('[Level1] Looking for level ID:', this._levelId);

                const registryEntry = allLevels.get(this._levelId);
                console.log('[Level1] Registry entry found:', !!registryEntry);

                if (registryEntry) {
                    directoryEntry = registryEntry.directoryEntry;
                    console.log('[Level1] Directory entry data:', {
                        id: directoryEntry?.id,
                        name: directoryEntry?.name,
                        description: directoryEntry?.description,
                        levelPath: directoryEntry?.levelPath,
                        missionBriefCount: directoryEntry?.missionBrief?.length || 0,
                        estimatedTime: directoryEntry?.estimatedTime,
                        difficulty: directoryEntry?.difficulty
                    });

                    if (directoryEntry?.missionBrief) {
                        console.log('[Level1] Mission brief objectives:');
                        directoryEntry.missionBrief.forEach((item, i) => {
                            console.log(`  ${i + 1}. ${item}`);
                        });
                    } else {
                        console.warn('[Level1] ⚠️  No missionBrief found in directory entry!');
                    }

                    if (!directoryEntry?.levelPath) {
                        console.warn('[Level1] ⚠️  No levelPath found in directory entry!');
                    }
                } else {
                    console.error('[Level1] ❌ No registry entry found for level ID:', this._levelId);
                    console.log('[Level1] Available level IDs:', Array.from(allLevels.keys()));
                }
                console.log('[Level1] ======================================');

                debugLog('[Level1] Retrieved directory entry for level:', this._levelId, directoryEntry);
            } catch (error) {
                console.error('[Level1] ❌ Exception while getting directory entry:', error);
                debugLog('[Level1] Failed to get directory entry:', error);
            }
        } else {
            console.warn('[Level1] ⚠️  No level ID available, using config-only mission brief');
            debugLog('[Level1] No level ID available, using config-only mission brief');
        }

        console.log('[Level1] About to show mission brief. Has directoryEntry:', !!directoryEntry);

        // Disable ship controls while mission brief is showing
        debugLog('[Level1] Disabling ship controls for mission brief');
        const inputManager = InputControlManager.getInstance();
        inputManager.disableShipControls("MissionBrief");

        // Show mission brief with trigger observable
        this._missionBrief.show(this._levelConfig, directoryEntry, this._ship.onMissionBriefTriggerObservable, () => {
            debugLog('[Level1] Mission brief dismissed - enabling controls and starting game');
            inputManager.enableShipControls("MissionBrief");
            this.startGameplay();
        });
    }

    /**
     * Start gameplay - called when mission brief start button is clicked
     * or immediately if not in XR mode
     */
    private startGameplay(): void {
        if (this._gameStarted) {
            debugLog('[Level1] startGameplay called but game already started');
            return;
        }

        this._gameStarted = true;
        debugLog('[Level1] Starting gameplay');

        // Start game timer
        this._ship.gameStats.startTimer();
        debugLog('Game timer started');

        // Start physics recording
        if (this._physicsRecorder) {
            this._physicsRecorder.startRingBuffer();
            debugLog('Physics recorder started');
        }
    }

    public async play() {
        if (this._isReplayMode) {
            throw new Error("Cannot call play() in replay mode");
        }

        // Track level start
        try {
            const analytics = getAnalytics();
            analytics.track('level_start', {
                levelName: this._levelConfig.metadata?.description || 'level_1',
                difficulty: this._levelConfig.difficulty as any || 'captain',
                playCount: 1 // TODO: Get actual play count from progression system
            });
        } catch (error) {
            debugLog('Analytics tracking failed:', error);
        }

        // Play background music (already loaded during initialization)
        if (this._backgroundMusic) {
            this._backgroundMusic.play();
            debugLog('Started playing background music');
        }

        // If XR is available and session is active, mission brief will handle starting gameplay
        if (DefaultScene.XR && DefaultScene.XR.baseExperience.state === WebXRState.IN_XR) {
            // XR session already active, mission brief is showing or has been dismissed
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

            // Note: Mission brief will call startGameplay() when start button is clicked
            debugLog('XR mode: Mission brief will control game start');
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
                // Mission brief will show and handle starting gameplay
                debugLog('XR mode entered: Mission brief will control game start');
            } catch (error) {
                debugLog('Failed to enter XR from play(), falling back to flat mode:', error);
                // Start flat mode immediately
                this.startGameplay();
            }
        } else {
            // Flat camera mode - start game timer and physics recording immediately
            debugLog('Playing in flat camera mode (no XR)');
            this.startGameplay();
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
        if (this._missionBrief) {
            this._missionBrief.dispose();
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
            //this._physicsRecorder = new PhysicsRecorder(DefaultScene.MainScene, this._levelConfig);
            debugLog('Physics recorder initialized (will start on XR pose)');
        }

        // Load background music before marking as ready
        if (this._audioEngine) {
            setLoadingMessage("Loading background music...");
            this._backgroundMusic = await this._audioEngine.createSoundAsync("background", "/song1.mp3", {
                loop: true,
                volume: 0.5
            });
            debugLog('Background music loaded successfully');
        }

        // Initialize mission brief (will be shown when entering XR)
        setLoadingMessage("Initializing mission brief...");
        console.log('[Level1] ========== ABOUT TO INITIALIZE MISSION BRIEF ==========');
        console.log('[Level1] _missionBrief object:', this._missionBrief);
        console.log('[Level1] Ship exists:', !!this._ship);
        console.log('[Level1] Ship ID in scene:', DefaultScene.MainScene.getNodeById('Ship') !== null);
        this._missionBrief.initialize();
        console.log('[Level1] ========== MISSION BRIEF INITIALIZATION COMPLETE ==========');
        debugLog('Mission brief initialized');

        this._initialized = true;

        // Set par time for score calculation based on difficulty
        const parTime = this.getParTimeForDifficulty(this._levelConfig.difficulty);
        const statusScreen = (this._ship as any)._statusScreen; // Access private status screen
        if (statusScreen) {
            statusScreen.setParTime(parTime);
            debugLog(`Set par time to ${parTime}s for difficulty: ${this._levelConfig.difficulty}`);
        }

        // Notify that initialization is complete
        this._onReadyObservable.notifyObservers(this);
    }

    /**
     * Get par time based on difficulty level
     * Can be overridden by level config metadata
     */
    private getParTimeForDifficulty(difficulty: string): number {
        // Check if level config has explicit par time
        if (this._levelConfig.metadata?.parTime) {
            return this._levelConfig.metadata.parTime;
        }

        // Default par times by difficulty
        const difficultyMap: { [key: string]: number } = {
            'recruit': 300,    // 5 minutes
            'pilot': 180,      // 3 minutes
            'captain': 120,    // 2 minutes
            'commander': 90,   // 1.5 minutes
            'test': 60         // 1 minute
        };

        return difficultyMap[difficulty.toLowerCase()] || 120; // Default to 2 minutes
    }

    /**
     * Get the physics recorder instance
     */
    public get physicsRecorder(): PhysicsRecorder {
        return this._physicsRecorder;
    }
}