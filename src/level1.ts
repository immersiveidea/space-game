import {DefaultScene} from "./defaultScene";
import type {AudioEngineV2} from "@babylonjs/core";
import {
    AbstractMesh,
    Observable,
    Vector3
} from "@babylonjs/core";
import {Ship} from "./ship";
import Level from "./level";
import setLoadingMessage from "./setLoadingMessage";
import {LevelConfig} from "./levelConfig";
import {LevelDeserializer} from "./levelDeserializer";
import {BackgroundStars} from "./backgroundStars";
import debugLog from './debug';

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh | null;
    private _endBase: AbstractMesh;
    private _levelConfig: LevelConfig;
    private _audioEngine: AudioEngineV2;
    private _deserializer: LevelDeserializer;
    private _backgroundStars: BackgroundStars;

    constructor(levelConfig: LevelConfig, audioEngine: AudioEngineV2) {
        this._levelConfig = levelConfig;
        this._audioEngine = audioEngine;
        this._deserializer = new LevelDeserializer(levelConfig);
        this._ship = new Ship(audioEngine);


        const xr = DefaultScene.XR;

        debugLog('Level1 constructor - Setting up XR observables');
        debugLog('XR input exists:', !!xr.input);
        debugLog('onControllerAddedObservable exists:', !!xr.input?.onControllerAddedObservable);

        xr.baseExperience.onInitialXRPoseSetObservable.add(() => {
            xr.baseExperience.camera.parent = this._ship.transformNode;
            const currPose =  xr.baseExperience.camera.globalPosition.y;
            xr.baseExperience.camera.position = new Vector3(0, 0, 0);
            const observer = xr.input.onControllerAddedObservable.add((controller) => {
                debugLog('🎮 onControllerAddedObservable FIRED for:', controller.inputSource.handedness);
                this._ship.addController(controller);
            });
        });
        // Don't call initialize here - let Main call it after registering the observable
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    public async play() {
        // Create background music using AudioEngineV2
        const background = await this._audioEngine.createSoundAsync("background", "/song1.mp3", {
            loop: true,
            volume: 0.5
        });
        background.play();

        // Enter XR mode
        const xr = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
        // Check for controllers that are already connected after entering XR
        debugLog('Checking for controllers after entering XR. Count:', DefaultScene.XR.input.controllers.length);
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
    }

    public dispose() {
        if (this._startBase) {
            this._startBase.dispose();
        }
        this._endBase.dispose();
        if (this._backgroundStars) {
            this._backgroundStars.dispose();
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
            if (this._backgroundStars && DefaultScene.XR.baseExperience.camera) {
                this._backgroundStars.followCamera(DefaultScene.XR.baseExperience.camera.position);
            }
        });


        this._initialized = true;

        // Notify that initialization is complete
        this._onReadyObservable.notifyObservers(this);
    }
}