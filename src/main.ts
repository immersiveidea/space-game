import {Engine, HavokPlugin, PhotoDome, Scene, Vector3, WebGPUEngine, WebXRDefaultExperience} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import {DefaultScene} from "./defaultScene";
import {Ship} from "./ship";
import {Level1} from "./level1";
import {Scoreboard} from "./scoreboard";

const webGpu = false;
const canvas = (document.querySelector('#gameCanvas') as HTMLCanvasElement);

export class Main {

    constructor() {

        this.initialize();
    }

    private async initialize() {
        await this.setupScene();

        const xr = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
            disablePointerSelection: true,
            disableTeleportation: true,
            disableNearInteraction: true,
            disableHandTracking: true,
            disableDefaultUI: true,
        });

        const ship = new Ship();
        const scoreboard = new Scoreboard();
        const level = new Level1(ship);
        const photoDome = new PhotoDome("testdome", '/8192.webp', {}, DefaultScene.MainScene);



        xr.baseExperience.onInitialXRPoseSetObservable.add(() => {
            xr.baseExperience.camera.parent = ship.transformNode;
            xr.baseExperience.camera.position = new Vector3(0, 0, 0);

            level.onScoreObservable.add((score) => {
                scoreboard.onscoreObservable.notifyObservers(score);
            });

        });
        xr.input.onControllerAddedObservable.add((controller) => {
            ship.addController(controller);
        });
        DefaultScene.XR = xr;

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
        DefaultScene.MainScene = new Scene(engine);


        await this.setupPhysics();

        this.setupInspector();

        engine.runRenderLoop(() => {
            DefaultScene.MainScene.render();
        });
    }

    private async setupPhysics() {
        const havok = await HavokPhysics();

        const havokPlugin = new HavokPlugin(true, havok);
        DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);

        DefaultScene.MainScene.collisionsEnabled = true;


    }

    private setupInspector() {
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




