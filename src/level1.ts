import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    Color3, DistanceConstraint, InstancedMesh, Mesh,
    MeshBuilder,
    Observable,
    ParticleHelper,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    StandardMaterial, TransformNode,
    Vector3
} from "@babylonjs/core";
import {Ship} from "./ship";
import {ScoreEvent} from "./scoreEvent";
import {RockFactory} from "./starfield";

export class Level1 {
    private _ship: Ship;
    private _initialized: boolean = false;
    private _startBase: AbstractMesh;
    private _endBase: AbstractMesh;
    public onScoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();

    constructor(ship: Ship) {
        this._ship = ship;
        this.createStartBase();
        this.createEndBase();
    }

    private scored: Set<string> = new Set<string>();

    public async initialize() {
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        ParticleHelper.BaseAssetsUrl = window.location.href;
        this._ship.position = new Vector3(0, 1, 0);

        await RockFactory.init();
        const distance = Vector3.Distance(this._startBase.getAbsolutePosition(), this._endBase.getAbsolutePosition());
        const baseTransform = new TransformNode("baseTransform", DefaultScene.MainScene);
        baseTransform.position = this._endBase.getAbsolutePosition();

        for (let i = 0; i < 20; i++) {
            //const constraintDistance = distance - 20;
            const dist = (Math.random() * 80) + 20;
            const startPos = this._endBase.getAbsolutePosition().add(new Vector3(dist,dist,dist));
            const startTrans = new TransformNode("startTransform", DefaultScene.MainScene);
            startTrans.position = startPos;
            startTrans.setParent(baseTransform);
            baseTransform.rotation = Vector3.Random(0, Math.PI * 2);
            const rock = await RockFactory.createRock(i, startTrans.getAbsolutePosition(), Vector3.Random(1, 5))
            startTrans.dispose();





            const constraint = new DistanceConstraint(dist, DefaultScene.MainScene);
            rock.physicsBody.addConstraint(this._endBase.physicsBody, constraint);
            rock.physicsBody.applyImpulse(Vector3.Random(-1, 1).scale(1000), rock.getAbsolutePosition());
            rock.physicsBody.setAngularVelocity(Vector3.Random(-.5, .5));
           /* const material = new StandardMaterial("material", DefaultScene.MainScene);
            material.emissiveColor = Color3.Random();
            const sphere = MeshBuilder.CreateSphere("sphere", {diameter: 1}, DefaultScene.MainScene);
            sphere.material = material;

            window.setInterval(() => {
                const track = new InstancedMesh("track", sphere);
                track.position = rock.physicsBody.transformNode.getAbsolutePosition();

            }, 200);

            */
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
        mesh.position = new Vector3(0, 5, 200);
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