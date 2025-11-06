import {
    AbstractMesh,
    HavokPlugin,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {GameConfig} from "./gameConfig";
import debugLog from "./debug";
import loadAsset from "./utils/loadAsset";

/**
 * Create and load the star base mesh
 * @param position - Position for the star base
 * @returns Promise resolving to the loaded star base mesh
 */
export default class StarBase {
    public static async buildStarBase(position: Vector3): Promise<AbstractMesh> {
        const config = GameConfig.getInstance();
        const scene = DefaultScene.MainScene;
        const importMeshes = await loadAsset('base.glb');
        const baseMesh = importMeshes.meshes.get('Base');
        const landingMesh = importMeshes.meshes.get('BaseLandingZone');
        clearParent(importMeshes.meshes, position);


        if (config.physicsEnabled) {
            const agg2 = new PhysicsAggregate(baseMesh, PhysicsShapeType.MESH, {
                mass: 10000
            }, scene);
            agg2.body.setMotionType(PhysicsMotionType.ANIMATED);

            agg2.body.getCollisionObservable().add((collidedBody) => {
                debugLog('collidedBody', collidedBody);
            })

            const landingAgg = new PhysicsAggregate(landingMesh, PhysicsShapeType.MESH);
            landingAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
            landingAgg.body.getCollisionObservable().add((collidedCollidedBody) => {
                console.log(collidedCollidedBody);
            });
            landingAgg.shape.isTrigger = true;
            (DefaultScene.MainScene.getPhysicsEngine().getPhysicsPlugin() as HavokPlugin).onTriggerCollisionObservable.add((eventdata, eventState) => {
                console.log(eventState);
                console.log(eventdata);
            })
            landingAgg.body.setCollisionCallbackEnabled(true);
        }
        //importMesh.rootNodes[0].dispose();
        return baseMesh;
    }
}
function clearParent (meshes: Map<string, AbstractMesh>, position?: Vector3) {
    meshes.forEach((mesh) => {
        mesh.setParent(null);
        if (position) {
            mesh.position = position;
        }

        DefaultScene.MainScene.addMesh(mesh);
    })
}
