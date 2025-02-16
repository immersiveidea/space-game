import {
    AbstractMesh, Color3, ISceneLoaderAsyncResult, MeshBuilder, ParticleHelper, ParticleSystem, ParticleSystemSet,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader, StandardMaterial,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
let _particleData: any = null;


export class RockFactory {
    private static _rockMesh: AbstractMesh;
    private static _rockMaterial: StandardMaterial;

    public static async init() {
        if (!this._rockMesh) {
            console.log('loading mesh');
            const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "asteroid.glb", DefaultScene.MainScene);
            this._rockMesh = importMesh.meshes[1].clone("asteroid", null, true);
            this._rockMesh.setParent(null);
            this._rockMesh.setEnabled(false);

            //importMesh.meshes[1].dispose();
            console.log(importMesh.meshes);
            if (!this._rockMaterial) {
                this._rockMaterial = this._rockMesh.material.clone("asteroid") as StandardMaterial;
                this._rockMaterial.name = 'asteroid-material';
                this._rockMaterial.id = 'asteroid-material';
                importMesh.meshes[1].dispose(false, true);
                importMesh.meshes[0].dispose();
            }
        }
    }
    public static async createRock(i: number, position: Vector3, size: Vector3): Promise<AbstractMesh> {
        const explosion = await ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene);

        const rock = this._rockMesh.clone("asteroid-" + i, null, true);

        //rock.material.dispose();
        //rock.material = rockMaterial;
        rock.scaling = size;
        rock.position = position;
        //rock.setParent(null);

        rock.name = "asteroid-" + i;
        rock.id = "asteroid-" + i;
        rock.metadata = {type: 'asteroid'};
        rock.setEnabled(true);
        const agg = new PhysicsAggregate(rock, PhysicsShapeType.CONVEX_HULL, {mass: 10000, restitution: .0001}, DefaultScene.MainScene);
        const body =agg.body;
        body.setLinearDamping(.001);
        //body.setAngularDamping(.00001);
        body.setMotionType(PhysicsMotionType.DYNAMIC);
        body.setCollisionCallbackEnabled(true);
        //rock.renderOutline = true;
        //rock.outlineColor = Color3.Red();
        //rock.outlineWidth = .02;
        //rock.showBoundingBox = true;

        //rock.renderOverlay = true;

        body.getCollisionObservable().add((eventData) => {
            if (eventData.type == 'COLLISION_STARTED') {
                if ( eventData.collidedAgainst.transformNode.id == 'bullet') {
                    const position = eventData.point;
                    // _explosion.emitterNode = position;

                    eventData.collider.shape.dispose();
                    eventData.collider.transformNode.dispose();
                    eventData.collider.dispose();

                    eventData.collidedAgainst.shape.dispose();
                    eventData.collidedAgainst.transformNode.dispose();
                    eventData.collidedAgainst.dispose();

                    const ball = MeshBuilder.CreateBox("ball", {size: .01}, DefaultScene.MainScene);

                    ball.scaling = new Vector3(.1, .1, .1);
                    ball.position = position;
                    const material = new StandardMaterial("ball-material", DefaultScene.MainScene);
                    material.emissiveColor = Color3.Yellow();
                    ball.material = material;

                    explosion.start(ball);

                    setTimeout(() => {
                        explosion.systems.forEach((system: ParticleSystem) => {
                            system.stop();
                            system.dispose(true, true, true);
                        });
                        explosion.dispose();
                        if (ball && !ball.isDisposed()) {
                            ball.dispose(false, true);
                        }
                        //ball.dispose();
                    }, 2000);
                }
            }
        });
        //body.setAngularVelocity(new Vector3(Math.random(), Math.random(), Math.random()));
        // body.setLinearVelocity(Vector3.Random(-10, 10));
        return rock;
    }
}

