import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    Color3, DistanceConstraint, Engine, InstancedMesh, LinesMesh, Mesh,
    MeshBuilder,
    Observable,
    ParticleHelper,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, PointsCloudSystem,
    StandardMaterial, TransformNode,
    Vector3
} from "@babylonjs/core";
import type {AudioEngineV2} from "@babylonjs/core";
import {Ship} from "./ship";

import {RockFactory} from "./starfield";
import Level from "./level";
import {Scoreboard} from "./scoreboard";
import setLoadingMessage from "./setLoadingMessage";
import {LevelConfig} from "./levelConfig";
import {LevelDeserializer} from "./levelDeserializer";

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh;
    private _endBase: AbstractMesh;
    private _scoreboard: Scoreboard;
    private _levelConfig: LevelConfig;
    private _audioEngine: AudioEngineV2;
    private _deserializer: LevelDeserializer;

    constructor(levelConfig: LevelConfig, audioEngine: AudioEngineV2) {
        this._levelConfig = levelConfig;
        this._audioEngine = audioEngine;
        this._deserializer = new LevelDeserializer(levelConfig);
        this._ship = new Ship(undefined, audioEngine);
        this._scoreboard = new Scoreboard();
        const xr = DefaultScene.XR;

        console.log('Level1 constructor - Setting up XR observables');
        console.log('XR input exists:', !!xr.input);
        console.log('onControllerAddedObservable exists:', !!xr.input?.onControllerAddedObservable);

        xr.baseExperience.onInitialXRPoseSetObservable.add(() => {
            xr.baseExperience.camera.parent = this._ship.transformNode;
            xr.baseExperience.camera.position = new Vector3(0, 0, 0);
            const observer = xr.input.onControllerAddedObservable.add((controller) => {
                console.log('🎮 onControllerAddedObservable FIRED for:', controller.inputSource.handedness);
                this._ship.addController(controller);
            });
        });


        //console.log('Controller observable registered, observer:', !!observer);

        this.initialize();

    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    private scored: Set<string> = new Set<string>();
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
        console.log('Checking for controllers after entering XR. Count:', DefaultScene.XR.input.controllers.length);
        DefaultScene.XR.input.controllers.forEach((controller, index) => {
            console.log(`Controller ${index} - handedness: ${controller.inputSource.handedness}`);
            this._ship.addController(controller);
        });

        // Wait and check again after a delay (controllers might connect later)
        console.log('Waiting 2 seconds to check for controllers again...');
        setTimeout(() => {
            console.log('After 2 second delay - controller count:', DefaultScene.XR.input.controllers.length);
            DefaultScene.XR.input.controllers.forEach((controller, index) => {
                console.log(`  Late controller ${index} - handedness: ${controller.inputSource.handedness}`);
            });
        }, 2000);
    }
    public dispose() {
        this._startBase.dispose();
        this._endBase.dispose();
    }
    public async initialize() {
        console.log('Initializing level from config:', this._levelConfig.difficulty);
        if (this._initialized) {
            return;
        }

        setLoadingMessage("Loading level from configuration...");

        // Use deserializer to create all entities from config
        const entities = await this._deserializer.deserialize(this._scoreboard.onScoreObservable);

        this._startBase = entities.startBase;
        // sun and planets are already created by deserializer

        // Initialize scoreboard with total asteroid count
        this._scoreboard.setRemainingCount(entities.asteroids.length);
        console.log(`Initialized scoreboard with ${entities.asteroids.length} asteroids`);

        // Position ship from config
        const shipConfig = this._deserializer.getShipConfig();
        this._ship.position = new Vector3(shipConfig.position[0], shipConfig.position[1], shipConfig.position[2]);

        // Add distance constraints to asteroids
        setLoadingMessage("Configuring physics constraints...");
        const asteroidMeshes = entities.asteroids;
        for (let i = 0; i < asteroidMeshes.length; i++) {
            const asteroidMesh = asteroidMeshes[i];
            if (asteroidMesh.physicsBody) {
                // Calculate distance from start base
                const dist = Vector3.Distance(asteroidMesh.position, this._startBase.position);
                const constraint = new DistanceConstraint(dist, DefaultScene.MainScene);
                this._startBase.physicsBody.addConstraint(asteroidMesh.physicsBody, constraint);
            }
        }

        this._initialized = true;

        // Notify that initialization is complete
        this._onReadyObservable.notifyObservers(this);
    }


    private createTarget(i: number) {
        const target = MeshBuilder.CreateTorus("target" + i, {diameter: 10, tessellation: 72}, DefaultScene.MainScene);
        const targetLOD = MeshBuilder.CreateTorus("target" + i, {
            diameter: 50,
            tessellation: 10
        }, DefaultScene.MainScene);
        targetLOD.parent = target;
        target.addLODLevel(300, targetLOD);

        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(1, 0, 0);
        material.alpha = .9;
        target.material = material;
        target.position = Vector3.Random(-1000, 1000);
        target.rotation = Vector3.Random(0, Math.PI * 2);
        const disc = MeshBuilder.CreateDisc("disc-" + i, {radius: 2, tessellation: 72}, DefaultScene.MainScene);
        const discMaterial = new StandardMaterial("material", DefaultScene.MainScene);
        discMaterial.ambientColor = new Color3(.1, 1, .1);
        discMaterial.alpha = .2;
        target.addLODLevel(200, null);
        disc.material = discMaterial;
        disc.parent = target;
        disc.rotation.x = -Math.PI / 2;
        const agg = new PhysicsAggregate(disc, PhysicsShapeType.MESH, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.STATIC);
        agg.shape.isTrigger = true;
    }
}