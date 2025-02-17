import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    Color3, DistanceConstraint, Engine, InstancedMesh, Mesh,
    MeshBuilder,
    Observable,
    ParticleHelper,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, Sound,
    StandardMaterial, TransformNode,
    Vector3
} from "@babylonjs/core";
import {Ship} from "./ship";
import {ScoreEvent} from "./scoreEvent";
import {RockFactory} from "./starfield";
import Level from "./level";

export class Level1 implements Level {
    private _ship: Ship;
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _startBase: AbstractMesh;
    private _endBase: AbstractMesh;
    public onScoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();

    constructor() {
        this._ship = new Ship();
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
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        ParticleHelper.BaseAssetsUrl = window.location.href;
        this._ship.position = new Vector3(0, 1, 0);
        await RockFactory.init();
        const baseTransform = new TransformNode("baseTransform", DefaultScene.MainScene);
        baseTransform.position = this._startBase.getAbsolutePosition();

        for (let i = 0; i < 50; i++) {
            const dist = (Math.random() * 200) + 190;
            const rock = await RockFactory.createRock(i, new Vector3(Math.random() * 200 +50 * Math.sign(Math.random() -.5),200,200), Vector3.Random(1, 5))
            const constraint = new DistanceConstraint(dist, DefaultScene.MainScene);
            //rock.physicsBody.addConstraint(this._endBase.physicsBody, constraint);
            this._startBase.physicsBody.addConstraint(rock.physicsBody, constraint);
            rock.physicsBody.applyForce(Vector3.Random(-1, 1).scale(50000000), rock.getAbsolutePosition());
            //rock.physicsBody.setAngularVelocity(Vector3.Random(-.5, .5));
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