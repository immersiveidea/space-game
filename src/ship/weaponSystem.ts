import {
    AbstractMesh,
    Color3,
    HavokPlugin,
    InstancedMesh,
    Mesh,
    MeshBuilder,
    Observable,
    PhysicsBody,
    PhysicsShapeSphere,
    Quaternion,
    Scene,
    ShapeCastResult,
    StandardMaterial,
    Vector3,
} from "@babylonjs/core";
import { GameConfig } from "../core/gameConfig";
import { ShipStatus } from "./shipStatus";
import { GameStats } from "../game/gameStats";
import { Projectile } from "./projectile";
import { RockFactory } from "../environment/asteroids/rockFactory";
import log from "../core/logger";
import { ScoreEvent } from "../ui/hud/scoreboard";

/**
 * Handles weapon firing and projectile lifecycle using shape casting
 */
export class WeaponSystem {
    private _ammoBaseMesh: AbstractMesh;
    private _ammoMaterial: StandardMaterial;
    private _scene: Scene;
    private _shipStatus: ShipStatus | null = null;
    private _gameStats: GameStats | null = null;

    // Shape casting properties
    private _activeProjectiles: Projectile[] = [];
    private _bulletCastShape: PhysicsShapeSphere;
    private _localCastResult: ShapeCastResult;
    private _worldCastResult: ShapeCastResult;
    private _havokPlugin: HavokPlugin | null = null;

    // Observable for score updates when asteroids are destroyed
    private _scoreObservable: Observable<ScoreEvent> | null = null;

    // Ship body to ignore in shape casts
    private _shipBody: PhysicsBody | null = null;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public setShipStatus(shipStatus: ShipStatus): void {
        this._shipStatus = shipStatus;
    }

    public setGameStats(gameStats: GameStats): void {
        this._gameStats = gameStats;
    }

    public setScoreObservable(observable: Observable<{score: number, remaining: number, message: string}>): void {
        this._scoreObservable = observable;
    }

    public setShipBody(body: PhysicsBody): void {
        this._shipBody = body;
    }

    public initialize(): void {
        this._ammoMaterial = new StandardMaterial("ammoMaterial", this._scene);
        this._ammoMaterial.emissiveColor = new Color3(1, 1, 0);

        this._ammoBaseMesh = MeshBuilder.CreateIcoSphere(
            "bullet",
            { radius: 0.5, subdivisions: 2 },
            this._scene
        );
        this._ammoBaseMesh.material = this._ammoMaterial;
        this._ammoBaseMesh.setEnabled(false);

        // Create reusable shape for casting (matches bullet radius)
        this._bulletCastShape = new PhysicsShapeSphere(
            Vector3.Zero(),
            0.1,
            this._scene
        );

        // Reusable result objects (avoid allocations)
        this._localCastResult = new ShapeCastResult();
        this._worldCastResult = new ShapeCastResult();

        // Get Havok plugin reference
        const engine = this._scene.getPhysicsEngine();
        if (engine) {
            this._havokPlugin = engine.getPhysicsPlugin() as HavokPlugin;
        }
    }

    /**
     * Fire a projectile from the ship (no physics body - uses shape casting)
     */
    public fire(position: Vector3, velocityVector: Vector3): void {
        const config = GameConfig.getInstance();
        if (!config.physicsEnabled) return;

        if (this._shipStatus && this._shipStatus.ammo <= 0) return;

        // Create visual-only projectile (no physics body)
        const ammo = new InstancedMesh("ammo", this._ammoBaseMesh as Mesh);
        ammo.position = position.clone();

        // Track projectile for update loop
        this._activeProjectiles.push({
            mesh: ammo,
            velocity: velocityVector.clone(),
            lastPosition: position.clone(),
            lifetime: 0
        });

        if (this._shipStatus) {
            this._shipStatus.consumeAmmo(0.01);
        }

        if (this._gameStats) {
            this._gameStats.recordShotFired();
        }
    }

    /**
     * Update all active projectiles - call each frame
     */
    public update(deltaTime: number): void {
        if (!this._havokPlugin) return;

        const toRemove: number[] = [];

        for (let i = 0; i < this._activeProjectiles.length; i++) {
            const proj = this._activeProjectiles[i];
            proj.lifetime += deltaTime;

            // Remove if exceeded lifetime (2 seconds)
            if (proj.lifetime > 2) {
                toRemove.push(i);
                continue;
            }

            // Calculate next position
            const currentPos = proj.mesh.position.clone();
            const nextPos = currentPos.add(proj.velocity.scale(deltaTime));

            // Shape cast from current to next position (ignore ship body)
            this._havokPlugin.shapeCast({
                shape: this._bulletCastShape,
                rotation: Quaternion.Identity(),
                startPosition: currentPos,
                endPosition: nextPos,
                shouldHitTriggers: false,
                ignoreBody: this._shipBody ?? undefined
            }, this._localCastResult, this._worldCastResult);

            if (this._worldCastResult.hasHit) {
                // Calculate exact hit point
                const hitPoint = Vector3.Lerp(
                    currentPos,
                    nextPos,
                    this._worldCastResult.hitFraction
                );

                this._onProjectileHit(proj, hitPoint, this._worldCastResult);
                toRemove.push(i);
            } else {
                // No hit - update position
                proj.lastPosition.copyFrom(currentPos);
                proj.mesh.position.copyFrom(nextPos);
            }
        }

        // Remove hit/expired projectiles (reverse order to preserve indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const proj = this._activeProjectiles[toRemove[i]];
            proj.mesh.dispose();
            this._activeProjectiles.splice(toRemove[i], 1);
        }
    }

    private _onProjectileHit(
        proj: Projectile,
        hitPoint: Vector3,
        result: ShapeCastResult
    ): void {
        if (this._gameStats) {
            this._gameStats.recordShotHit();
        }

        if (!result.body) return;

        const hitMesh = result.body.transformNode as AbstractMesh;
        const isAsteroid = hitMesh?.name?.startsWith("asteroid-");

        if (isAsteroid) {
            log.debug('[WeaponSystem] Asteroid hit! Triggering destruction...');

            // Update score with asteroid scale for point calculation
            if (this._scoreObservable) {
                const asteroidScale = hitMesh.scaling.x;
                this._scoreObservable.notifyObservers({
                    score: 1,
                    remaining: -1,
                    message: "Asteroid Destroyed",
                    scale: asteroidScale
                });
            }

            // Dispose asteroid physics before explosion
            if (result.shape) {
                result.shape.dispose();
            }
            result.body.dispose();

            // Play explosion effect
            if (RockFactory.explosionManager) {
                RockFactory.explosionManager.playExplosion(hitMesh);
            }
        } else {
            // Non-asteroid hit - just apply impulse
            const impulse = proj.velocity.normalize().scale(50000);
            result.body.applyImpulse(impulse, hitPoint);
        }
    }

    public dispose(): void {
        // Dispose all active projectiles
        for (const proj of this._activeProjectiles) {
            proj.mesh.dispose();
        }
        this._activeProjectiles = [];

        this._bulletCastShape?.dispose();
        this._ammoBaseMesh?.dispose();
        this._ammoMaterial?.dispose();
    }
}
