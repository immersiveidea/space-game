import {
    AbstractMesh,
    Color3,
    InstancedMesh,
    Mesh,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3,
} from "@babylonjs/core";
import { GameConfig } from "./gameConfig";
import { ShipStatus } from "./shipStatus";
import { GameStats } from "./gameStats";

/**
 * Handles weapon firing and projectile lifecycle
 */
export class WeaponSystem {
    private _ammoBaseMesh: AbstractMesh;
    private _ammoMaterial: StandardMaterial;
    private _scene: Scene;
    private _shipStatus: ShipStatus | null = null;
    private _gameStats: GameStats | null = null;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    /**
     * Set the ship status instance for ammo tracking
     */
    public setShipStatus(shipStatus: ShipStatus): void {
        this._shipStatus = shipStatus;
    }

    /**
     * Set the game stats instance for tracking shots fired
     */
    public setGameStats(gameStats: GameStats): void {
        this._gameStats = gameStats;
    }

    /**
     * Initialize weapon system (create ammo template)
     */
    public initialize(): void {
        this._ammoMaterial = new StandardMaterial("ammoMaterial", this._scene);
        this._ammoMaterial.emissiveColor = new Color3(1, 1, 0);

        this._ammoBaseMesh = MeshBuilder.CreateIcoSphere(
            "bullet",
            { radius: 0.1, subdivisions: 2 },
            this._scene
        );
        this._ammoBaseMesh.material = this._ammoMaterial;
        this._ammoBaseMesh.setEnabled(false);
    }

    /**
     * Fire a projectile from the ship
     * @param shipTransform - Ship transform node for position/orientation
     * @param velocityVector - Complete velocity vector for the projectile (ship forward + ship velocity)
     */
    public fire(
        shipTransform: TransformNode,
        velocityVector: Vector3
    ): void {
        // Only allow shooting if physics is enabled
        const config = GameConfig.getInstance();
        if (!config.physicsEnabled) {
            return;
        }

        // Check if we have ammo before firing
        if (this._shipStatus && this._shipStatus.ammo <= 0) {
            return;
        }

        // Create projectile instance
        const ammo = new InstancedMesh("ammo", this._ammoBaseMesh as Mesh);
        ammo.parent = shipTransform;
        ammo.position.y = 0.1;
        ammo.position.z = 8.4;

        // Detach from parent to move independently
        ammo.setParent(null);

        // Create physics for projectile
        const ammoAggregate = new PhysicsAggregate(
            ammo,
            PhysicsShapeType.SPHERE,
            {
                mass: 1000,
                restitution: 0,
            },
            this._scene
        );
        ammoAggregate.body.setAngularDamping(1);
        ammoAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
        ammoAggregate.body.setCollisionCallbackEnabled(true);

        // Set projectile velocity (already includes ship velocity)
        ammoAggregate.body.setLinearVelocity(velocityVector);

        // Consume ammo
        if (this._shipStatus) {
            this._shipStatus.consumeAmmo(0.01);
        }

        // Track shot fired
        if (this._gameStats) {
            this._gameStats.recordShotFired();
        }

        // Track hits via collision detection
        let hitRecorded = false; // Prevent multiple hits from same projectile
        const gameStats = this._gameStats; // Capture in closure

        const collisionObserver = ammoAggregate.body.getCollisionObservable().add((collisionEvent) => {
            // Check if projectile hit something (not ship, not another projectile)
            // Asteroids/rocks are the targets
            if (!hitRecorded && gameStats && collisionEvent.collidedAgainst) {
                // Record as hit - assumes collision with asteroid
                gameStats.recordShotHit();
                hitRecorded = true;

                // Remove collision observer after first hit
                if (collisionObserver) {
                    ammoAggregate.body.getCollisionObservable().remove(collisionObserver);
                }
            }
        });

        // Auto-dispose after 2 seconds
        window.setTimeout(() => {
            // Clean up collision observer
            if (collisionObserver) {
                ammoAggregate.body.getCollisionObservable().remove(collisionObserver);
            }
            ammoAggregate.dispose();
            ammo.dispose();
        }, 2000);
    }

    /**
     * Cleanup weapon system resources
     */
    public dispose(): void {
        this._ammoBaseMesh?.dispose();
        this._ammoMaterial?.dispose();
    }
}
