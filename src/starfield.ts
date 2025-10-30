import {
    AbstractMesh,
    Color3, InstancedMesh,
    Mesh,
    MeshBuilder, NoiseProceduralTexture, Observable,
    ParticleHelper,
    ParticleSystem,
    ParticleSystemSet,
    PBRMaterial,
    PhysicsAggregate, PhysicsBody,
    PhysicsMotionType,
    PhysicsShapeType, PhysicsViewer,
    SceneLoader, StandardMaterial,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {ScoreEvent} from "./scoreboard";
import {Debug} from "@babylonjs/core/Legacy/legacy";
import {createSphereLightmap} from "./sphereLightmap";
import { GameConfig } from "./gameConfig";
import { MaterialFactory } from "./materialFactory";
let _particleData: any = null;

export class Rock {
    private _rockMesh: AbstractMesh;
    constructor(mesh: AbstractMesh) {
        this._rockMesh = mesh;
    }
    public get physicsBody(): PhysicsBody | null {
        return this._rockMesh.physicsBody || null;
    }
    public get position(): Vector3 {
        return this._rockMesh.getAbsolutePosition();
    }
}

export class RockFactory {
    private static _rockMesh: AbstractMesh;
    private static _rockMaterial: PBRMaterial;
    private static _originalMaterial: PBRMaterial = null;
    private static _explosionPool: ParticleSystemSet[] = [];
    private static _poolSize: number = 10;
    private static _viewer: PhysicsViewer = null;
    public static async init() {
        // Pre-create explosion particle systems for pooling
        console.log("Pre-creating explosion particle systems...");
        for (let i = 0; i < this._poolSize; i++) {
            const set = await ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene);
            set.systems.forEach((system) => {
                system.renderingGroupId =1;
            })
            this._explosionPool.push(set);
        }
        console.log(`Created ${this._poolSize} explosion particle systems in pool`);

        if (!this._rockMesh) {
            await this.loadMesh();
        }
    }
    private static async loadMesh() {
        console.log('loading mesh');
        const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "asteroid2.glb", DefaultScene.MainScene);
        this._rockMesh = importMesh.meshes[1].clone("asteroid", null, false);
        this._rockMesh.setParent(null);
        this._rockMesh.setEnabled(false);

        //importMesh.meshes[1].dispose();
        console.log(importMesh.meshes);
        if (!this._rockMaterial) {
            // Clone the original material from GLB to preserve all textures
            this._originalMaterial = this._rockMesh.material.clone("asteroid-original") as PBRMaterial;
            console.log('Cloned original material from GLB:', this._originalMaterial);

            // Create material using GameConfig texture level
            const config = GameConfig.getInstance();
            this._rockMaterial = MaterialFactory.createAsteroidMaterial(
                'asteroid-material',
                config.asteroidTextureLevel,
                DefaultScene.MainScene,
                this._originalMaterial
            ) as PBRMaterial;

            this._rockMesh.material = this._rockMaterial;
            importMesh.meshes[1].dispose(false, true);
            importMesh.meshes[0].dispose();
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

        // Only create physics if enabled in config
        const config = GameConfig.getInstance();
        if (config.physicsEnabled) {
            // PhysicsAggregate will automatically compute sphere size from mesh bounding info
            // The mesh scaling is already applied, so Babylon will create correctly sized physics shape
            const agg = new PhysicsAggregate(rock, PhysicsShapeType.SPHERE, {
                mass: 10000,
                restitution: .5
                // Don't pass radius - let Babylon compute from scaled mesh bounds
                }, DefaultScene.MainScene);
            const body = agg.body;

            if (!this._viewer) {
               // this._viewer = new PhysicsViewer(DefaultScene.MainScene);
            }

            // this._viewer.showBody(body);
            body.setLinearDamping(0)
            body.setMotionType(PhysicsMotionType.DYNAMIC);
            body.setCollisionCallbackEnabled(true);
            let scaling = Vector3.One();
            body.getCollisionObservable().add((eventData) => {
                if (eventData.type == 'COLLISION_STARTED') {
                    if ( eventData.collidedAgainst.transformNode.id == 'ammo') {
                        score.notifyObservers({score: 1, remaining: -1, message: "Asteroid Destroyed"});
                        const position = eventData.point;

                        eventData.collider.shape.dispose();
                        eventData.collider.transformNode.dispose();
                        eventData.collider.dispose();
                        scaling = eventData.collider.transformNode.scaling.clone();
                        console.log(scaling);
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
                                point.isVisible = false;

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
                            point.isVisible = false;
                            point.scaling = scaling.multiplyByFloats(.2,.3,.2);
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
        }

        return new Rock(rock);
    }
}

