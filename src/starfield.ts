import {
    AbstractMesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";

export async function createRock(i: number, position: Vector3, size: Vector3): Promise<AbstractMesh> {
    const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "asteroid.glb", DefaultScene.MainScene);
    const rock = importMesh.meshes[1];

    rock.scaling = size;
    rock.position = position;
    rock.setParent(null);
    importMesh.meshes[0].dispose();
    rock.name = "asteroid-" + i;
    rock.id = "asteroid-" + i;
    const agg = new PhysicsAggregate(rock, PhysicsShapeType.CONVEX_HULL, {mass: 10000}, DefaultScene.MainScene);
    const body =agg.body;
    body.setLinearDamping(.001);
    body.setAngularDamping(.00001);
    body.setMotionType(PhysicsMotionType.DYNAMIC);
    body.setCollisionCallbackEnabled(true);
    //body.setAngularVelocity(new Vector3(Math.random(), Math.random(), Math.random()));
   // body.setLinearVelocity(Vector3.Random(-10, 10));
    return rock;
}
