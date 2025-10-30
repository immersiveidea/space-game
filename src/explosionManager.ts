import {
    AbstractMesh,
    Animation, Color3,
    Mesh, MeshBuilder,
    MeshExploder,
    Scene,
    Vector3,
    VertexData
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";

/**
 * Configuration for explosion effects
 */
export interface ExplosionConfig {
    /** Duration of explosion in milliseconds */
    duration?: number;
    /** Maximum explosion force (how far pieces spread) */
    explosionForce?: number;
    /** Frame rate for explosion animation */
    frameRate?: number;
}

/**
 * Manages mesh explosion effects using BabylonJS MeshExploder
 */
export class ExplosionManager {
    private scene: Scene;
    private config: Required<ExplosionConfig>;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<ExplosionConfig> = {
        duration: 1000,
        explosionForce: 5,
        frameRate: 60
    };

    constructor(scene: Scene, config?: ExplosionConfig) {
        this.scene = scene;
        this.config = { ...ExplosionManager.DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the explosion manager (no longer needed for MeshExploder, but kept for API compatibility)
     */
    public async initialize(): Promise<void> {
        console.log("ExplosionManager initialized with MeshExploder");
    }

    /**
     * Create sphere debris pieces for explosion
     * MeshExploder requires an array of separate meshes
     * @param mesh The mesh to explode (used for position/scale)
     * @param pieces Number of pieces to create
     * @returns Array of sphere mesh objects
     */
    private splitIntoSeparateMeshes(mesh: Mesh, pieces: number = 32): Mesh[] {
        console.log(`Creating ${pieces} sphere debris pieces`);

        const meshPieces: Mesh[] = [];
        const basePosition = mesh.position.clone();
        const baseScale = mesh.scaling.clone();

        // Create material for debris
        const material = mesh.material?.clone('debris-material');
        if (material) {
            //(material as any).emissiveColor = Color3.Yellow();
        }

        // Create sphere debris scattered around the original mesh position
        const avgScale = (baseScale.x + baseScale.y + baseScale.z) / 3;
        const debrisSize = avgScale * 0.3; // Size relative to asteroid

        for (let i = 0; i < pieces; i++) {
            // Create a small sphere for debris
            const sphere = MeshBuilder.CreateIcoSphere(
                `${mesh.name}_debris_${i}`,
                {
                 radius: debrisSize,
                    subdivisions:  2
                }, DefaultScene.MainScene
            );

            // Position spheres in a small cluster around the original position
            const offsetRadius = avgScale * 0.5;
            const angle1 = (i / pieces) * Math.PI * 2;
            const angle2 = Math.random() * Math.PI;

            sphere.position = new Vector3(
                basePosition.x + Math.sin(angle2) * Math.cos(angle1) * offsetRadius,
                basePosition.y + Math.sin(angle2) * Math.sin(angle1) * offsetRadius,
                basePosition.z + Math.cos(angle2) * offsetRadius
            );

            sphere.material = material;
            sphere.isVisible = true;
            sphere.setEnabled(true);

            meshPieces.push(sphere);
        }

        console.log(`Created ${meshPieces.length} sphere debris pieces`);
        return meshPieces;
    }

    /**
     * Explode a mesh by breaking it into pieces and animating them outward
     * @param mesh The mesh to explode (will be cloned internally)
     */
    public playExplosion(mesh: AbstractMesh): void {
        // Get the source mesh if this is an instanced mesh
        let sourceMesh: Mesh;
        if ((mesh as any).sourceMesh) {
            sourceMesh = (mesh as any).sourceMesh as Mesh;
        } else {
            sourceMesh = mesh as Mesh;
        }

        // Clone the source mesh so we don't affect the original
        const meshToExplode = sourceMesh.clone("exploding-" + mesh.name, null, true, false);
        if (!meshToExplode) {
            console.warn("Failed to clone mesh for explosion");
            return;
        }

        // Apply the instance's transformation to the cloned mesh
        meshToExplode.position = mesh.getAbsolutePosition().clone();
        meshToExplode.rotation = mesh.rotation.clone();
        meshToExplode.scaling = mesh.scaling.clone();
        meshToExplode.setEnabled(true);

        // Force world matrix computation
        meshToExplode.computeWorldMatrix(true);

        // Check if mesh has proper geometry
        if (!meshToExplode.getTotalVertices || meshToExplode.getTotalVertices() === 0) {
            console.warn("Mesh has no vertices, cannot explode");
            meshToExplode.dispose();
            return;
        }

        console.log(`Exploding mesh: ${meshToExplode.name}, vertices: ${meshToExplode.getTotalVertices()}`);

        // Split the mesh into separate mesh objects (MeshExploder requirement)
        const meshPieces = this.splitIntoSeparateMeshes(meshToExplode, 12);

        if (meshPieces.length === 0) {
            console.warn("Failed to split mesh into pieces");
            meshToExplode.dispose();
            return;
        }

        // Original mesh is no longer needed - the pieces replace it
        meshToExplode.dispose();

        // Create the exploder with the array of separate meshes
        // The second parameter is optional - it's the center mesh to explode from
        // If not provided, MeshExploder will auto-calculate the center
        const exploder = new MeshExploder(meshPieces);

        console.log(`Starting explosion animation for ${meshPieces.length} mesh pieces`);

        // Animate the explosion by calling explode() each frame with increasing values
        const startTime = Date.now();
        const animationDuration = this.config.duration;
        const maxForce = this.config.explosionForce;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1.0);

            // Calculate current explosion value (0 to maxForce)
            const currentValue = progress * maxForce;
            exploder.explode(currentValue);

            // Animate debris size to zero (1.0 to 0.0)
            const scale = 1.0 - progress;
            meshPieces.forEach(piece => {
                piece.scaling.set(scale, scale, scale);
            });

            // Continue animation if not complete
            if (progress < 1.0) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - clean up
                console.log(`Explosion animation complete, cleaning up`);
                this.cleanupExplosion(meshPieces);
            }
        };

        // Start the animation
        animate();
    }

    /**
     * Clean up explosion meshes
     */
    private cleanupExplosion(meshPieces: Mesh[]): void {
        // Dispose all the mesh pieces
        meshPieces.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {
                mesh.dispose();
            }
        });

        console.log(`Explosion cleaned up - disposed ${meshPieces.length} pieces`);
    }

    /**
     * Dispose of the explosion manager
     */
    public dispose(): void {
        // Nothing to dispose with MeshExploder approach
        console.log("ExplosionManager disposed");
    }
}
