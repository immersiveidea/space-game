import {
    AudioEngineV2,
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    ParticleHelper,
    Scene,
    Vector3,
    WebGPUEngine,
    WebXRDefaultExperience,
    WebXRFeaturesManager
} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./core/defaultScene";
import {Level1} from "./levels/level1";
import {TestLevel} from "./levels/testLevel";
import Demo from "./game/demo";
import Level from "./levels/level";
import setLoadingMessage from "./utils/setLoadingMessage";
import {RockFactory} from "./environment/asteroids/rockFactory";
import {ControllerDebug} from "./utils/controllerDebug";
import {router, showView} from "./core/router";
import {populateLevelSelector} from "./levels/ui/levelSelector";
import {LevelConfig} from "./levels/config/levelConfig";
import {generateDefaultLevels} from "./levels/generation/levelEditor";
import debugLog from './core/debug';
import {ReplaySelectionScreen} from "./replay/ReplaySelectionScreen";
import {ReplayManager} from "./replay/ReplayManager";
import {AuthService} from "./services/authService";
import {updateUserProfile} from "./ui/screens/loginScreen";
import {Preloader} from "./ui/screens/preloader";
import {DiscordWidget} from "./ui/widgets/discordWidget";

// Set to true to run minimal controller debug test
const DEBUG_CONTROLLERS = false;
const webGpu = false;
const canvas = (document.querySelector('#gameCanvas') as HTMLCanvasElement);
enum GameState {
    PLAY,
    DEMO
}
export class Main {
    private _currentLevel: Level;
    private _gameState: GameState = GameState.DEMO;
    private _engine: Engine | WebGPUEngine;
    private _audioEngine: AudioEngineV2;
    private _replayManager: ReplayManager | null = null;
    private _initialized: boolean = false;
    private _assetsLoaded: boolean = false;
    private _progressCallback: ((percent: number, message: string) => void) | null = null;

    constructor(progressCallback?: (percent: number, message: string) => void) {
        this._progressCallback = progressCallback || null;
        // Listen for level selection event
        window.addEventListener('levelSelected', async (e: CustomEvent) => {
            this._started = true;
            const {levelName, config} = e.detail as {levelName: string, config: LevelConfig};

            debugLog(`[Main] Starting level: ${levelName}`);

            // Hide all UI elements
            const mainDiv = document.querySelector('#mainDiv');
            const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
            const appHeader = document.querySelector('#appHeader') as HTMLElement;

            if (levelSelect) {
                levelSelect.style.display = 'none';
            }
            if (appHeader) {
                appHeader.style.display = 'none';
            }

            // Hide Discord widget during gameplay
            const discord = (window as any).__discordWidget as DiscordWidget;
            if (discord) {
                debugLog('[Main] Hiding Discord widget for gameplay');
                discord.hide();
            }

            // Show preloader for initialization
            const preloader = new Preloader();
            this._progressCallback = (percent, message) => {
                preloader.updateProgress(percent, message);
            };

            try {
                // Initialize engine if this is first time
                if (!this._initialized) {
                    debugLog('[Main] First level selected - initializing engine');
                    preloader.updateProgress(0, 'Initializing game engine...');
                    await this.initializeEngine();
                }

                // Load assets if this is the first level being played
                if (!this._assetsLoaded) {
                    preloader.updateProgress(40, 'Loading 3D models and textures...');
                    debugLog('[Main] Loading assets for first time');

                    // Load visual assets (meshes, particles)
                    ParticleHelper.BaseAssetsUrl = window.location.href;
                    await RockFactory.init();
                    this._assetsLoaded = true;

                    debugLog('[Main] Assets loaded successfully');
                    preloader.updateProgress(60, 'Assets loaded');
                }

                preloader.updateProgress(70, 'Preparing VR session...');

                // Initialize WebXR for this level
                await this.initialize();

                // If XR is available, enter XR immediately (while we have user activation)
                let xrSession = null;
                if (DefaultScene.XR) {
                    try {
                        preloader.updateProgress(75, 'Entering VR...');
                        xrSession = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
                        debugLog('XR session started successfully');
                    } catch (error) {
                        debugLog('Failed to enter XR, will fall back to flat mode:', error);
                        DefaultScene.XR = null; // Disable XR for this session
                    }
                }

                // Unlock audio engine on user interaction
                if (this._audioEngine) {
                    await this._audioEngine.unlockAsync();
                }

                // Now load audio assets (after unlock)
                preloader.updateProgress(80, 'Loading audio...');
                await RockFactory.initAudio(this._audioEngine);

                // Attach audio listener to camera for spatial audio
                const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
                if (camera && this._audioEngine.listener) {
                    this._audioEngine.listener.attach(camera);
                    debugLog('[Main] Audio listener attached to camera for spatial audio');
                } else {
                    debugLog('[Main] WARNING: Could not attach audio listener - camera or listener not available');
                }

                preloader.updateProgress(90, 'Creating level...');

                // Create and initialize level from config
                this._currentLevel = new Level1(config, this._audioEngine);

                // Wait for level to be ready
                this._currentLevel.getReadyObservable().add(async () => {
                    preloader.updateProgress(95, 'Starting game...');

                    // Get ship and set up replay observable
                    const level1 = this._currentLevel as Level1;
                    const ship = (level1 as any)._ship;

                    // Listen for replay requests from the ship
                    if (ship) {
                        // Set current level name for progression tracking
                        if (ship._statusScreen) {
                            ship._statusScreen.setCurrentLevel(levelName);
                            debugLog(`Set current level for progression: ${levelName}`);
                        }

                        ship.onReplayRequestObservable.add(() => {
                            debugLog('Replay requested - reloading page');
                            window.location.reload();
                        });
                    }

                    // If we entered XR before level creation, manually setup camera parenting
                    // (This is needed because onInitialXRPoseSetObservable won't fire if we're already in XR)
                    if (DefaultScene.XR && xrSession && DefaultScene.XR.baseExperience.state === 2) { // WebXRState.IN_XR = 2

                        if (ship && ship.transformNode) {
                            debugLog('Manually parenting XR camera to ship transformNode');
                            DefaultScene.XR.baseExperience.camera.parent = ship.transformNode;
                            DefaultScene.XR.baseExperience.camera.position = new Vector3(0, 1.5, 0);

                            // Also start timer and recording here (since onInitialXRPoseSetObservable won't fire)
                            ship.gameStats.startTimer();
                            debugLog('Game timer started (manual)');

                            if ((level1 as any)._physicsRecorder) {
                                (level1 as any)._physicsRecorder.startRingBuffer();
                                debugLog('Physics recorder started (manual)');
                            }
                        } else {
                            debugLog('WARNING: Could not parent XR camera - ship or transformNode not found');
                        }
                    }

                    // Hide preloader
                    preloader.updateProgress(100, 'Ready!');
                    setTimeout(() => {
                        preloader.hide();
                    }, 500);

                    // Remove UI
                    mainDiv.remove();

                    // Start the game (XR session already active, or flat mode)
                    await this.play();
                });

                // Now initialize the level (after observable is registered)
                await this._currentLevel.initialize();

            } catch (error) {
                console.error('[Main] Level initialization failed:', error);
                preloader.updateProgress(0, 'Failed to load level. Please refresh and try again.');
            }
        });

        // Listen for test level button click
        window.addEventListener('DOMContentLoaded', () => {
            const levelSelect = document.querySelector('#levelSelect');
            levelSelect.classList.add('ready');
            debugLog('[Main] DOMContentLoaded fired, looking for test button...');
            const testLevelBtn = document.querySelector('#testLevelBtn');
            debugLog('[Main] Test button found:', !!testLevelBtn);

            if (testLevelBtn) {
                testLevelBtn.addEventListener('click', async () => {
                    debugLog('[Main] ========== TEST LEVEL BUTTON CLICKED ==========');

                    // Hide all UI elements
                    const mainDiv = document.querySelector('#mainDiv');
                    const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
                    const appHeader = document.querySelector('#appHeader') as HTMLElement;

                    debugLog('[Main] mainDiv exists:', !!mainDiv);
                    debugLog('[Main] levelSelect exists:', !!levelSelect);

                    if (levelSelect) {
                        levelSelect.style.display = 'none';
                        debugLog('[Main] levelSelect hidden');
                    }
                    if (appHeader) {
                        appHeader.style.display = 'none';
                    }
                    setLoadingMessage("Initializing Test Scene...");

                    // Unlock audio engine on user interaction
                    if (this._audioEngine) {
                        debugLog('[Main] Unlocking audio engine...');
                        await this._audioEngine.unlockAsync();
                        debugLog('[Main] Audio engine unlocked');
                    }

                    // Now load audio assets (after unlock)
                    setLoadingMessage("Loading audio assets...");
                    await RockFactory.initAudio(this._audioEngine);

                    // Attach audio listener to camera for spatial audio
                    const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
                    if (camera && this._audioEngine.listener) {
                        this._audioEngine.listener.attach(camera);
                        debugLog('[Main] Audio listener attached to camera for spatial audio (test level)');
                    } else {
                        debugLog('[Main] WARNING: Could not attach audio listener - camera or listener not available (test level)');
                    }

                    // Create test level
                    debugLog('[Main] Creating TestLevel...');
                    this._currentLevel = new TestLevel(this._audioEngine);
                    debugLog('[Main] TestLevel created:', !!this._currentLevel);

                    // Wait for level to be ready
                    debugLog('[Main] Registering ready observable...');
                    this._currentLevel.getReadyObservable().add(async () => {
                        debugLog('[Main] ========== TEST LEVEL READY OBSERVABLE FIRED ==========');
                        setLoadingMessage("Test Scene Ready! Entering VR...");

                        // Remove UI and play immediately (must maintain user activation for XR)
                        if (mainDiv) {
                            mainDiv.remove();
                            debugLog('[Main] mainDiv removed');
                        }
                        debugLog('[Main] About to call this.play()...');
                        await this.play();
                    });
                    debugLog('[Main] Ready observable registered');

                    // Now initialize the level (after observable is registered)
                    debugLog('[Main] Calling TestLevel.initialize()...');
                    await this._currentLevel.initialize();
                    debugLog('[Main] TestLevel.initialize() completed');
                });
                debugLog('[Main] Click listener added to test button');
            } else {
                console.warn('[Main] Test level button not found in DOM');
            }

            // View Replays button handler
            const viewReplaysBtn = document.querySelector('#viewReplaysBtn');
            debugLog('[Main] View Replays button found:', !!viewReplaysBtn);

            if (viewReplaysBtn) {
                viewReplaysBtn.addEventListener('click', async () => {
                    debugLog('[Main] ========== VIEW REPLAYS BUTTON CLICKED ==========');

                    // Initialize engine and physics if not already done
                    if (!this._started) {
                        this._started = true;
                        await this.initialize();
                    }

                    // Hide main menu
                    const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
                    const appHeader = document.querySelector('#appHeader') as HTMLElement;

                    if (levelSelect) {
                        levelSelect.style.display = 'none';
                    }
                    if (appHeader) {
                        appHeader.style.display = 'none';
                    }

                    // Show replay selection screen
                    const selectionScreen = new ReplaySelectionScreen(
                        async (recordingId: string) => {
                            // Play callback - start replay
                            debugLog(`[Main] Starting replay for recording: ${recordingId}`);
                            selectionScreen.dispose();

                            // Create replay manager if not exists
                            if (!this._replayManager) {
                                this._replayManager = new ReplayManager(
                                    this._engine as Engine,
                                    () => {
                                        // On exit callback - return to main menu
                                        debugLog('[Main] Exiting replay, returning to menu');
                                        if (levelSelect) {
                                            levelSelect.style.display = 'block';
                                        }
                                        const appHeader = document.querySelector('#appHeader') as HTMLElement;
                                        if (appHeader) {
                                            appHeader.style.display = 'block';
                                        }
                                    }
                                );
                            }

                            // Start replay
                            if (this._replayManager) {
                                await this._replayManager.startReplay(recordingId);
                            }
                        },
                        () => {
                            // Cancel callback - return to main menu
                            debugLog('[Main] Replay selection cancelled');
                            selectionScreen.dispose();
                            if (levelSelect) {
                                levelSelect.style.display = 'block';
                            }
                            const appHeader = document.querySelector('#appHeader') as HTMLElement;
                            if (appHeader) {
                                appHeader.style.display = 'block';
                            }
                        }
                    );

                    await selectionScreen.initialize();
                });
                debugLog('[Main] Click listener added to view replays button');
            } else {
                console.warn('[Main] View Replays button not found in DOM');
            }
        });
    }
    private _started = false;

    /**
     * Public method to initialize the game engine
     * Call this to preload all assets before showing the level selector
     */
    public async initializeEngine(): Promise<void> {
        if (this._initialized) {
            debugLog('[Main] Engine already initialized, skipping');
            return;
        }

        debugLog('[Main] Starting engine initialization');

        // Progress: 0-30% - Scene setup
        this.reportProgress(0, 'Initializing 3D engine...');
        await this.setupScene();
        this.reportProgress(30, '3D engine ready');

        // Progress: 30-100% - WebXR, physics, assets
        await this.initialize();

        this._initialized = true;
        this.reportProgress(100, 'All systems ready!');
        debugLog('[Main] Engine initialization complete');
    }

    /**
     * Report loading progress to callback
     */
    private reportProgress(percent: number, message: string): void {
        if (this._progressCallback) {
            this._progressCallback(percent, message);
        }
    }

    /**
     * Check if engine is initialized
     */
    public isInitialized(): boolean {
        return this._initialized;
    }

    /**
     * Get the audio engine (for external use)
     */
    public getAudioEngine(): AudioEngineV2 {
        return this._audioEngine;
    }

    public async play() {
        debugLog('[Main] play() called');
        debugLog('[Main] Current level exists:', !!this._currentLevel);
        this._gameState = GameState.PLAY;

        if (this._currentLevel) {
            debugLog('[Main] Calling level.play()...');
            await this._currentLevel.play();
            debugLog('[Main] level.play() completed');
        } else {
            console.error('[Main] ERROR: No current level to play!');
        }
    }
    public demo() {
        this._gameState = GameState.DEMO;
    }
    private async initialize() {
        // Try to initialize WebXR if available (30-40%)
        this.reportProgress(35, 'Checking VR support...');
        if (navigator.xr) {
            try {
                DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
                    // Don't disable pointer selection - we need it for status screen buttons
                    // Will detach it during gameplay and attach when status screen is shown
                    disableTeleportation: true,
                    disableNearInteraction: true,
                    disableHandTracking: true,
                    disableDefaultUI: true
                });
                debugLog(WebXRFeaturesManager.GetAvailableFeatures());
                debugLog("WebXR initialized successfully");

                // Store pointer selection feature reference and detach it initially
                if (DefaultScene.XR) {
                    const pointerFeature = DefaultScene.XR.baseExperience.featuresManager.getEnabledFeature(
                        "xr-controller-pointer-selection"
                    );
                    if (pointerFeature) {
                        (DefaultScene.XR as any).pointerSelectionFeature = pointerFeature;
                        // Detach immediately to prevent interaction during gameplay
                        pointerFeature.detach();
                        debugLog("Pointer selection feature stored and detached");
                    }

                    // Hide Discord widget when entering VR, show when exiting
                    DefaultScene.XR.baseExperience.onStateChangedObservable.add((state) => {
                        const discord = (window as any).__discordWidget as DiscordWidget;
                        if (discord) {
                            if (state === 2) { // WebXRState.IN_XR
                                debugLog('[Main] Entering VR - hiding Discord widget');
                                discord.hide();
                            } else if (state === 0) { // WebXRState.NOT_IN_XR
                                debugLog('[Main] Exiting VR - showing Discord widget');
                                discord.show();
                            }
                        }
                    });
                }
                this.reportProgress(40, 'VR support enabled');
            } catch (error) {
                debugLog("WebXR initialization failed, falling back to flat mode:", error);
                DefaultScene.XR = null;
                this.reportProgress(40, 'Desktop mode (VR not available)');
            }
        } else {
            debugLog("WebXR not available, using flat camera mode");
            DefaultScene.XR = null;
            this.reportProgress(40, 'Desktop mode');
        }

        DefaultScene.MainScene.onAfterRenderObservable.add(() => {
          // Reserved for photo domes if needed
        });
    }

    private async setupScene() {
        // 0-10%: Engine initialization
        this.reportProgress(5, 'Creating rendering engine...');

        if (webGpu) {
            this._engine = new WebGPUEngine(canvas);
            debugLog("Webgpu enabled");
            await (this._engine as WebGPUEngine).initAsync();
        } else {
            debugLog("Standard WebGL enabled");
            this._engine = new Engine(canvas, true);
        }

        this._engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
        window.onresize = () => {
            this._engine.resize();
        }

        this.reportProgress(10, 'Creating scenes...');
        DefaultScene.DemoScene = new Scene(this._engine);
        DefaultScene.MainScene = new Scene(this._engine);

        DefaultScene.MainScene.ambientColor = new Color3(.2,.2,.2);
        DefaultScene.MainScene.clearColor = new Color3(0, 0, 0).toColor4();

        // 10-20%: Physics
        this.reportProgress(15, 'Loading physics engine...');
        await this.setupPhysics();
        this.reportProgress(20, 'Physics engine ready');

        // 20-30%: Audio
        this.reportProgress(22, 'Initializing spatial audio...');
        this._audioEngine = await CreateAudioEngineAsync({
            volume: 1.0,
            listenerAutoUpdate: true,
            listenerEnabled: true,
            resumeOnInteraction: true
        });
        debugLog('Audio engine created with spatial audio enabled');
        this.reportProgress(30, 'Audio engine ready');

        // Assets (meshes, textures) will be loaded when user selects a level
        // This makes initial load faster

        // Start render loop
        this._engine.runRenderLoop(() => {
            DefaultScene.MainScene.render();
        });
    }

    private async setupPhysics() {
        //DefaultScene.MainScene.useRightHandedSystem = true;
        const havok = await HavokPhysics();
        const havokPlugin = new HavokPlugin(true, havok);
        //DefaultScene.MainScene.ambientColor = new Color3(.1, .1, .1);

        //const light = new HemisphericLight("mainlight", new Vector3(-1, -1, 0), DefaultScene.MainScene);
        //light.diffuse = new Color3(.4, .4, .3);
        //light.groundColor = new Color3(.2, .2, .1);
        //light.intensity = .5;
        //light.specular = new Color3(0,0,0);
        DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
        DefaultScene.MainScene.getPhysicsEngine().setTimeStep(1/60);
        DefaultScene.MainScene.getPhysicsEngine().setSubTimeStep(5);

        DefaultScene.MainScene.collisionsEnabled = true;
    }
}

// Setup router
router.on('/', async () => {
    debugLog('[Router] Home route triggered');

    // Always show game view
    showView('game');
    debugLog('[Router] Game view shown');

    // Initialize auth service (but don't block on it)
    try {
        const authService = AuthService.getInstance();
        debugLog('[Router] Initializing auth service...');
        await authService.initialize();
        debugLog('[Router] Auth service initialized');

        // Check if user is authenticated
        const isAuthenticated = await authService.isAuthenticated();
        const user = authService.getUser();
        debugLog('[Router] Auth check - authenticated:', isAuthenticated, 'user:', user);

        if (isAuthenticated && user) {
            // User is authenticated - update profile display
            debugLog('User authenticated:', user?.email || user?.name || 'Unknown');
            updateUserProfile(user.name || user.email || 'Player');
        } else {
            // User not authenticated - show login/signup button
            debugLog('User not authenticated, showing login button');
            updateUserProfile(null); // This will show login button instead
        }
    } catch (error) {
        // Auth failed, but allow game to continue
        debugLog('Auth initialization failed, continuing without auth:', error);
        updateUserProfile(null);
    }

    // Show the app header
    const appHeader = document.getElementById('appHeader');
    if (appHeader) {
        appHeader.style.display = 'block';
    }

    // Just show the level selector - don't initialize anything yet!
    if (!DEBUG_CONTROLLERS) {
        debugLog('[Router] Populating level selector (no engine initialization yet)');
        await populateLevelSelector();

        // Create Main instance lazily only if it doesn't exist
        // But don't initialize it yet - that will happen on level selection
        if (!(window as any).__mainInstance) {
            debugLog('[Router] Creating Main instance (not initialized)');
            const main = new Main();
            (window as any).__mainInstance = main;

            // Initialize demo mode without engine (just for UI purposes)
            const demo = new Demo(main);
        }

        // Discord widget initialization with enhanced error logging
        if (!(window as any).__discordWidget) {
            debugLog('[Router] Initializing Discord widget');
            const discord = new DiscordWidget();

            // Initialize with your server and channel IDs
            discord.initialize({
                server: '1112846185913401475', // Replace with your Discord server ID
                channel: '1437561367908581406', // Replace with your Discord channel ID
                color: '#667eea',
                glyph: ['💬', '✖️'],
                notifications: true
            }).then(() => {
                debugLog('[Router] Discord widget ready');
                (window as any).__discordWidget = discord;
            }).catch(error => {
                console.error('[Router] Failed to initialize Discord widget:', error);
                console.error('[Router] Error type:', error?.constructor?.name);
                console.error('[Router] Error message:', error?.message);
                console.error('[Router] Error stack:', error?.stack);
                if (error?.response) {
                    console.error('[Router] GraphQL response error:', error.response);
                }
            });
        }
    }

    debugLog('[Router] Home route handler complete');
});

router.on('/editor', () => {
    showView('editor');
    // Dynamically import and initialize editor
    if (!(window as any).__editorInitialized) {
        import('./levels/generation/levelEditor').then(() => {
            (window as any).__editorInitialized = true;
        });
    }
});

router.on('/settings', () => {
    showView('settings');
    // Dynamically import and initialize settings
    if (!(window as any).__settingsInitialized) {
        import('./ui/screens/settingsScreen').then((module) => {
            module.initializeSettingsScreen();
            (window as any).__settingsInitialized = true;
        });
    }
});

// Generate default levels if localStorage is empty
generateDefaultLevels();

// Suppress non-critical BabylonJS shader loading errors during development
// Note: After Vite config fix to pre-bundle shaders, these errors should no longer occur
// Keeping this handler for backwards compatibility with older cached builds
window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error && error.message) {
        // Only suppress specific shader-related errors, not asset loading errors
        if (error.message.includes('rgbdDecode.fragment') ||
            error.message.includes('procedural.vertex') ||
            (error.message.includes('Failed to fetch dynamically imported module') &&
             (error.message.includes('rgbdDecode') || error.message.includes('procedural')))) {
            debugLog('[Main] Suppressed shader loading error (should be fixed by Vite pre-bundling):', error.message);
            event.preventDefault(); // Prevent error from appearing in console
        }
    }
});

// Start the router after all routes are registered
router.start();

if (DEBUG_CONTROLLERS) {
    debugLog('🔍 DEBUG MODE: Running minimal controller test');
    // Hide the UI elements
    const mainDiv = document.querySelector('#mainDiv');
    if (mainDiv) {
        (mainDiv as HTMLElement).style.display = 'none';
    }
    new ControllerDebug();
}



