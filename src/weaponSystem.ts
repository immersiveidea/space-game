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

/**
 * Handles weapon firing and projectile lifecycle
 */
export class WeaponSystem {
    private _ammoBaseMesh: AbstractMesh;
    private _ammoMaterial: StandardMaterial;
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
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

        // Set projectile velocity (already includes ship velocity)
        ammoAggregate.body.setLinearVelocity(velocityVector);

        // Auto-dispose after 2 seconds
        window.setTimeout(() => {
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
