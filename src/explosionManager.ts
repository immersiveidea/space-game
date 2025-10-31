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
        console.log(`[ExplosionManager] Creating ${pieces} sphere debris pieces`);
        console.log('[ExplosionManager] Base mesh info:', {
            position: mesh.position.toString(),
            scaling: mesh.scaling.toString(),
            hasMaterial: !!mesh.material
        });

        const meshPieces: Mesh[] = [];
        const basePosition = mesh.position.clone();
        const baseScale = mesh.scaling.clone();

        // Create material for debris
        const material = mesh.material?.clone('debris-material');
        if (material) {
            //(material as any).emissiveColor = Color3.Yellow();
            console.log('[ExplosionManager] Material cloned successfully');
        } else {
            console.warn('[ExplosionManager] WARNING: No material on base mesh');
        }

        // Create sphere debris scattered around the original mesh position
        const avgScale = (baseScale.x + baseScale.y + baseScale.z) / 3;
        const debrisSize = avgScale * 0.3; // Size relative to asteroid

        console.log('[ExplosionManager] Debris parameters:', {
            avgScale,
            debrisSize,
            offsetRadius: avgScale * 0.5
        });

        for (let i = 0; i < pieces; i++) {
            try {
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
            } catch (error) {
                console.error(`[ExplosionManager] ERROR creating debris piece ${i}:`, error);
            }
        }

        console.log(`[ExplosionManager] Successfully created ${meshPieces.length}/${pieces} sphere debris pieces`);
        if (meshPieces.length > 0) {
            console.log('[ExplosionManager] First piece sample:', {
                name: meshPieces[0].name,
                position: meshPieces[0].position.toString(),
                isVisible: meshPieces[0].isVisible,
                isEnabled: meshPieces[0].isEnabled()
            });
        }
        return meshPieces;
    }

    /**
     * Explode a mesh by breaking it into pieces and animating them outward
     * @param mesh The mesh to explode (will be cloned internally)
     */
    public playExplosion(mesh: AbstractMesh): void {
        console.log('[ExplosionManager] playExplosion called');
        console.log('[ExplosionManager] Input mesh:', {
            name: mesh.name,
            id: mesh.id,
            isInstancedMesh: !!(mesh as any).sourceMesh,
            position: mesh.position.toString(),
            scaling: mesh.scaling.toString()
        });

        // Get the source mesh if this is an instanced mesh
        let sourceMesh: Mesh;
        if ((mesh as any).sourceMesh) {
            sourceMesh = (mesh as any).sourceMesh as Mesh;
            console.log('[ExplosionManager] Using source mesh from instance:', sourceMesh.name);
        } else {
            sourceMesh = mesh as Mesh;
            console.log('[ExplosionManager] Using mesh directly (not instanced)');
        }

        // Clone the source mesh so we don't affect the original
        console.log('[ExplosionManager] Cloning mesh...');
        const meshToExplode = sourceMesh.clone("exploding-" + mesh.name, null, true, false);
        if (!meshToExplode) {
            console.error('[ExplosionManager] ERROR: Failed to clone mesh for explosion');
            return;
        }
        console.log('[ExplosionManager] Mesh cloned successfully');

        // Apply the instance's transformation to the cloned mesh
        meshToExplode.position = mesh.getAbsolutePosition().clone();
        meshToExplode.rotation = mesh.rotation.clone();
        meshToExplode.scaling = mesh.scaling.clone();
        meshToExplode.setEnabled(true);

        // Force world matrix computation
        meshToExplode.computeWorldMatrix(true);

        // Check if mesh has proper geometry
        if (!meshToExplode.getTotalVertices || meshToExplode.getTotalVertices() === 0) {
            console.error('[ExplosionManager] ERROR: Mesh has no vertices, cannot explode');
            meshToExplode.dispose();
            return;
        }

        console.log(`[ExplosionManager] Mesh ready for explosion:`, {
            name: meshToExplode.name,
            vertices: meshToExplode.getTotalVertices(),
            position: meshToExplode.position.toString(),
            scaling: meshToExplode.scaling.toString()
        });

        // Split the mesh into separate mesh objects (MeshExploder requirement)
        console.log('[ExplosionManager] Splitting mesh into pieces...');
        const meshPieces = this.splitIntoSeparateMeshes(meshToExplode, 12);

        if (meshPieces.length === 0) {
            console.error('[ExplosionManager] ERROR: Failed to split mesh into pieces');
            meshToExplode.dispose();
            return;
        }

        // Original mesh is no longer needed - the pieces replace it
        console.log('[ExplosionManager] Disposing original cloned mesh');
        meshToExplode.dispose();

        // Create the exploder with the array of separate meshes
        // The second parameter is optional - it's the center mesh to explode from
        // If not provided, MeshExploder will auto-calculate the center
        console.log('[ExplosionManager] Creating MeshExploder...');
        try {
            const exploder = new MeshExploder(meshPieces);
            console.log('[ExplosionManager] MeshExploder created successfully');

            console.log(`[ExplosionManager] Starting explosion animation:`, {
                pieceCount: meshPieces.length,
                duration: this.config.duration,
                maxForce: this.config.explosionForce
            });

            // Animate the explosion using Babylon's render loop instead of requestAnimationFrame
            const startTime = Date.now();
            const animationDuration = this.config.duration;
            const maxForce = this.config.explosionForce;
            let frameCount = 0;

            const animationObserver = this.scene.onBeforeRenderObservable.add(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1.0);

                // Calculate current explosion value (0 to maxForce)
                const currentValue = progress * maxForce;

                try {
                    exploder.explode(currentValue);
                } catch (error) {
                    console.error('[ExplosionManager] ERROR in explode():', error);
                }

                // Animate debris size to zero (1.0 to 0.0)
                const scale = 1.0 - progress;
                meshPieces.forEach(piece => {
                    if (piece && !piece.isDisposed()) {
                        piece.scaling.set(scale, scale, scale);
                    }
                });

                frameCount++;

                // Log every 15 frames (approximately every 250ms at 60fps)
                if (frameCount % 15 === 0 || frameCount === 1) {
                    console.log(`[ExplosionManager] Animation frame ${frameCount}:`, {
                        elapsed: `${elapsed}ms`,
                        progress: progress.toFixed(3),
                        currentValue: currentValue.toFixed(2),
                        scale: scale.toFixed(3),
                        piecesAlive: meshPieces.filter(p => !p.isDisposed()).length
                    });
                }

                // Continue animation if not complete
                if (progress >= 1.0) {
                    // Animation complete - remove observer and clean up
                    console.log(`[ExplosionManager] Animation complete after ${frameCount} frames, cleaning up`);
                    this.scene.onBeforeRenderObservable.remove(animationObserver);
                    this.cleanupExplosion(meshPieces);
                }
            });

            // Log that animation loop is registered
            console.log('[ExplosionManager] Starting animation loop...');
        } catch (error) {
            console.error('[ExplosionManager] ERROR creating MeshExploder:', error);
            // Clean up pieces if exploder failed
            meshPieces.forEach(piece => {
                if (piece && !piece.isDisposed()) {
                    piece.dispose();
                }
            });
        }
    }

    /**
     * Clean up explosion meshes
     */
    private cleanupExplosion(meshPieces: Mesh[]): void {
        console.log('[ExplosionManager] Starting cleanup of explosion meshes...');

        let disposedCount = 0;
        // Dispose all the mesh pieces
        meshPieces.forEach((mesh, index) => {
            if (mesh && !mesh.isDisposed()) {
                try {
                    mesh.dispose();
                    disposedCount++;
                } catch (error) {
                    console.error(`[ExplosionManager] ERROR disposing piece ${index}:`, error);
                }
            }
        });

        console.log(`[ExplosionManager] Cleanup complete - disposed ${disposedCount}/${meshPieces.length} pieces`);
    }

    /**
     * Dispose of the explosion manager
     */
    public dispose(): void {
        // Nothing to dispose with MeshExploder approach
        console.log("ExplosionManager disposed");
    }
}
