import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    Color3, DistanceConstraint, Engine, InstancedMesh, LinesMesh, Mesh,
    MeshBuilder,
    Observable,
    ParticleHelper,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, PointsCloudSystem, Sound,
    StandardMaterial, TransformNode,
    Vector3
} from "@babylonjs/core";
import {Ship} from "./ship";

import {RockFactory} from "./starfield";
import Level from "./level";
import {Scoreboard} from "./scoreboard";

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh;
    private _endBase: AbstractMesh;
    private _scoreboard: Scoreboard;
    private _difficulty: string;
    private _difficultyConfig: {
        rockCount: number;
        forceMultiplier: number;
        rockSizeMin: number;
        rockSizeMax: number;
        distanceMin: number;
        distanceMax: number;
    };

    constructor(difficulty: string = 'recruit') {
        this._difficulty = difficulty;
        this._difficultyConfig = this.getDifficultyConfig(difficulty);
        this._ship = new Ship();
        this._scoreboard = new Scoreboard();
        const xr = DefaultScene.XR;
        xr.baseExperience.onInitialXRPoseSetObservable.add(() => {
            xr.baseExperience.camera.parent = this._ship.transformNode;
            xr.baseExperience.camera.position = new Vector3(0, 0, 0);
        });
        xr.input.onControllerAddedObservable.add((controller) => {
            this._ship.addController(controller);
        });
        this.createStartBase();
        this.initialize();

    }

    private getDifficultyConfig(difficulty: string) {
        switch (difficulty) {
            case 'recruit':
                return {
                    rockCount: 5,
                    forceMultiplier: 1,
                    rockSizeMin: 4,
                    rockSizeMax: 10,
                    distanceMin: 150,
                    distanceMax: 180
                };
            case 'pilot':
                return {
                    rockCount: 10,
                    forceMultiplier: 1.6,
                    rockSizeMin: 3,
                    rockSizeMax: 8,
                    distanceMin: 120,
                    distanceMax: 220
                };
            case 'captain':
                return {
                    rockCount: 20,
                    forceMultiplier: 2.0,
                    rockSizeMin: 2,
                    rockSizeMax: 7,
                    distanceMin: 100,
                    distanceMax: 250
                };
            case 'commander':
                return {
                    rockCount: 50,
                    forceMultiplier: 2.5,
                    rockSizeMin: 2,
                    rockSizeMax: 8,
                    distanceMin: 90,
                    distanceMax: 280
                };
            case 'test':
                return {
                    rockCount: 100,
                    forceMultiplier: 0.3,
                    rockSizeMin: 8,
                    rockSizeMax: 15,
                    distanceMin: 150,
                    distanceMax: 200
                };
            default:
                return {
                    rockCount: 5,
                    forceMultiplier: 1.0,
                    rockSizeMin: 4,
                    rockSizeMax: 8,
                    distanceMin: 170,
                    distanceMax: 220
                };
        }
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    private scored: Set<string> = new Set<string>();
    public play() {
        const background = new Sound("background", "/background.mp3", DefaultScene.MainScene, () => {
        }, {loop: true, autoplay: true, volume: .2});
        DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
    }
    public dispose() {
        this._startBase.dispose();
        this._endBase.dispose();
    }
    public async initialize() {
        console.log('initialize');
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        ParticleHelper.BaseAssetsUrl = window.location.href;
        this._ship.position = new Vector3(0, 1, 0);
        await RockFactory.init();

        const config = this._difficultyConfig;
        console.log(config);
        for (let i = 0; i < config.rockCount; i++) {
            const distRange = config.distanceMax - config.distanceMin;
            const dist = (Math.random() * distRange) + config.distanceMin;
            const sizeRange = config.rockSizeMax - config.rockSizeMin;
            const size = Vector3.Random(1,1.3).scale(Math.random() * sizeRange + config.rockSizeMin)

            const rock = await RockFactory.createRock(i, new Vector3(Math.random() * 200 +50 * Math.sign(Math.random() -.5),200,200),
                size,
                this._scoreboard.onScoreObservable);
            const constraint = new DistanceConstraint(dist, DefaultScene.MainScene);

            /*
            const options: {updatable: boolean, points: Array<Vector3>, instance?: LinesMesh} =
                {updatable: true, points: [rock.position, this._startBase.absolutePosition]}

            let line = MeshBuilder.CreateLines("line", options , DefaultScene.MainScene);

            line.color = new Color3(1, 0, 0);
            DefaultScene.MainScene.onAfterRenderObservable.add(() => {
                //const pos = rock.position;
                options.points[0].copyFrom(rock.position);
                options.instance = line;
                line = MeshBuilder.CreateLines("lines", options);
            });
            */
            this._scoreboard.onScoreObservable.notifyObservers({
                score: 0,
                remaining: 1,
                message: "Get Ready"
            });
            this._startBase.physicsBody.addConstraint(rock.physicsBody, constraint);
            rock.physicsBody.applyForce(Vector3.Random(-1, 1).scale(5000000 * config.forceMultiplier), rock.position);
        }
    }

    private createStartBase() {
        const mesh = MeshBuilder.CreateCylinder("startBase", {
            diameter: 10,
            height: 1,
            tessellation: 72
        }, DefaultScene.MainScene);
        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(1, 1, 0);
        mesh.material = material;
        const agg = new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.ANIMATED);
        this._startBase = mesh;
    }

    private createEndBase() {
        const mesh = MeshBuilder.CreateCylinder("endBase", {
            diameter: 10,
            height: 1,
            tessellation: 72
        }, DefaultScene.MainScene);
        mesh.position = new Vector3(0, 5, 500);
        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(0, 1, 0);
        mesh.material = material;
        const agg = new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.ANIMATED);
        this._endBase = mesh;
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