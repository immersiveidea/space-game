import {
    AbstractMesh, AudioEngineV2, Color3, InstancedMesh,
    Mesh, MeshBuilder,
    MeshExploder,
    Scene, SoundState, StandardMaterial, StaticSound,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "../../core/defaultScene";
import debugLog from '../../core/debug';

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
    private _debrisBaseMesh: Mesh;
    private audioEngine: AudioEngineV2 | null = null;
    private explosionSounds: StaticSound[] = [];
    private soundPoolSize: number = 5;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<ExplosionConfig> = {
        duration: 1000,
        explosionForce: 5,
        frameRate: 60
    };

    constructor(scene: Scene, config?: ExplosionConfig) {
        this.scene = scene;
        this.config = { ...ExplosionManager.DEFAULT_CONFIG, ...config };
        this._debrisBaseMesh = MeshBuilder.CreateIcoSphere(
            'debrisBase',
            {
                radius: .2,
                subdivisions:  2
            }, DefaultScene.MainScene
        );
        const debrisMaterial = new StandardMaterial('debrisMaterial', DefaultScene.MainScene);
        debrisMaterial.emissiveColor = new Color3(1,1,0);
        this._debrisBaseMesh.material = debrisMaterial;
        this._debrisBaseMesh.setEnabled(false);
    }

    /**
     * Initialize the explosion manager (no longer needed for MeshExploder, but kept for API compatibility)
     */
    public async initialize(): Promise<void> {
        debugLog("ExplosionManager initialized with MeshExploder");
    }

    /**
     * Initialize audio for explosions (called after audio engine is unlocked)
     */
    public async initAudio(audioEngine: AudioEngineV2): Promise<void> {
        this.audioEngine = audioEngine;

        debugLog(`ExplosionManager: Initializing audio with pool size ${this.soundPoolSize}`);

        // Create sound pool for concurrent explosions
        for (let i = 0; i < this.soundPoolSize; i++) {
            const sound = await audioEngine.createSoundAsync(
                `explosionSound_${i}`,
                "/assets/themes/default/audio/explosion.mp3",
                {
                    loop: false,
                    volume: 1.0,
                    spatialEnabled: true,
                    spatialDistanceModel: "linear",
                    spatialMaxDistance: 500,
                    spatialMinUpdateTime: 0.5,
                    spatialRolloffFactor: 1
                }
            );
            this.explosionSounds.push(sound);
        }

        debugLog(`ExplosionManager: Loaded ${this.explosionSounds.length} explosion sounds`);
    }

    /**
     * Get an available sound from the pool
     */
    private getAvailableSound(): StaticSound | null {
        // Find a sound that's not currently playing
        for (const sound of this.explosionSounds) {
            if (sound.state !== SoundState.Started && sound.state !== SoundState.Starting) {
                return sound;
            }
        }

        // If all sounds are playing, reuse the first one (will cut off the oldest)
        debugLog("ExplosionManager: All sounds in pool are playing, reusing sound 0");
        return this.explosionSounds[0] || null;
    }

    /**
     * Play explosion audio at a specific position
     */
    private playExplosionAudio(position: Vector3): void {
        if (!this.audioEngine) {
            // Audio not initialized, skip silently
            return;
        }

        const sound = this.getAvailableSound();
        if (!sound) {
            debugLog("ExplosionManager: No sound available in pool");
            return;
        }

        // Create lightweight TransformNode for spatial audio positioning
        const explosionNode = new TransformNode(`explosionAudio_${Date.now()}`, this.scene);
        explosionNode.position = position.clone();

        try {
            // Attach spatial sound to the node
            sound.spatial.attach(explosionNode);
            sound.play();

            // Cleanup after explosion duration (synchronized with visual effect)
            setTimeout(() => {
                if (sound.spatial) {
                    sound.spatial.detach();
                }
                explosionNode.dispose();
            }, this.config.duration);
        } catch (error) {
            debugLog("ExplosionManager: Error playing explosion audio", error);
            explosionNode.dispose();
        }
    }

    /**
     * Create sphere debris pieces for explosion
     * MeshExploder requires an array of separate meshes
     * @param mesh The mesh to explode (used for position/scale)
     * @param pieces Number of pieces to create
     * @returns Array of sphere mesh objects
     */
    private splitIntoSeparateMeshes(position: Vector3, pieces: number = 32): InstancedMesh[] {
        debugLog(`[ExplosionManager] Creating ${pieces} sphere debris pieces`);

        const meshPieces: InstancedMesh[] = [];

        // Create material for debris


        for (let i = 0; i < pieces; i++) {
            try {
                // Create a small sphere for debris
                const sphere = new InstancedMesh(
                    `debris_${i}`,
                    this._debrisBaseMesh);


                // Position spheres in a small cluster around the original position
                const offsetRadius = 1;
                const angle1 = (i / pieces) * Math.PI * 2;
                const angle2 = Math.random() * Math.PI;

                sphere.position = new Vector3(
                    position.x + Math.sin(angle2) * Math.cos(angle1) * offsetRadius,
                    position.y + Math.sin(angle2) * Math.sin(angle1) * offsetRadius,
                    position.z + Math.cos(angle2) * offsetRadius
                );

                sphere.isVisible = true;
                sphere.setEnabled(true);
                meshPieces.push(sphere);
            } catch (error) {
                console.error(`[ExplosionManager] ERROR creating debris piece ${i}:`, error);
            }
        }

        debugLog(`[ExplosionManager] Successfully created ${meshPieces.length}/${pieces} sphere debris pieces`);
        if (meshPieces.length > 0) {
            debugLog('[ExplosionManager] First piece sample:', {
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
        debugLog('[ExplosionManager] playExplosion called');
        debugLog('[ExplosionManager] Input mesh:', {
            name: mesh.name,
            id: mesh.id,
            isInstancedMesh: !!(mesh as any).sourceMesh,
            position: mesh.position.toString(),
            scaling: mesh.scaling.toString()
        });

        // Play explosion audio at the mesh's position
        const explosionPosition = mesh.getAbsolutePosition();
        this.playExplosionAudio(explosionPosition);

        // Get the source mesh if this is an instanced mesh
        let sourceMesh: Mesh;
        if ((mesh as any).sourceMesh) {
            sourceMesh = (mesh as any).sourceMesh as Mesh;
            debugLog('[ExplosionManager] Using source mesh from instance:', sourceMesh.name);
        } else {
            sourceMesh = mesh as Mesh;
            debugLog('[ExplosionManager] Using mesh directly (not instanced)');
        }

        // Clone the source mesh so we don't affect the original
        debugLog('[ExplosionManager] Cloning mesh...');
        mesh.computeWorldMatrix(true);
        // Apply the instance's transformation to the cloned mesh
        const position = mesh.getAbsolutePosition().clone();

        // Force world matrix computation


        // Check if mesh has proper geometry
        if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) {
            console.error('[ExplosionManager] ERROR: Mesh has no vertices, cannot explode');
            mesh.dispose();
            return;
        }

        // Split the mesh into separate mesh objects (MeshExploder requirement)
        debugLog('[ExplosionManager] Splitting mesh into pieces...');
        const meshPieces = this.splitIntoSeparateMeshes(position, 12);

        if (meshPieces.length === 0) {
            console.error('[ExplosionManager] ERROR: Failed to split mesh into pieces');
            mesh.dispose();
            return;
        }

        // Original mesh is no longer needed - the pieces replace it
        debugLog('[ExplosionManager] Disposing original cloned mesh');
        mesh.dispose();

        // Create the exploder with the array of separate meshes
        // The second parameter is optional - it's the center mesh to explode from
        // If not provided, MeshExploder will auto-calculate the center
        debugLog('[ExplosionManager] Creating MeshExploder...');
        try {
            const exploder = new MeshExploder((meshPieces as unknown) as Mesh[]);
            debugLog('[ExplosionManager] MeshExploder created successfully');

            debugLog(`[ExplosionManager] Starting explosion animation:`, {
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
                    debugLog(`[ExplosionManager] Animation frame ${frameCount}:`, {
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
                    debugLog(`[ExplosionManager] Animation complete after ${frameCount} frames, cleaning up`);
                    this.scene.onBeforeRenderObservable.remove(animationObserver);
                    this.cleanupExplosion(meshPieces);
                }
            });

            // Log that animation loop is registered
            debugLog('[ExplosionManager] Starting animation loop...');
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
    private cleanupExplosion(meshPieces: InstancedMesh[]): void {
        debugLog('[ExplosionManager] Starting cleanup of explosion meshes...');

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

        debugLog(`[ExplosionManager] Cleanup complete - disposed ${disposedCount}/${meshPieces.length} pieces`);
    }

    /**
     * Dispose of the explosion manager
     */
    public dispose(): void {
        this._debrisBaseMesh.dispose(false, true);
        // Nothing to dispose with MeshExploder approach
        debugLog("ExplosionManager disposed");
    }
}
