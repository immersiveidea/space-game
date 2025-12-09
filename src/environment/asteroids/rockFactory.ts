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
import log from '../../core/logger';
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

interface RockConfig {
    position: Vector3;
    rotation?: Vector3;
    scale: number;
    linearVelocity: Vector3;
    angularVelocity: Vector3;
    scoreObservable: Observable<ScoreEvent>;
    useOrbitConstraint: boolean;
    targetPosition?: Vector3;
    targetMode?: 'orbit' | 'moveToward';
}

export class RockFactory {
    private static _asteroidMesh: AbstractMesh | null = null;
    private static _explosionManager: ExplosionManager | null = null;
    private static _orbitCenter: PhysicsAggregate | null = null;

    // Store created rocks for deferred physics initialization
    private static _createdRocks: Map<string, { mesh: InstancedMesh; config: RockConfig }> = new Map();

    /** Public getter for explosion manager (used by WeaponSystem for shape-cast hits) */
    public static get explosionManager(): ExplosionManager | null {
        return this._explosionManager;
    }

    /**
     * Initialize mesh only (Phase 2 - before XR)
     * Just loads the asteroid mesh template, no physics
     */
    public static async initMesh(): Promise<void> {
        if (!this._asteroidMesh || this._asteroidMesh.isDisposed()) {
            await this.loadMesh();
        }

        // Initialize explosion manager (visual only, audio added later)
        if (!this._explosionManager) {
            this._explosionManager = new ExplosionManager(DefaultScene.MainScene, {
                duration: 2000,
                explosionForce: 150.0,
                frameRate: 60
            });
            await this._explosionManager.initialize();
        }

        log.debug('[RockFactory] Mesh initialized');
    }

    /**
     * Initialize physics systems (Phase 3 - after XR)
     * Creates orbit center and initializes physics for all created rocks
     */
    public static initPhysics(): void {
        // Create orbit center for constraints
        if (!this._orbitCenter) {
            const node = new TransformNode('orbitCenter', DefaultScene.MainScene);
            node.position = Vector3.Zero();
            this._orbitCenter = new PhysicsAggregate(
                node, PhysicsShapeType.SPHERE,
                { radius: .1, mass: 0 },
                DefaultScene.MainScene
            );
            this._orbitCenter.body.setMotionType(PhysicsMotionType.STATIC);
        }

        // Initialize physics and show all created rocks
        for (const [id, { mesh, config }] of this._createdRocks) {
            this.initializeRockPhysics(mesh, config);
            mesh.setEnabled(true);
            mesh.isVisible = true;
        }
        this._createdRocks.clear();

        log.debug('[RockFactory] Physics initialized');
    }

    /**
     * Legacy init - calls initMesh + initPhysics for backwards compatibility
     */
    public static async init(): Promise<void> {
        await this.initMesh();
        this.initPhysics();
    }

    /**
     * Reset static state - call during game cleanup
     */
    public static reset(): void {
        log.debug('[RockFactory] Resetting static state');
        this._asteroidMesh = null;
        this._createdRocks.clear();
        if (this._explosionManager) {
            this._explosionManager.dispose();
            this._explosionManager = null;
        }
        if (this._orbitCenter) {
            this._orbitCenter.dispose();
            this._orbitCenter = null;
        }
    }

    /**
     * Initialize audio (explosion sound)
     * Call this AFTER audio engine is unlocked
     */
    public static async initAudio(audioEngine: AudioEngineV2) {
        log.debug('[RockFactory] Initializing audio via ExplosionManager');
        if (this._explosionManager) {
            await this._explosionManager.initAudio(audioEngine);
        }
        log.debug('[RockFactory] Audio initialization complete');
    }
    private static async loadMesh() {
        log.debug('loading mesh');
        const asset = await loadAsset("asteroid.glb");
        this._asteroidMesh = asset.meshes.get('Asteroid') || null;
        this._asteroidMesh.material.backFaceCulling = true;
        this._asteroidMesh.material.freeze();
        if (this._asteroidMesh) {
            this._asteroidMesh.setEnabled(false);
            this._asteroidMesh.renderingGroupId = 2;
        }
        log.debug(this._asteroidMesh);
    }

    /**
     * Create rock mesh only (Phase 2 - hidden, no physics)
     */
    public static createRockMesh(
        i: number,
        position: Vector3,
        scale: number,
        linearVelocity: Vector3,
        angularVelocity: Vector3,
        scoreObservable: Observable<ScoreEvent>,
        useOrbitConstraint: boolean = true,
        hidden: boolean = false,
        targetPosition?: Vector3,
        targetMode?: 'orbit' | 'moveToward',
        rotation?: Vector3
    ): Rock {
        if (!this._asteroidMesh) {
            throw new Error('[RockFactory] Asteroid mesh not loaded. Call initMesh() first.');
        }

        const rock = new InstancedMesh("asteroid-" + i, this._asteroidMesh as Mesh);
        rock.scaling = new Vector3(scale, scale, scale);
        rock.position = position;
        if (rotation) rock.rotation = rotation;
        rock.name = "asteroid-" + i;
        rock.id = "asteroid-" + i;
        rock.metadata = { type: 'asteroid' };
        rock.setEnabled(!hidden);
        rock.isVisible = !hidden;

        // Store config for deferred physics initialization
        const config: RockConfig = {
            position,
            rotation,
            scale,
            linearVelocity,
            angularVelocity,
            scoreObservable,
            useOrbitConstraint,
            targetPosition,
            targetMode
        };
        this._createdRocks.set(rock.id, { mesh: rock, config });

        log.debug(`[RockFactory] Created rock mesh ${rock.id} (hidden: ${hidden}, target: ${targetMode || 'none'})`);
        return new Rock(rock);
    }

    /**
     * Initialize physics for a single rock
     */
    private static initializeRockPhysics(rock: InstancedMesh, config: RockConfig): void {
        const gameConfig = GameConfig.getInstance();
        if (!gameConfig.physicsEnabled) return;

        const agg = new PhysicsAggregate(rock, PhysicsShapeType.SPHERE, {
            mass: 200,
            friction: 0,
            restitution: .8
        }, DefaultScene.MainScene);

        const body = agg.body;
        body.setAngularDamping(0);
        body.setLinearDamping(0);
        body.setMotionType(PhysicsMotionType.DYNAMIC);
        body.setCollisionCallbackEnabled(true);

        // Handle target-based physics
        if (config.targetPosition && config.targetMode) {
            this.applyTargetPhysics(body, config);
        } else if (config.useOrbitConstraint && this._orbitCenter) {
            // Legacy: orbit around origin if no specific target
            const constraint = new DistanceConstraint(
                Vector3.Distance(config.position, this._orbitCenter.body.transformNode.position),
                DefaultScene.MainScene
            );
            body.addConstraint(this._orbitCenter.body, constraint);
        }

        // Prevent sleeping
        const physicsPlugin = DefaultScene.MainScene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin;
        if (physicsPlugin) {
            physicsPlugin.setActivationControl(body, PhysicsActivationControl.ALWAYS_ACTIVE);
        }

        // Apply velocity (may be modified by applyTargetPhysics for moveToward mode)
        if (!(config.targetPosition && config.targetMode === 'moveToward')) {
            body.setLinearVelocity(config.linearVelocity);
        }
        body.setAngularVelocity(config.angularVelocity);

        // Setup collision handler
        this.setupCollisionHandler(body, config.scoreObservable);

        log.debug(`[RockFactory] Physics initialized for ${rock.id}`);
    }

    /**
     * Apply target-based physics (orbit or moveToward)
     */
    private static applyTargetPhysics(body: PhysicsBody, config: RockConfig): void {
        if (!config.targetPosition) return;

        if (config.targetMode === 'orbit') {
            // Create distance constraint to target position
            // We need a static body at the target position for the constraint
            const targetNode = new TransformNode(`target-${body.transformNode.id}`, DefaultScene.MainScene);
            targetNode.position = config.targetPosition;
            const targetBody = new PhysicsAggregate(
                targetNode, PhysicsShapeType.SPHERE,
                { radius: 0.1, mass: 0 },
                DefaultScene.MainScene
            );
            targetBody.body.setMotionType(PhysicsMotionType.STATIC);

            const distance = Vector3.Distance(config.position, config.targetPosition);
            const constraint = new DistanceConstraint(distance, DefaultScene.MainScene);
            body.addConstraint(targetBody.body, constraint);

            // Apply original velocity for orbiting
            body.setLinearVelocity(config.linearVelocity);
        } else if (config.targetMode === 'moveToward') {
            // Calculate speed as sum of absolute velocity components
            const speed = Math.abs(config.linearVelocity.x) +
                          Math.abs(config.linearVelocity.y) +
                          Math.abs(config.linearVelocity.z);

            // Direction toward target
            const direction = config.targetPosition.subtract(config.position).normalize();

            // Final velocity = direction * speed
            const velocity = direction.scale(speed);
            body.setLinearVelocity(velocity);
        }
    }

    private static setupCollisionHandler(body: PhysicsBody, scoreObservable: Observable<ScoreEvent>): void {
        body.getCollisionObservable().add((eventData) => {
            if (eventData.type !== 'COLLISION_STARTED') return;
            if (eventData.collidedAgainst.transformNode.id !== 'ammo') return;

            const asteroidMesh = eventData.collider.transformNode as AbstractMesh;
            const asteroidScale = asteroidMesh.scaling.x;
            scoreObservable.notifyObservers({
                score: 1,
                remaining: -1,
                message: "Asteroid Destroyed",
                scale: asteroidScale
            });

            // Dispose asteroid physics
            if (eventData.collider.shape) eventData.collider.shape.dispose();
            if (eventData.collider) eventData.collider.dispose();

            // Play explosion
            if (RockFactory._explosionManager) {
                RockFactory._explosionManager.playExplosion(asteroidMesh);
            }

            // Dispose projectile physics
            if (eventData.collidedAgainst.shape) eventData.collidedAgainst.shape.dispose();
            if (eventData.collidedAgainst.transformNode) eventData.collidedAgainst.transformNode.dispose();
            if (eventData.collidedAgainst) eventData.collidedAgainst.dispose();
        });
    }

    /**
     * Show all created rock meshes (no-op if initPhysics already showed them)
     */
    public static showMeshes(): void {
        for (const { mesh } of this._createdRocks.values()) {
            mesh.setEnabled(true);
            mesh.isVisible = true;
        }
        log.debug('[RockFactory] showMeshes called');
    }

    /**
     * Legacy createRock - creates mesh with immediate physics (backwards compatible)
     */
    public static async createRock(
        i: number,
        position: Vector3,
        scale: number,
        linearVelocity: Vector3,
        angularVelocity: Vector3,
        score: Observable<ScoreEvent>,
        useOrbitConstraint: boolean = true
    ): Promise<Rock> {
        const rock = this.createRockMesh(i, position, scale, linearVelocity, angularVelocity, score, useOrbitConstraint, false);

        // Immediately initialize physics for this rock (legacy behavior)
        const meshId = "asteroid-" + i;
        const rockData = this._createdRocks.get(meshId);
        if (rockData) {
            this.initializeRockPhysics(rockData.mesh, rockData.config);
            this._createdRocks.delete(meshId);
        }

        return rock;
    }
}

