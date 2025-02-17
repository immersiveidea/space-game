import {Engine, HavokPlugin, PhotoDome, Scene, Vector3, WebGPUEngine, WebXRDefaultExperience} from "@babylonjs/core";
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
    constructor() {
        this._loadingDiv = document.querySelector('#loadingDiv');
        this.initialize();

        document.querySelector('#startButton').addEventListener('click', () => {
            Engine.audioEngine.unlock();
            this.play();
            document.querySelector('#mainDiv').remove();
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
        this.setLoadingMessage("Initializing Level...");
        this._currentLevel = new Level1();
        this._currentLevel.getReadyObservable().add(() => {

        });
        const photoDome = new PhotoDome("testdome", '/8192.webp', {}, DefaultScene.MainScene);
    }
    private setLoadingMessage(message: string) {
        this._loadingDiv.innerText = message;
    }
    private async setupScene() {

        let engine: WebGPUEngine | Engine = null;
        if (webGpu) {
            engine = new WebGPUEngine(canvas);
            await (engine as WebGPUEngine).initAsync();
        } else {
            engine = new Engine(canvas, true);
        }
        engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
        window.onresize = () => {
            engine.resize();
        }
        DefaultScene.DemoScene = new Scene(engine);
        DefaultScene.MainScene = new Scene(engine);

        this.setLoadingMessage("Initializing Physics Engine..");
        await this.setupPhysics();
        this.setupInspector();
        engine.runRenderLoop(() => {
            if (!this._started) {
                this._started = true;
                this._loadingDiv.remove();
                const start = document.querySelector('#startButton');
                start.classList.add('ready');
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



