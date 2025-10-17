import {
    Color3,
    Engine,
    HavokPlugin,
    PhotoDome,
    Scene, StandardMaterial,
    Vector3,
    WebGPUEngine,
    WebXRDefaultExperience
} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./defaultScene";
import {Ship} from "./ship";
import {Level1} from "./level1";
import {Scoreboard} from "./scoreboard";
import Demo from "./demo";
import Level from "./level";

const webGpu = false;
const canvas = (document.querySelector('#gameCanvas') as HTMLCanvasElement);
enum GameState {
    PLAY,
    DEMO
}
export class Main {
    private _loadingDiv: HTMLElement;
    private _currentLevel: Level;
    private _gameState: GameState = GameState.DEMO;
    private _selectedDifficulty: string = 'recruit';
    private _engine: Engine | WebGPUEngine;
    constructor() {
        this._loadingDiv = document.querySelector('#loadingDiv');
        if (!navigator.xr) {
            this._loadingDiv.innerText = "This browser does not support WebXR";
            return;
        }
        this.initialize();

        document.querySelectorAll('.level-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const levelButton = e.target as HTMLButtonElement;
                this._selectedDifficulty = levelButton.dataset.level;
                this.setLoadingMessage("Initializing Level...");
                this._currentLevel = new Level1(this._selectedDifficulty);
                // Unlock audio engine if it exists
                if (this._engine?.audioEngine) {
                    this._engine.audioEngine.unlock();
                }
                this.play();
                document.querySelector('#mainDiv').remove();
            });
        });
    }
    private _started = false;
    public play() {
        this._gameState = GameState.PLAY;
        this._currentLevel.play();
    }
    public demo() {
        this._gameState = GameState.DEMO;
    }
    private async initialize() {
        this._loadingDiv.innerText = "Initializing.";
        await this.setupScene();

        DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
            disablePointerSelection: true,
            disableTeleportation: true,
            disableNearInteraction: true,
            disableHandTracking: true,
            disableDefaultUI: true,
        });

        this.setLoadingMessage("Get Ready!");

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
    }
    private setLoadingMessage(message: string) {
        this._loadingDiv.innerText = message;
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

        this.setLoadingMessage("Initializing Physics Engine..");
        await this.setupPhysics();
        this.setLoadingMessage("Physics Engine Ready!");
        this.setupInspector();
        this._engine.runRenderLoop(() => {
            if (!this._started) {
                this._started = true;
                this._loadingDiv.remove();
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
        this.setLoadingMessage("Initializing Inspector...");
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



