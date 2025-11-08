import { AbstractMesh, InstancedMesh, Mesh, Scene } from "@babylonjs/core";
import loadAsset from "../utils/loadAsset";
import debugLog from "../debug";

/**
 * Registry for loading and caching assets used in replay
 * Maps object IDs to appropriate mesh templates and creates instances
 */
export class ReplayAssetRegistry {
    private _assetCache: Map<string, AbstractMesh> = new Map();
    private _scene: Scene;
    private _initialized: boolean = false;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    /**
     * Pre-load all assets that might be needed for replay
     */
    public async initialize(): Promise<void> {
        if (this._initialized) {
            return;
        }

        debugLog("ReplayAssetRegistry: Loading replay assets...");

        try {
            // Load ship mesh
            await this.loadShipMesh();

            // Load asteroid meshes
            await this.loadAsteroidMesh();

            // Load base mesh
            await this.loadBaseMesh();

            this._initialized = true;
            debugLog("ReplayAssetRegistry: All assets loaded");
        } catch (error) {
            debugLog("ReplayAssetRegistry: Error loading assets", error);
            throw error;
        }
    }

    /**
     * Load ship mesh template
     */
    private async loadShipMesh(): Promise<void> {
        const data = await loadAsset("ship.glb");
        const shipMesh = data.container.transformNodes[0];
        shipMesh.setEnabled(false); // Keep as template
        this._assetCache.set("ship-template", shipMesh as AbstractMesh);
        debugLog("ReplayAssetRegistry: Ship mesh loaded");
    }

    /**
     * Load asteroid mesh template
     */
    private async loadAsteroidMesh(): Promise<void> {
        const data = await loadAsset("asteroid4.glb");
        const asteroidMesh = data.container.meshes[0];
        asteroidMesh.setEnabled(false); // Keep as template
        this._assetCache.set("asteroid-template", asteroidMesh);
        debugLog("ReplayAssetRegistry: Asteroid mesh loaded");
    }

    /**
     * Load base mesh template
     */
    private async loadBaseMesh(): Promise<void> {
        const data = await loadAsset("base.glb");
        const baseMesh = data.container.transformNodes[0];
        baseMesh.setEnabled(false); // Keep as template
        this._assetCache.set("base-template", baseMesh as AbstractMesh);
        debugLog("ReplayAssetRegistry: Base mesh loaded");
    }

    /**
     * Create a replay mesh from object ID
     * Uses instancedMesh for asteroids, clones for unique objects
     */
    public createReplayMesh(objectId: string): AbstractMesh | null {
        if (!this._initialized) {
            debugLog("ReplayAssetRegistry: Not initialized, cannot create mesh for", objectId);
            return null;
        }

        // Determine mesh type from object ID
        if (objectId.startsWith("asteroid-") || objectId.startsWith("rock-")) {
            // Create instance of asteroid template
            const template = this._assetCache.get("asteroid-template");
            if (template) {
                const instance = new InstancedMesh(objectId, template as Mesh);
                instance.setEnabled(true);
                return instance;
            }
        } else if (objectId === "ship" || objectId.startsWith("shipBase")) {
            // Clone ship (needs independent properties)
            const template = this._assetCache.get("ship-template");
            if (template) {
                const clone = template.clone(objectId, null, true);
                if (clone) {
                    clone.setEnabled(true);
                    return clone;
                }
            }
        } else if (objectId.startsWith("base") || objectId.startsWith("starBase")) {
            // Clone base
            const template = this._assetCache.get("base-template");
            if (template) {
                const clone = template.clone(objectId, null, true);
                if (clone) {
                    clone.setEnabled(true);
                    return clone;
                }
            }
        } else if (objectId.startsWith("ammo")) {
            // Skip projectiles - they're small and numerous
            return null;
        }

        debugLog(`ReplayAssetRegistry: Unknown object type for ID: ${objectId}`);
        return null;
    }

    /**
     * Get statistics about loaded assets
     */
    public getStats(): {
        initialized: boolean;
        templateCount: number;
        templates: string[];
    } {
        return {
            initialized: this._initialized,
            templateCount: this._assetCache.size,
            templates: Array.from(this._assetCache.keys())
        };
    }

    /**
     * Dispose of all cached assets
     */
    public dispose(): void {
        debugLog("ReplayAssetRegistry: Disposing assets");
        this._assetCache.forEach((mesh, key) => {
            mesh.dispose();
        });
        this._assetCache.clear();
        this._initialized = false;
    }
}
