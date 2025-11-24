import {
    AbstractMesh,
    AudioEngineV2,
    DistanceConstraint,
    HavokPlugin,
    InstancedMesh,
    Mesh,
    Observable,
    PhysicsActivationControl,
    PhysicsAggregate,
    PhysicsBody,
    PhysicsMotionType,
    PhysicsShapeType,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "../../core/defaultScene";
import {ScoreEvent} from "../../ui/hud/scoreboard";
import {GameConfig} from "../../core/gameConfig";
import {ExplosionManager} from "./explosionManager";
import debugLog from '../../core/debug';
import loadAsset from "../../utils/loadAsset";

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

    /**
     * Initialize non-audio assets (meshes, explosion manager)
     * Call this before audio engine is unlocked
     */
    public static async init() {
        // Initialize explosion manager
        const node = new TransformNode('orbitCenter', DefaultScene.MainScene);
        node.position = Vector3.Zero();
        this._orbitCenter = new PhysicsAggregate(node, PhysicsShapeType.SPHERE, {radius: .1, mass: 0}, DefaultScene.MainScene );
        this._orbitCenter.body.setMotionType(PhysicsMotionType.STATIC);
        this._explosionManager = new ExplosionManager(DefaultScene.MainScene, {
            duration: 2000,
            explosionForce: 150.0,
            frameRate: 60
        });
        await this._explosionManager.initialize();

        if (!this._asteroidMesh) {
            await this.loadMesh();
        }
    }

    /**
     * Initialize audio (explosion sound)
     * Call this AFTER audio engine is unlocked
     */
    public static async initAudio(audioEngine: AudioEngineV2) {
        debugLog('[RockFactory] Initializing audio via ExplosionManager');
        await this._explosionManager.initAudio(audioEngine);
        debugLog('[RockFactory] Audio initialization complete');
    }
    private static async loadMesh() {
        debugLog('loading mesh');
        this._asteroidMesh = (await  loadAsset("asteroid.glb")).meshes.get('Asteroid');
        //this._asteroidMesh.setParent(null);
        this._asteroidMesh.setEnabled(false);
        debugLog(this._asteroidMesh);
    }

    public static async createRock(i: number, position: Vector3, scale: number,
                                   linearVelocitry: Vector3, angularVelocity: Vector3, score: Observable<ScoreEvent>,
                                   useOrbitConstraint: boolean = true): Promise<Rock> {

        const rock = new InstancedMesh("asteroid-" +i, this._asteroidMesh as Mesh);
        debugLog(rock.id);
        rock.scaling = new Vector3(scale, scale, scale);
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

            // Only apply orbit constraint if enabled for this level
            if (useOrbitConstraint) {
                debugLog(`[RockFactory] Applying orbit constraint for ${rock.name}`);
                const constraint = new DistanceConstraint(Vector3.Distance(position, this._orbitCenter.body.transformNode.position), DefaultScene.MainScene);
                body.addConstraint(this._orbitCenter.body, constraint);
            } else {
                debugLog(`[RockFactory] Orbit constraint disabled for ${rock.name} - asteroid will move freely`);
            }

            body.setLinearDamping(0)
            body.setMotionType(PhysicsMotionType.DYNAMIC);
            body.setCollisionCallbackEnabled(true);

            // Prevent asteroids from sleeping to ensure consistent physics simulation
            const physicsPlugin = DefaultScene.MainScene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin;
            if (physicsPlugin) {
                physicsPlugin.setActivationControl(body, PhysicsActivationControl.ALWAYS_ACTIVE);
            }

            debugLog(`[RockFactory] Setting velocities for ${rock.name}:`);
            debugLog(`[RockFactory]   Linear velocity input: ${linearVelocitry.toString()}`);
            debugLog(`[RockFactory]   Angular velocity input: ${angularVelocity.toString()}`);

            body.setLinearVelocity(linearVelocitry);
            body.setAngularVelocity(angularVelocity);

            // Verify velocities were set
            const setLinear = body.getLinearVelocity();
            const setAngular = body.getAngularVelocity();
            debugLog(`[RockFactory]   Linear velocity after set: ${setLinear.toString()}`);
            debugLog(`[RockFactory]   Angular velocity after set: ${setAngular.toString()}`);
            body.getCollisionObservable().add((eventData) => {
                if (eventData.type == 'COLLISION_STARTED') {
                    if ( eventData.collidedAgainst.transformNode.id == 'ammo') {
                        debugLog('[RockFactory] ASTEROID HIT! Triggering explosion...');
                        score.notifyObservers({score: 1, remaining: -1, message: "Asteroid Destroyed"});

                        // Get the asteroid mesh before disposing
                        const asteroidMesh = eventData.collider.transformNode as AbstractMesh;
                        debugLog('[RockFactory] Asteroid mesh to explode:', {
                            name: asteroidMesh.name,
                            id: asteroidMesh.id,
                            position: asteroidMesh.getAbsolutePosition().toString()
                        });

                        // Dispose asteroid physics objects BEFORE explosion (to prevent double-disposal)
                        debugLog('[RockFactory] Disposing asteroid physics objects...');
                        if (eventData.collider.shape) {
                            eventData.collider.shape.dispose();
                        }
                        if (eventData.collider) {
                            eventData.collider.dispose();
                        }

                        // Play explosion (visual + audio handled by ExplosionManager)
                        // Note: ExplosionManager will dispose the asteroid mesh after explosion
                        RockFactory._explosionManager.playExplosion(asteroidMesh);

                        // Dispose projectile physics objects
                        debugLog('[RockFactory] Disposing projectile physics objects...');
                        if (eventData.collidedAgainst.shape) {
                            eventData.collidedAgainst.shape.dispose();
                        }
                        if (eventData.collidedAgainst.transformNode) {
                            eventData.collidedAgainst.transformNode.dispose();
                        }
                        if (eventData.collidedAgainst) {
                            eventData.collidedAgainst.dispose();
                        }
                        debugLog('[RockFactory] Disposal complete');
                    }
                }
            });
        }

        return new Rock(rock);
    }
}

