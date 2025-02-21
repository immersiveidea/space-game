import {
    AbstractMesh,
    Color3, InstancedMesh,
    Mesh,
    MeshBuilder, Observable,
    ParticleHelper,
    ParticleSystem,
    ParticleSystemSet,
    PBRMaterial,
    PhysicsAggregate, PhysicsBody,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {ScoreEvent} from "./scoreboard";
let _particleData: any = null;
export class Rock {
    private _rockMesh: AbstractMesh;
    constructor(mesh: AbstractMesh) {
        this._rockMesh = mesh;
    }
    public get physicsBody(): PhysicsBody {
        return this._rockMesh.physicsBody;
    }
    public get position(): Vector3 {
        return this._rockMesh.getAbsolutePosition();
    }
}

export class RockFactory {
    private static _rockMesh: AbstractMesh;
    private static _rockMaterial: PBRMaterial;
    private static _explosion: ParticleSystemSet;
    public static async init() {

        if (!this._explosion) {
          const set = await ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene);
            this._explosion = set.serialize(true);
            set.dispose();
        }
        if (!this._rockMesh) {
            console.log('loading mesh');
            const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "asteroid2.glb", DefaultScene.MainScene);
            this._rockMesh = importMesh.meshes[1].clone("asteroid", null, false);
            this._rockMesh.setParent(null);
            this._rockMesh.setEnabled(false);

            //importMesh.meshes[1].dispose();
            console.log(importMesh.meshes);
            if (!this._rockMaterial) {
                this._rockMaterial = this._rockMesh.material.clone("asteroid") as PBRMaterial;
                this._rockMaterial.name = 'asteroid-material';
                this._rockMaterial.id = 'asteroid-material';
                const material = (this._rockMaterial as PBRMaterial)
                //material.albedoTexture = null;
                material.ambientColor = new Color3(.4, .4 ,.4);
                //material.albedoColor = new Color3(1, 1, 1);
                //material.emissiveColor = new Color3(1, 1, 1);
                this._rockMesh.material = this._rockMaterial;
                importMesh.meshes[1].dispose(false, true);
                importMesh.meshes[0].dispose();
            }
        }
    }
    public static async createRock(i: number, position: Vector3, size: Vector3,
                                   score: Observable<ScoreEvent>): Promise<Rock> {

        const rock = new InstancedMesh("asteroid-" +i, this._rockMesh as Mesh);

        rock.scaling = size;
        rock.position = position;
        //rock.material = this._rockMaterial;
        rock.name = "asteroid-" + i;
        rock.id = "asteroid-" + i;
        rock.metadata = {type: 'asteroid'};
        rock.setEnabled(true);
        const agg = new PhysicsAggregate(rock, PhysicsShapeType.CONVEX_HULL, {
            mass: 10000,
            restitution: .5,
            }, DefaultScene.MainScene);
        const body =agg.body;
        body.setLinearDamping(0);
        body.setMotionType(PhysicsMotionType.DYNAMIC);
        body.setCollisionCallbackEnabled(true);

        body.getCollisionObservable().add((eventData) => {
            if (eventData.type == 'COLLISION_STARTED') {
                if ( eventData.collidedAgainst.transformNode.id == 'ammo') {
                    score.notifyObservers({score: 1, remaining: -1, message: "Asteroid Destroyed"});
                    const explosion = ParticleSystemSet.Parse(this._explosion, DefaultScene.MainScene, false, 10);
                    const position = eventData.point;
                    // _explosion.emitterNode = position;

                    eventData.collider.shape.dispose();
                    eventData.collider.transformNode.dispose();
                    eventData.collider.dispose();

                    eventData.collidedAgainst.shape.dispose();
                    eventData.collidedAgainst.transformNode.dispose();
                    eventData.collidedAgainst.dispose();

                    const ball = MeshBuilder.CreateBox("ball", {size: .01}, DefaultScene.MainScene);

                    ball.scaling = new Vector3(.4, .4, .4);
                    ball.position = position;
                    //const material = new StandardMaterial("ball-material", DefaultScene.MainScene);
                    //material.emissiveColor = Color3.Yellow();
                    //ball.material = material;

                    explosion.start(ball);

                    setTimeout(() => {
                        explosion.systems.forEach((system: ParticleSystem) => {
                            system.stop();
                            system.dispose(true, true, true);
                        });
                        explosion.dispose();
                        if (ball && !ball.isDisposed()) {
                            ball.dispose(false, true);
                        }
                        //ball.dispose();
                    }, 1500);
                }
            }
        });
        //body.setAngularVelocity(new Vector3(Math.random(), Math.random(), Math.random()));
        // body.setLinearVelocity(Vector3.Random(-10, 10));
        return new Rock(rock);
    }
}

