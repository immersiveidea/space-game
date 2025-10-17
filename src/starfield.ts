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
    private static _explosionPool: ParticleSystemSet[] = [];
    private static _poolSize: number = 10;

    public static async init() {
        // Pre-create explosion particle systems for pooling
        console.log("Pre-creating explosion particle systems...");
        for (let i = 0; i < this._poolSize; i++) {
            const set = await ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene);
            this._explosionPool.push(set);
        }
        console.log(`Created ${this._poolSize} explosion particle systems in pool`);

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

    private static getExplosionFromPool(): ParticleSystemSet | null {
        return this._explosionPool.pop() || null;
    }

    private static returnExplosionToPool(explosion: ParticleSystemSet) {
        explosion.dispose();
        ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene).then((set) => {
            this._explosionPool.push(set);
        })
    }

    public static async createRock(i: number, position: Vector3, size: Vector3,
                                   score: Observable<ScoreEvent>): Promise<Rock> {

        const rock = new InstancedMesh("asteroid-" +i, this._rockMesh as Mesh);
        console.log(rock.id);
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
                    const position = eventData.point;

                    eventData.collider.shape.dispose();
                    eventData.collider.transformNode.dispose();
                    eventData.collider.dispose();

                    eventData.collidedAgainst.shape.dispose();
                    eventData.collidedAgainst.transformNode.dispose();
                    eventData.collidedAgainst.dispose();

                    // Get explosion from pool (or create new if pool empty)
                    let explosion = RockFactory.getExplosionFromPool();

                    if (!explosion) {
                        console.log("Pool empty, creating new explosion");
                        ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene).then((set) => {
                            const point = MeshBuilder.CreateSphere("point", {diameter: 0.1}, DefaultScene.MainScene);
                            point.position = position.clone();
                            //point.isVisible = false;

                            set.start(point);

                            setTimeout(() => {
                                set.dispose();
                                point.dispose();
                            }, 2000);
                        });
                    } else {
                        // Use pooled explosion
                        const point = MeshBuilder.CreateSphere("point", {diameter: 10}, DefaultScene.MainScene);
                        point.position = position.clone();
                        //point.isVisible = false;

                        console.log("Using pooled explosion with", explosion.systems.length, "systems at", position);

                        // Set emitter and start each system individually
                        explosion.systems.forEach((system: ParticleSystem, idx: number) => {
                            system.emitter = point;  // Set emitter to the collision point
                            system.start();  // Start this specific system
                            console.log(`  System ${idx}: emitter set to`, system.emitter, "activeCount=", system.getActiveCount());
                        });

                        setTimeout(() => {
                            explosion.systems.forEach((system: ParticleSystem) => {
                                system.stop();
                            });
                            RockFactory.returnExplosionToPool(explosion);
                            point.dispose();
                        }, 2000);
                    }
                }
            }
        });
        //body.setAngularVelocity(new Vector3(Math.random(), Math.random(), Math.random()));
        // body.setLinearVelocity(Vector3.Random(-10, 10));
        return new Rock(rock);
    }
}

