import { InstancedMesh, Vector3 } from "@babylonjs/core";

/**
 * Interface for tracking active projectiles in the shape-cast system
 */
export interface Projectile {
    mesh: InstancedMesh;
    velocity: Vector3;
    lastPosition: Vector3;
    lifetime: number;
}
