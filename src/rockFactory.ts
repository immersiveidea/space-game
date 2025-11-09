import {
    AbstractMesh,
    AudioEngineV2,
    DistanceConstraint,
    InstancedMesh,
    Mesh,
    Observable,
    PhysicsAggregate,
    PhysicsBody,
    PhysicsMotionType,
    PhysicsShapeType,
    Sound,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {ScoreEvent} from "./scoreboard";
import {GameConfig} from "./gameConfig";
import {ExplosionManager} from "./explosionManager";
import debugLog from './debug';
import loadAsset from "./utils/loadAsset";

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
    private static _asteroidMesh: AbstractMesh;
    private static _explosionManager: ExplosionManager;
    private static _orbitCenter: PhysicsAggregate;
    private static _explosionSound: Sound;
    private static _audioEngine: AudioEngineV2 | null = null;

    public static async init(audioEngine?: AudioEngineV2) {
        if (audioEngine) {
            this._audioEngine = audioEngine;
        }
        // Initialize explosion manager
        const node = new TransformNode('orbitCenter', DefaultScene.MainScene);
        node.position = Vector3.Zero();
        this._orbitCenter = new PhysicsAggregate(node, PhysicsShapeType.SPHERE, {radius: .1, mass: 1000}, DefaultScene.MainScene );
        this._orbitCenter.body.setMotionType(PhysicsMotionType.ANIMATED);
        this._explosionManager = new ExplosionManager(DefaultScene.MainScene, {
            duration: 800,
            explosionForce: 20.0,
            frameRate: 60
        });
        await this._explosionManager.initialize();

        // Load explosion sound with spatial audio (only if audio engine available)
        if (this._audioEngine) {
            debugLog('[RockFactory] Loading explosion sound with AudioEngineV2...');

            // Wrap Sound loading in a Promise to ensure it's loaded before continuing
            await new Promise<void>((resolve) => {
                this._explosionSound = new Sound(
                    "explosionSound",
                    "/assets/themes/default/audio/explosion.mp3",
                    DefaultScene.MainScene,
                    () => {
                        debugLog('[RockFactory] Explosion sound loaded successfully');
                        resolve();
                    },
                    {
                        loop: false,
                        autoplay: false,
                        spatialSound: true,
                        maxDistance: 500,
                        distanceModel: "exponential",
                        rolloffFactor: 1,
                        volume: 5.0
                    }
                );
            });
        } else {
            debugLog('[RockFactory] WARNING: No audio engine provided, explosion sounds will be disabled');
        }

        if (!this._asteroidMesh) {
            await this.loadMesh();
        }
    }
    private static async loadMesh() {
        debugLog('loading mesh');
        this._asteroidMesh = (await  loadAsset("asteroid.glb")).meshes.get('Asteroid');
        //this._asteroidMesh.setParent(null);
        this._asteroidMesh.setEnabled(false);
        debugLog(this._asteroidMesh);
    }

    public static async createRock(i: number, position: Vector3, size: Vector3,
                                   linearVelocitry: Vector3, angularVelocity: Vector3, score: Observable<ScoreEvent>): Promise<Rock> {

        const rock = new InstancedMesh("asteroid-" +i, this._asteroidMesh as Mesh);
        debugLog(rock.id);
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
            const constraint = new DistanceConstraint(Vector3.Distance(position, this._orbitCenter.body.transformNode.position), DefaultScene.MainScene);
            body.addConstraint(this._orbitCenter.body, constraint);

            body.setLinearDamping(0)
            body.setMotionType(PhysicsMotionType.DYNAMIC);
            body.setCollisionCallbackEnabled(true);
            body.setLinearVelocity(linearVelocitry);
            body.setAngularVelocity(angularVelocity);
            body.getCollisionObservable().add((eventData) => {
                if (eventData.type == 'COLLISION_STARTED') {
                    if ( eventData.collidedAgainst.transformNode.id == 'ammo') {
                        debugLog('[RockFactory] ASTEROID HIT! Triggering explosion...');
                        score.notifyObservers({score: 1, remaining: -1, message: "Asteroid Destroyed"});

                        // Get the asteroid mesh before disposing
                        const asteroidMesh = eventData.collider.transformNode as AbstractMesh;
                        const asteroidPosition = asteroidMesh.getAbsolutePosition();
                        debugLog('[RockFactory] Asteroid mesh to explode:', {
                            name: asteroidMesh.name,
                            id: asteroidMesh.id,
                            position: asteroidPosition.toString()
                        });

                        // Play spatial explosion sound at asteroid position
                        if (RockFactory._explosionSound) {
                            debugLog('[RockFactory] Explosion sound exists, isReady:', RockFactory._explosionSound.isReady());
                            RockFactory._explosionSound.setPosition(asteroidPosition);
                            const playResult = RockFactory._explosionSound.play();
                            debugLog('[RockFactory] Playing explosion sound at position:', asteroidPosition.toString(), 'play() returned:', playResult);
                        } else {
                            debugLog('[RockFactory] WARNING: Explosion sound not loaded!');
                        }

                        // Play explosion using ExplosionManager (clones mesh internally)
                        debugLog('[RockFactory] Calling ExplosionManager.playExplosion()...');
                        RockFactory._explosionManager.playExplosion(asteroidMesh);
                        debugLog('[RockFactory] Explosion call completed');

                        // Now dispose the physics objects and original mesh
                        debugLog('[RockFactory] Disposing physics objects and meshes...');
                        eventData.collider.shape.dispose();
                        eventData.collider.transformNode.dispose();
                        eventData.collider.dispose();
                        eventData.collidedAgainst.shape.dispose();
                        eventData.collidedAgainst.transformNode.dispose();
                        eventData.collidedAgainst.dispose();
                        debugLog('[RockFactory] Disposal complete');
                    }
                }
            });
        }

        return new Rock(rock);
    }
}

