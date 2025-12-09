import {
    AbstractMesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "../../core/defaultScene";
import {GameConfig} from "../../core/gameConfig";
import log from "../../core/logger";
import loadAsset from "../../utils/loadAsset";
import {Vector3Array} from "../../levels/config/levelConfig";

interface StarBaseResult {
    baseMesh: AbstractMesh;
    landingMesh: AbstractMesh;
    landingAggregate: PhysicsAggregate | null;
}

interface StarBaseMeshResult {
    baseMesh: AbstractMesh;
    landingMesh: AbstractMesh;
    container: any;
}

/**
 * Create and load the star base mesh
 */
export default class StarBase {
    // Store loaded mesh data for deferred physics
    private static _loadedBase: StarBaseMeshResult | null = null;

    /**
     * Add base to scene (Phase 2 - mesh only, no physics)
     */
    public static async addToScene(
        position?: Vector3Array,
        baseGlbPath: string = 'base.glb',
        hidden: boolean = false,
        rotation?: Vector3Array
    ): Promise<StarBaseMeshResult> {
        const importMeshes = await loadAsset(baseGlbPath, "default", { hidden });

        const baseMesh = importMeshes.meshes.get('Base');
        const landingMesh = importMeshes.meshes.get('BaseLandingZone');

        // Store the GLB path in metadata for serialization
        if (baseMesh) {
            baseMesh.metadata = baseMesh.metadata || {};
            baseMesh.metadata.baseGlbPath = baseGlbPath;
        }

        // Apply position and rotation to root node
        const rootNode = importMeshes.container.rootNodes[0] as TransformNode;
        rootNode.position = position ? new Vector3(position[0], position[1], position[2]) : new Vector3(0, 0, 0);
        if (rotation) {
            rootNode.rotation = new Vector3(rotation[0], rotation[1], rotation[2]);
        }

        this._loadedBase = { baseMesh, landingMesh, container: importMeshes.container };

        // Set rendering group for all base meshes
        for (const mesh of importMeshes.meshes.values()) {
            if (mesh) mesh.renderingGroupId = 2;
        }

        log.debug(`[StarBase] Added to scene (hidden: ${hidden})`);
        return { baseMesh, landingMesh, container: importMeshes.container };
    }

    /**
     * Initialize physics for the base (Phase 3 - after XR)
     */
    public static initializePhysics(): PhysicsAggregate | null {
        if (!this._loadedBase) {
            log.warn('[StarBase] No loaded base to initialize physics for');
            return null;
        }

        const config = GameConfig.getInstance();
        if (!config.physicsEnabled) {
            return null;
        }

        const scene = DefaultScene.MainScene;
        const { baseMesh, landingMesh } = this._loadedBase;

        // Create physics for base
        const baseAgg = new PhysicsAggregate(baseMesh, PhysicsShapeType.MESH, {
            mass: 10000
        }, scene);
        baseAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
        baseAgg.body.getCollisionObservable().add((collidedBody) => {
            log.debug('collidedBody', collidedBody);
        });

        // Create physics for landing zone
        const landingAgg = new PhysicsAggregate(landingMesh, PhysicsShapeType.MESH);
        landingAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
        landingAgg.shape.isTrigger = true;
        landingAgg.body.setCollisionCallbackEnabled(true);

        log.debug('[StarBase] Physics initialized');
        return landingAgg;
    }

    /**
     * Show base meshes
     */
    public static showMeshes(): void {
        if (this._loadedBase) {
            const { baseMesh, landingMesh } = this._loadedBase;
            if (baseMesh) {
                baseMesh.isVisible = true;
                baseMesh.setEnabled(true);
            }
            if (landingMesh) {
                landingMesh.isVisible = true;
                landingMesh.setEnabled(true);
            }
            log.debug('[StarBase] Meshes shown');
        }
    }

    /**
     * Reset static state
     */
    public static reset(): void {
        this._loadedBase = null;
    }

    /**
     * Legacy buildStarBase - for backwards compatibility
     */
    public static async buildStarBase(
        position?: Vector3Array,
        baseGlbPath: string = 'base.glb'
    ): Promise<StarBaseResult> {
        const meshResult = await this.addToScene(position, baseGlbPath, false);
        const landingAggregate = this.initializePhysics();

        return {
            baseMesh: meshResult.baseMesh,
            landingMesh: meshResult.landingMesh,
            landingAggregate
        };
    }
}