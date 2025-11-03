import {
    AbstractMesh, LoadAssetContainerAsync, Mesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, Scene,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {GameConfig} from "./gameConfig";
import debugLog from "./debug";

/**
 * Create and load the star base mesh
 * @param position - Position for the star base
 * @returns Promise resolving to the loaded star base mesh
 */
export default async function buildStarBase(position: Vector3): Promise<AbstractMesh> {
    const scene = DefaultScene.MainScene;

    // Load the base model
    const importMesh = await LoadAssetContainerAsync('/base.glb', DefaultScene.MainScene,
        {
            pluginOptions: {
                gltf: {
                    enabled: true,
                }
            }
        });
    importMesh.addAllToScene();
    const starBase = Mesh.MergeMeshes(importMesh.rootNodes[0].getChildMeshes(false), true, false, null, false, true);
    starBase.id = 'starBase';
    starBase.name = 'starBase';
    DefaultScene.MainScene.addMesh(starBase);
    debugLog('imported base mesh', importMesh.meshes[0]);

    starBase.position = position;
    const config = GameConfig.getInstance();
    if (config.physicsEnabled) {
        const agg = new PhysicsAggregate(starBase, PhysicsShapeType.MESH, {
            mass: 10000
        }, scene);
        agg.body.setMotionType(PhysicsMotionType.ANIMATED);
        agg.body.setCollisionCallbackEnabled(true);
        agg.body.getCollisionObservable().add((collidedBody) => {
            debugLog('collidedBody', collidedBody);
        })
    }
    importMesh.rootNodes[0].dispose();
    return starBase;
}