import {AudioEngineV2, DirectionalLight} from "@babylonjs/core";
import {
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    ParticleHelper,
    Scene,
    Vector3,
    WebGPUEngine,
    WebXRDefaultExperience,
    WebXRFeatureName
} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./defaultScene";
import {Level1} from "./level1";
import Demo from "./demo";
import Level from "./level";
import setLoadingMessage from "./setLoadingMessage";
import {RockFactory} from "./starfield";
import {ControllerDebug} from "./controllerDebug";
import {router, showView} from "./router";
import {populateLevelSelector, hasSavedLevels} from "./levelSelector";
import {LevelConfig} from "./levelConfig";
import {generateDefaultLevels} from "./levelEditor";

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

            console.log(`Starting level: ${levelName}`);

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
    }
    private _started = false;
    public async play() {
        this._gameState = GameState.PLAY;
        await this._currentLevel.play();
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
            disableDefaultUI: true,

        });
        DefaultScene.XR.baseExperience.featuresManager.enableFeature(WebXRFeatureName.LAYERS, "stable",
    {preferMultiviewOnInit: true});


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
            await (this._engine as WebGPUEngine).initAsync();
        } else {
            this._engine = new Engine(canvas, true);
        }
        this._engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
        window.onresize = () => {
            this._engine.resize();
        }
        DefaultScene.DemoScene = new Scene(this._engine);
        DefaultScene.MainScene = new Scene(this._engine);
        DefaultScene.MainScene.ambientColor = new Color3(.5, .5, .5);

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
        DefaultScene.MainScene.ambientColor = new Color3(.1, .1, .1);
        const light = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), DefaultScene.MainScene);
        DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
        DefaultScene.MainScene.getPhysicsEngine().setTimeStep(1/30);
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
        console.log('No saved levels found, redirecting to editor');
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
    console.log('🔍 DEBUG MODE: Running minimal controller test');
    // Hide the UI elements
    const mainDiv = document.querySelector('#mainDiv');
    if (mainDiv) {
        (mainDiv as HTMLElement).style.display = 'none';
    }
    new ControllerDebug();
}



