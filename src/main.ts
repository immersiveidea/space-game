import {
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    ParticleHelper,
    PhotoDome,
    Scene, StandardMaterial,
    Vector3,
    WebGPUEngine,
    WebXRDefaultExperience
} from "@babylonjs/core";
import type {AudioEngineV2} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./defaultScene";
import {Ship} from "./ship";
import {Level1} from "./level1";
import {Scoreboard} from "./scoreboard";
import Demo from "./demo";
import Level from "./level";
import setLoadingMessage from "./setLoadingMessage";
import {RockFactory} from "./starfield";

const webGpu = false;
const canvas = (document.querySelector('#gameCanvas') as HTMLCanvasElement);
enum GameState {
    PLAY,
    DEMO
}
export class Main {
    private _currentLevel: Level;
    private _gameState: GameState = GameState.DEMO;
    private _selectedDifficulty: string = 'recruit';
    private _engine: Engine | WebGPUEngine;
    private _audioEngine: AudioEngineV2;
    constructor() {
        if (!navigator.xr) {
            setLoadingMessage("This browser does not support WebXR");
            return;
        }
        this.initialize();

        document.querySelectorAll('.level-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const levelButton = e.target as HTMLButtonElement;
                this._selectedDifficulty = levelButton.dataset.level;

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

                // Create and initialize level BEFORE entering XR
                this._currentLevel = new Level1(this._selectedDifficulty, this._audioEngine);

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

        setLoadingMessage("Get Ready!");

        const photoDome1 = new PhotoDome("testdome", '/8192.webp', {size: 1000}, DefaultScene.MainScene);
        photoDome1.material.diffuseTexture.hasAlpha = true;
        photoDome1.material.alpha = .3;

        const photoDome2 = new PhotoDome("testdome", '/8192.webp', {size: 2000}, DefaultScene.MainScene);
        photoDome2.rotation.y = Math.PI;
        photoDome2.rotation.x = Math.PI/2;
        DefaultScene.MainScene.onAfterRenderObservable.add(() => {
            photoDome1.position = DefaultScene.MainScene.activeCamera.globalPosition;
            photoDome2.position = DefaultScene.MainScene.activeCamera.globalPosition;
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
        DefaultScene.MainScene.ambientColor = new Color3(.2, .2, .2);

        setLoadingMessage("Initializing Physics Engine..");
        await this.setupPhysics();
        setLoadingMessage("Physics Engine Ready!");

        setLoadingMessage("Loading Asteroids and Explosions...");
        ParticleHelper.BaseAssetsUrl = window.location.href;
        await RockFactory.init();
        setLoadingMessage("Ready!");

        // Initialize AudioEngineV2
        setLoadingMessage("Initializing Audio Engine...");
        this._audioEngine = await CreateAudioEngineAsync();
        setLoadingMessage("Ready!");

        this.setupInspector();
        this._engine.runRenderLoop(() => {
            if (!this._started) {
                this._started = true;
                const levelSelect = document.querySelector('#levelSelect');
                if (levelSelect) {
                    levelSelect.classList.add('ready');
                }
            }
            if (this._gameState == GameState.PLAY) {
                DefaultScene.MainScene.render();
            } else {
                DefaultScene.DemoScene.render();
            }
        });
    }

    private async setupPhysics() {
        const havok = await HavokPhysics();
        const havokPlugin = new HavokPlugin(true, havok);
        DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
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

const main = new Main();
const demo = new Demo(main);



