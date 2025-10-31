import {
    AbstractMesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {GameConfig} from "./gameConfig";
import {debug} from "openai/core";
import debugLog from "./debug";

/**
 * Create and load the star base mesh
 * @param position - Position for the star base
 * @returns Promise resolving to the loaded star base mesh
 */
export default async function buildStarBase(position: Vector3): Promise<AbstractMesh> {
    const scene = DefaultScene.MainScene;

    // Load the base model
    const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "base.glb", scene);
    const baseMesh = importMesh.meshes[0].getChildMeshes()[0];
    debugLog('Star base mesh loaded:', baseMesh);
    baseMesh.id = "starBase";
    baseMesh.name = "starBase";
    baseMesh.position = position;
    debugLog('Ship Bounds radius', baseMesh.getBoundingInfo().boundingSphere.radiusWorld);
    // Create physics if enabled
    const config = GameConfig.getInstance();
    if (config.physicsEnabled) {
        const agg = new PhysicsAggregate(baseMesh, PhysicsShapeType.MESH, {
            mass: 0
        }, scene);
        agg.body.setMotionType(PhysicsMotionType.STATIC);
    }

    return baseMesh;
}