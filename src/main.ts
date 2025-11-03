import {
    AudioEngineV2,
    Color3,
    CreateAudioEngineAsync,
    DirectionalLight,
    Engine,
    HavokPlugin, HemisphericLight,
    ParticleHelper,
    Scene,
    ScenePerformancePriority,
    Vector3,
    WebGPUEngine,
    WebXRDefaultExperience,
    WebXRFeatureName, WebXRFeaturesManager
} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./defaultScene";
import {Level1} from "./level1";
import {TestLevel} from "./testLevel";
import Demo from "./demo";
import Level from "./level";
import setLoadingMessage from "./setLoadingMessage";
import {RockFactory} from "./rockFactory";
import {ControllerDebug} from "./controllerDebug";
import {router, showView} from "./router";
import {hasSavedLevels, populateLevelSelector} from "./levelSelector";
import {LevelConfig} from "./levelConfig";
import {generateDefaultLevels} from "./levelEditor";
import debugLog from './debug';

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
    constructor() {
        if (!navigator.xr) {
            setLoadingMessage("This browser does not support WebXR");
            return;
        }
        this.initialize();

        // Listen for level selection event
        window.addEventListener('levelSelected', async (e: CustomEvent) => {
            const {levelName, config} = e.detail as {levelName: string, config: LevelConfig};

            debugLog(`Starting level: ${levelName}`);

            // Show loading UI again
            const mainDiv = document.querySelector('#mainDiv');
            const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
            if (levelSelect) {
                levelSelect.style.display = 'none';
            }
            setLoadingMessage("Initializing Level...");

            // Unlock audio engine on user interaction
            if (this._audioEngine) {
                await this._audioEngine.unlockAsync();
            }

            // Create and initialize level from config
            this._currentLevel = new Level1(config, this._audioEngine);

            // Wait for level to be ready
            this._currentLevel.getReadyObservable().add(() => {
                setLoadingMessage("Level Ready! Entering VR...");

                // Small delay to show message
                setTimeout(() => {
                    mainDiv.remove();
                    this.play();
                }, 500);
            });
        });

        // Listen for test level button click
        window.addEventListener('DOMContentLoaded', () => {
            debugLog('[Main] DOMContentLoaded fired, looking for test button...');
            const testLevelBtn = document.querySelector('#testLevelBtn');
            debugLog('[Main] Test button found:', !!testLevelBtn);

            if (testLevelBtn) {
                testLevelBtn.addEventListener('click', async () => {
                    debugLog('[Main] ========== TEST LEVEL BUTTON CLICKED ==========');

                    // Show loading UI
                    const mainDiv = document.querySelector('#mainDiv');
                    const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
                    debugLog('[Main] mainDiv exists:', !!mainDiv);
                    debugLog('[Main] levelSelect exists:', !!levelSelect);

                    if (levelSelect) {
                        levelSelect.style.display = 'none';
                        debugLog('[Main] levelSelect hidden');
                    }
                    setLoadingMessage("Initializing Test Scene...");

                    // Unlock audio engine on user interaction
                    if (this._audioEngine) {
                        debugLog('[Main] Unlocking audio engine...');
                        await this._audioEngine.unlockAsync();
                        debugLog('[Main] Audio engine unlocked');
                    }

                    // Create test level
                    debugLog('[Main] Creating TestLevel...');
                    this._currentLevel = new TestLevel(this._audioEngine);
                    debugLog('[Main] TestLevel created:', !!this._currentLevel);

                    // Wait for level to be ready
                    debugLog('[Main] Registering ready observable...');
                    this._currentLevel.getReadyObservable().add(() => {
                        debugLog('[Main] ========== TEST LEVEL READY OBSERVABLE FIRED ==========');
                        setLoadingMessage("Test Scene Ready! Entering VR...");
                        debugLog('[Main] Setting timeout to enter VR...');

                        // Small delay to show message
                        setTimeout(() => {
                            debugLog('[Main] Timeout fired, removing mainDiv and calling play()');
                            if (mainDiv) {
                                mainDiv.remove();
                                debugLog('[Main] mainDiv removed');
                            }
                            debugLog('[Main] About to call this.play()...');
                            this.play();
                        }, 500);
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
        });
    }
    private _started = false;
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
        setLoadingMessage("Initializing.");
        await this.setupScene();

        DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
            disablePointerSelection: true,
            disableTeleportation: true,
            disableNearInteraction: true,
            disableHandTracking: true,
            disableDefaultUI: true

        });
        debugLog(WebXRFeaturesManager.GetAvailableFeatures());
        //DefaultScene.XR.baseExperience.featuresManager.enableFeature(WebXRFeatureName.LAYERS, "latest", {preferMultiviewOnInit: true});


        setLoadingMessage("Get Ready!");

        //const photoDome1 = new PhotoDome("testdome", '/8192.webp', {size: 1000}, DefaultScene.MainScene);
        //photoDome1.material.diffuseTexture.hasAlpha = true;
        //photoDome1.material.alpha = .3;

        //const photoDome2 = new PhotoDome("testdome", '/8192.webp', {size: 2000}, DefaultScene.MainScene);
        //photoDome2.rotation.y = Math.PI;
        //photoDome2.rotation.x = Math.PI/2;
        DefaultScene.MainScene.onAfterRenderObservable.add(() => {
          //  photoDome1.position = DefaultScene.MainScene.activeCamera.globalPosition;
          //  photoDome2.position = DefaultScene.MainScene.activeCamera.globalPosition;
        });
        setLoadingMessage("Select a difficulty to begin!");
    }

    private async setupScene() {

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
        DefaultScene.DemoScene = new Scene(this._engine);
        DefaultScene.MainScene = new Scene(this._engine);

        DefaultScene.MainScene.ambientColor = new Color3(0,0,0);
        DefaultScene.MainScene.clearColor = new Color3(0, 0, 0).toColor4();


        setLoadingMessage("Initializing Physics Engine..");
        await this.setupPhysics();
        setLoadingMessage("Physics Engine Ready!");

        setLoadingMessage("Loading Assets and animations...");
        ParticleHelper.BaseAssetsUrl = window.location.href;
        await RockFactory.init();
        setLoadingMessage("Ready!");

        // Initialize AudioEngineV2
        setLoadingMessage("Initializing Audio Engine...");
        this._audioEngine = await CreateAudioEngineAsync();


        this.setupInspector();
        window.setTimeout(()=>{
            if (!this._started) {
                this._started = true;
                const levelSelect = document.querySelector('#levelSelect');
                if (levelSelect) {
                    levelSelect.classList.add('ready');
                    setLoadingMessage("Ready!");
                }
            }
        })

        this._engine.runRenderLoop(() => {
                DefaultScene.MainScene.render();
        });
    }

    private async setupPhysics() {
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

    private setupInspector() {
        setLoadingMessage("Initializing Inspector...");
        window.addEventListener("keydown", (ev) => {
            if (ev.key == 'i') {
                import ("@babylonjs/inspector").then((inspector) => {
                    inspector.Inspector.Show(DefaultScene.MainScene, {
                        overlay: true,
                        showExplorer: true
                    });
                });
            }
        });
    }
}

// Setup router
router.on('/', () => {
    // Check if there are saved levels
    if (!hasSavedLevels()) {
        debugLog('No saved levels found, redirecting to editor');
        router.navigate('/editor');
        return;
    }

    showView('game');

    // Populate level selector
    populateLevelSelector();

    // Initialize game if not in debug mode
    if (!DEBUG_CONTROLLERS) {
        // Check if already initialized
        if (!(window as any).__gameInitialized) {
            const main = new Main();
            const demo = new Demo(main);
            (window as any).__gameInitialized = true;
        }
    }
});

router.on('/editor', () => {
    showView('editor');
    // Dynamically import and initialize editor
    if (!(window as any).__editorInitialized) {
        import('./levelEditor').then(() => {
            (window as any).__editorInitialized = true;
        });
    }
});

router.on('/settings', () => {
    showView('settings');
    // Dynamically import and initialize settings
    if (!(window as any).__settingsInitialized) {
        import('./settingsScreen').then((module) => {
            module.initializeSettingsScreen();
            (window as any).__settingsInitialized = true;
        });
    }
});

// Generate default levels if localStorage is empty
generateDefaultLevels();

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



