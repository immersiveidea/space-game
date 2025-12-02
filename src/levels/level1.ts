import {DefaultScene} from "../core/defaultScene";
import type {AudioEngineV2, StaticSound} from "@babylonjs/core";
import {
    AbstractMesh,
    Observable,
    PhysicsAggregate,
    TransformNode,
    Vector3,
    WebXRState
} from "@babylonjs/core";
import {Ship} from "../ship/ship";
import Level from "./level";
import setLoadingMessage from "../utils/setLoadingMessage";
import {LevelConfig} from "./config/levelConfig";
import {LevelDeserializer} from "./config/levelDeserializer";
import {BackgroundStars} from "../environment/background/backgroundStars";
import log from '../core/logger';
import {getAnalytics} from "../analytics";
import {MissionBrief} from "../ui/hud/missionBrief";
import {LevelRegistry} from "./storage/levelRegistry";
import type {CloudLevelEntry} from "../services/cloudLevelService";
import { InputControlManager } from "../ship/input/inputControlManager";
import { LevelHintSystem } from "./hints/levelHintSystem";
import { getAudioSource } from "../utils/audioPrefetch";
import { RockFactory } from "../environment/asteroids/rockFactory";

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
    private _isReplayMode: boolean;
    private _backgroundMusic: StaticSound;
    private _missionBrief: MissionBrief;
    private _hintSystem: LevelHintSystem;
    private _gameStarted: boolean = false;
    private _missionBriefShown: boolean = false;
    private _asteroidCount: number = 0;

    constructor(levelConfig: LevelConfig, audioEngine?: AudioEngineV2, isReplayMode: boolean = false, levelId?: string) {
        this._levelConfig = levelConfig;
        this._levelId = levelId || null;
        this._audioEngine = audioEngine!; // Will be set later if not provided
        this._isReplayMode = isReplayMode;
        this._deserializer = new LevelDeserializer(levelConfig);
        this._ship = new Ship(undefined, isReplayMode); // Audio initialized separately
        this._missionBrief = new MissionBrief();
        this._hintSystem = new LevelHintSystem(undefined); // Audio initialized separately


        // XR camera setup and mission brief are now handled by levelSelectedHandler
        // after audio is initialized (see finalizeLevelStart)
        // Don't call initialize here - let Main call it after setup
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    /**
     * Setup XR camera, pointer selection, and controllers
     * Consolidated function called from both onInitialXRPoseSetObservable and main.ts
     * when XR is already active before level creation
     */
    public setupXRCamera(): void {
        const xr = DefaultScene.XR;
        if (!xr) {
            log.debug('[Level1] setupXRCamera: No XR experience available');
            return;
        }

        if (!this._ship?.transformNode) {
            log.error('[Level1] setupXRCamera: Ship or transformNode not available');
            return;
        }

        log.debug('[Level1] ========== setupXRCamera START ==========');

        // Create intermediate TransformNode for camera rotation
        // WebXR camera only uses rotationQuaternion (not .rotation), and XR frame updates overwrite it
        // By rotating an intermediate node, we can orient the camera without fighting XR frame updates
        // Show the canvas now that camera is parented
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.style.display = 'block';
        }

        // Ensure render loop is running (stop first to prevent duplicates)
        const engine = DefaultScene.MainScene.getEngine();
        engine.stopRenderLoop();
        engine.runRenderLoop(() => {
            DefaultScene.MainScene.render();
        });
        log.debug('[Level1] Render loop started/resumed');

        // Disable keyboard input in VR mode to prevent interference
        if (this._ship.keyboardInput) {
            this._ship.keyboardInput.setEnabled(false);
            log.debug('[Level1] Keyboard input disabled for VR mode');
        }

        // Register pointer selection feature
        const pointerFeature = xr.baseExperience.featuresManager.getEnabledFeature(
            "xr-controller-pointer-selection"
        );
        if (pointerFeature) {
            const inputManager = InputControlManager.getInstance();
            inputManager.registerPointerFeature(pointerFeature);
            log.debug('[Level1] Pointer selection feature registered');
        } else {
            log.debug('[Level1] WARNING: Pointer selection feature not available');
        }

        // Track WebXR session start
        try {
            const analytics = getAnalytics();
            analytics.track('webxr_session_start', {
                deviceName: navigator.userAgent,
                isImmersive: true
            });
        } catch (error) {
            log.debug('[Level1] Analytics tracking failed:', error);
        }

        // Setup controller observer
        xr.input.onControllerAddedObservable.add((controller) => {
            log.debug('[Level1] 🎮 Controller added:', controller.inputSource.handedness);
            this._ship.addController(controller);

            // Set controller meshes to render on top (never occluded)
            controller.onMeshLoadedObservable.add((mesh) => {
                const XR_RENDERING_GROUP = 3;
                mesh.renderingGroupId = XR_RENDERING_GROUP;
                mesh.getChildMeshes().forEach((child) => {
                    child.renderingGroupId = XR_RENDERING_GROUP;
                });
                log.debug('[Level1] Controller mesh renderingGroupId set to', XR_RENDERING_GROUP);
            });
        });

        log.debug('[Level1] ========== setupXRCamera COMPLETE ==========');
    }

    /**
     * Show mission brief with directory entry data
     * Public so it can be called from main.ts when XR is already active
     */
    public async showMissionBrief(): Promise<void> {
        // Prevent showing twice
        if (this._missionBriefShown) {
            log.info('[Level1] Mission brief already shown, skipping');
            return;
        }

        this._missionBriefShown = true;
        log.info('[Level1] showMissionBrief() called');

        let directoryEntry: CloudLevelEntry | null = null;

        // Try to get directory entry if we have a level ID
        if (this._levelId) {
            try {
                const registry = LevelRegistry.getInstance();
                log.info('[Level1] ======================================');
                log.info('[Level1] Getting all levels from registry...');
                const allLevels = registry.getAllLevels();
                log.info('[Level1] Total levels in registry:', allLevels.size);
                log.info('[Level1] Looking for level ID:', this._levelId);

                const registryEntry = allLevels.get(this._levelId);
                log.info('[Level1] Registry entry found:', !!registryEntry);

                if (registryEntry) {
                    directoryEntry = registryEntry;
                    log.info('[Level1] Level entry data:', {
                        id: directoryEntry?.id,
                        slug: directoryEntry?.slug,
                        name: directoryEntry?.name,
                        description: directoryEntry?.description,
                        missionBriefCount: directoryEntry?.missionBrief?.length || 0,
                        estimatedTime: directoryEntry?.estimatedTime,
                        difficulty: directoryEntry?.difficulty
                    });

                    if (directoryEntry?.missionBrief) {
                        log.info('[Level1] Mission brief objectives:');
                        directoryEntry.missionBrief.forEach((item, i) => {
                            log.info(`  ${i + 1}. ${item}`);
                        });
                    } else {
                        log.warn('[Level1] ⚠️  No missionBrief found in level entry!');
                    }
                } else {
                    log.error('[Level1] ❌ No registry entry found for level ID:', this._levelId);
                    log.info('[Level1] Available level IDs:', Array.from(allLevels.keys()));
                }
                log.info('[Level1] ======================================');

                log.debug('[Level1] Retrieved directory entry for level:', this._levelId, directoryEntry);
            } catch (error) {
                log.error('[Level1] ❌ Exception while getting directory entry:', error);
                log.debug('[Level1] Failed to get directory entry:', error);
            }
        } else {
            log.warn('[Level1] ⚠️  No level ID available, using config-only mission brief');
            log.debug('[Level1] No level ID available, using config-only mission brief');
        }

        log.info('[Level1] About to show mission brief. Has directoryEntry:', !!directoryEntry);

        // Disable ship controls while mission brief is showing
        log.debug('[Level1] Disabling ship controls for mission brief');
        const inputManager = InputControlManager.getInstance();
        inputManager.disableShipControls("MissionBrief");

        // Show mission brief with trigger observable
        this._missionBrief.show(this._levelConfig, directoryEntry, this._ship.onMissionBriefTriggerObservable, () => {
            log.debug('[Level1] Mission brief dismissed - enabling controls and starting game');
            inputManager.enableShipControls("MissionBrief");
            this.startGameplay();
        });

        // Trigger mission brief hints (e.g., welcome_rookie audio)
        this._hintSystem?.triggerMissionBriefShown();
    }

    /**
     * Start gameplay - called when mission brief start button is clicked
     * or immediately if not in XR mode
     */
    private startGameplay(): void {
        if (this._gameStarted) {
            log.debug('[Level1] startGameplay called but game already started');
            return;
        }

        this._gameStarted = true;
        log.debug('[Level1] Starting gameplay');

        // Enable game end condition checking on ship
        this._ship.startGameplay();

        // Start game timer
        this._ship.gameStats.startTimer();
        log.debug('Game timer started');
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
            log.debug('Analytics tracking failed:', error);
        }

        // Play background music (already loaded during initialization)
        if (this._backgroundMusic) {
            this._backgroundMusic.play();
            log.debug('Started playing background music');
        }

        // If XR is available and session is active, mission brief will handle starting gameplay
        if (DefaultScene.XR && DefaultScene.XR.baseExperience.state === WebXRState.IN_XR) {
            // XR session already active, mission brief is showing or has been dismissed
            log.debug('XR session already active, checking for controllers. Count:', DefaultScene.XR.input.controllers.length);
            DefaultScene.XR.input.controllers.forEach((controller, index) => {
                log.debug(`Controller ${index} - handedness: ${controller.inputSource.handedness}`);
                this._ship.addController(controller);
            });

            // Wait and check again after a delay (controllers might connect later)
            log.debug('Waiting 2 seconds to check for controllers again...');
            setTimeout(() => {
                log.debug('After 2 second delay - controller count:', DefaultScene.XR.input.controllers.length);
                DefaultScene.XR.input.controllers.forEach((controller, index) => {
                    log.debug(`  Late controller ${index} - handedness: ${controller.inputSource.handedness}`);
                });
            }, 2000);

            // Note: Mission brief will call startGameplay() when start button is clicked
            log.debug('XR mode: Mission brief will control game start');
        } else if (DefaultScene.XR) {
            // XR available but not entered yet, try to enter
            try {
                const _xr = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
                log.debug('Entered XR mode from play()');
                // Check for controllers
                DefaultScene.XR.input.controllers.forEach((controller, index) => {
                    log.debug(`Controller ${index} - handedness: ${controller.inputSource.handedness}`);
                    this._ship.addController(controller);
                });
                // Mission brief will show and handle starting gameplay
                log.debug('XR mode entered: Mission brief will control game start');
            } catch (error) {
                log.debug('Failed to enter XR from play(), falling back to flat mode:', error);
                // Start flat mode immediately
                this.startGameplay();
            }
        } else {
            // Flat camera mode - start game timer and physics recording immediately
            log.debug('Playing in flat camera mode (no XR)');
            this.startGameplay();
        }
    }

    public dispose() {
        if (this._startBase) {
            this._startBase.dispose();
        }
        if (this._endBase) {
            this._endBase.dispose();
        }
        if (this._backgroundStars) {
            this._backgroundStars.dispose();
        }
        if (this._missionBrief) {
            this._missionBrief.dispose();
        }
        if (this._hintSystem) {
            this._hintSystem.dispose();
        }
        if (this._ship) {
            this._ship.dispose();
        }
        if (this._backgroundMusic) {
            this._backgroundMusic.dispose();
        }
    }

    /**
     * Initialize audio systems (call after audio engine unlock)
     * Separated from initialize() to allow level creation before XR entry
     */
    public async initializeAudio(audioEngine: AudioEngineV2): Promise<void> {
        log.debug('[Level1] Initializing audio systems');
        this._audioEngine = audioEngine;

        // Initialize ship audio
        await this._ship.initializeAudio(audioEngine);

        // Initialize hint system audio
        this._hintSystem.setAudioEngine(audioEngine);

        // Load background music (uses prefetched audio if available)
        const musicUrl = "/assets/themes/default/audio/song1.mp3";
        this._backgroundMusic = await audioEngine.createSoundAsync(
            "background",
            getAudioSource(musicUrl),
            { loop: true, volume: 0.2 }
        );

        // Initialize mission brief audio
        this._missionBrief.initialize(audioEngine);

        log.debug('[Level1] Audio initialization complete');
    }

    /**
     * Add level meshes to scene (Phase 2 - before XR, hidden)
     */
    public async addToScene(hidden: boolean = true): Promise<void> {
        log.debug(`[Level1] addToScene called (hidden: ${hidden})`);

        if (this._initialized) {
            log.error('[Level1] Already initialized');
            return;
        }

        // Initialize RockFactory mesh (needs to happen before deserialize)
        await RockFactory.initMesh();

        // Get ship config and add ship to scene
        const shipConfig = this._deserializer.getShipConfig();
        await this._ship.addToScene(new Vector3(...shipConfig.position), hidden);

        // Create XR camera rig
        const cameraRig = new TransformNode("xrCameraRig", DefaultScene.MainScene);
        //cameraRig.position.set(0, 1.2, 0);
        cameraRig.parent = this._ship.transformNode;

        setLoadingMessage("Loading level from configuration...");

        // Deserialize level meshes (no physics)
        const entities = await this._deserializer.deserializeMeshes(
            this._ship.scoreboard.onScoreObservable,
            hidden
        );

        this._startBase = entities.startBase;
        this._asteroidCount = entities.asteroids.length;

        // Initialize scoreboard with asteroid count
        this._ship.scoreboard.setRemainingCount(this._asteroidCount);

        // Create background starfield (use config if available, otherwise defaults)
        const starfieldConfig = this._deserializer.getStarfieldConfig();
        this._backgroundStars = new BackgroundStars(DefaultScene.MainScene, starfieldConfig);

        // Set up render loop updates
        DefaultScene.MainScene.onBeforeRenderObservable.add(() => {
            if (this._backgroundStars) {
                const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
                if (camera) this._backgroundStars.followCamera(camera.globalPosition);
            }
            this._hintSystem?.update();
        });

        // Load hints (non-physics)
        if (this._levelId) {
            const registry = LevelRegistry.getInstance();
            const registryEntry = registry.getAllLevels().get(this._levelId);
            if (registryEntry?.id) {
                await this._hintSystem.loadHints(registryEntry.id);
                this._hintSystem.subscribeToEvents(
                    this._ship.scoreboard.shipStatus,
                    this._ship.scoreboard.onScoreObservable,
                    this._ship.onCollisionObservable
                );
            }
        }

        // Set par time and level info
        this.setupStatusScreen();

        log.debug('[Level1] addToScene complete');
    }

    /**
     * Initialize physics for all level entities (Phase 3 - after XR)
     */
    public initializePhysics(): void {
        log.debug('[Level1] initializePhysics called');

        // Initialize ship physics
        this._ship.initializePhysics();

        // Set ship velocities (needs physics body)
        const shipConfig = this._deserializer.getShipConfig();
        if (shipConfig.linearVelocity) {
            this._ship.setLinearVelocity(new Vector3(...shipConfig.linearVelocity));
        }
        if (shipConfig.angularVelocity) {
            this._ship.setAngularVelocity(new Vector3(...shipConfig.angularVelocity));
        }

        // Initialize deserializer physics (base, asteroids)
        this._landingAggregate = this._deserializer.initializePhysics();

        // Setup resupply system
        if (this._landingAggregate) {
            this._ship.setLandingZone(this._landingAggregate);
        }

        this._initialized = true;
        this._onReadyObservable.notifyObservers(this);

        log.debug('[Level1] initializePhysics complete');
    }

    /**
     * Show all level meshes (call after XR entry)
     */
    public showMeshes(): void {
        this._ship.showMeshes();
        this._deserializer.showMeshes();
        log.debug('[Level1] All meshes shown');
    }

    private setupStatusScreen(): void {
        const parTime = this.getParTimeForDifficulty(this._levelConfig.difficulty);
        const statusScreen = this._ship.statusScreen;
        if (statusScreen) {
            statusScreen.setParTime(parTime);
            const levelId = this._levelId || 'unknown';
            const levelName = this._levelConfig.metadata?.description || 'Unknown Level';
            statusScreen.setCurrentLevel(levelId, levelName, this._asteroidCount);
        }
    }

    /**
     * Legacy initialize - for backwards compatibility
     */
    public async initialize(): Promise<void> {
        await this.addToScene(false);
        this.initializePhysics();
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
}