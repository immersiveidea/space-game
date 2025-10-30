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
import { ExplosionManager } from "./explosionManager";
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
    private static _explosionManager: ExplosionManager;
    private static _viewer: PhysicsViewer = null;

    public static async init() {
        // Initialize explosion manager
        this._explosionManager = new ExplosionManager(DefaultScene.MainScene, {
            duration: 500,
            explosionForce: 15.0,
            frameRate: 60
        });
        await this._explosionManager.initialize();

        if (!this._rockMesh) {
            await this.loadMesh();
        }
    }
    private static async loadMesh() {
        console.log('loading mesh');
        const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "asteroid3.glb", DefaultScene.MainScene);
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
            body.getCollisionObservable().add((eventData) => {
                if (eventData.type == 'COLLISION_STARTED') {
                    if ( eventData.collidedAgainst.transformNode.id == 'ammo') {
                        score.notifyObservers({score: 1, remaining: -1, message: "Asteroid Destroyed"});

                        // Get the asteroid mesh before disposing
                        const asteroidMesh = eventData.collider.transformNode as AbstractMesh;

                        // Play explosion using ExplosionManager (clones mesh internally)
                        RockFactory._explosionManager.playExplosion(asteroidMesh);

                        // Now dispose the physics objects and original mesh
                        eventData.collider.shape.dispose();
                        eventData.collider.transformNode.dispose();
                        eventData.collider.dispose();
                        eventData.collidedAgainst.shape.dispose();
                        eventData.collidedAgainst.transformNode.dispose();
                        eventData.collidedAgainst.dispose();
                    }
                }
            });
            //body.setAngularVelocity(new Vector3(Math.random(), Math.random(), Math.random()));
            // body.setLinearVelocity(Vector3.Random(-10, 10));
        }

        return new Rock(rock);
    }
}

