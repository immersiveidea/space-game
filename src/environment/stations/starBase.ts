import {
    AbstractMesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "../../core/defaultScene";
import {GameConfig} from "../../core/gameConfig";
import debugLog from "../../core/debug";
import loadAsset from "../../utils/loadAsset";
import {Vector3Array} from "../../levels/config/levelConfig";

export interface StarBaseResult {
    baseMesh: AbstractMesh;
    landingAggregate: PhysicsAggregate | null;
}

/**
 * Create and load the star base mesh
 * @param position - Position for the star base (defaults to [0, 0, 0])
 * @param baseGlbPath - Path to the base GLB file (defaults to 'base.glb')
 * @returns Promise resolving to the loaded star base mesh and landing aggregate
 */
export default class StarBase {
    public static async buildStarBase(position?: Vector3Array, baseGlbPath: string = 'base.glb'): Promise<StarBaseResult> {
        const config = GameConfig.getInstance();
        const scene = DefaultScene.MainScene;
        const importMeshes = await loadAsset(baseGlbPath);

        const baseMesh = importMeshes.meshes.get('Base');
        const landingMesh = importMeshes.meshes.get('BaseLandingZone');

        // Store the GLB path in metadata for serialization
        if (baseMesh) {
            baseMesh.metadata = baseMesh.metadata || {};
            baseMesh.metadata.baseGlbPath = baseGlbPath;
        }

        // Apply position to both meshes (defaults to [0, 0, 0])
        (importMeshes.container.rootNodes[0] as TransformNode).position
            =  position ? new Vector3(position[0], position[1], position[2]) : new Vector3(0, 0, 0);

        let landingAgg: PhysicsAggregate | null = null;

        if (config.physicsEnabled) {
            const agg2 = new PhysicsAggregate(baseMesh, PhysicsShapeType.MESH, {
                mass: 10000
            }, scene);
            agg2.body.setMotionType(PhysicsMotionType.ANIMATED);

            agg2.body.getCollisionObservable().add((collidedBody) => {
                debugLog('collidedBody', collidedBody);
            })

            landingAgg = new PhysicsAggregate(landingMesh, PhysicsShapeType.MESH);
            landingAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
            landingAgg.shape.isTrigger = true;
            landingAgg.body.setCollisionCallbackEnabled(true);
        }
        //importMesh.rootNodes[0].dispose();
        return {
            baseMesh,
            landingAggregate: landingAgg
        };
    }
}