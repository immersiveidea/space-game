import {DefaultScene} from "./defaultScene";
import {
    Color3,
    HavokPlugin,
    MeshBuilder, Observable, ParticleHelper, ParticleSystem, ParticleSystemSet,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    StandardMaterial, Texture,
    Vector3
} from "@babylonjs/core";
import {Ship} from "./ship";
import {ScoreEvent} from "./scoreEvent";
import {createRock} from "./starfield";

export class Level1 {
    private _ship: Ship;
    private _explosion: ParticleSystemSet

    public onScoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();
    constructor(ship: Ship) {
        this._ship = ship;
        this.initialize();
    }
    private scored: Set<string> = new Set<string>();
    private async initialize() {
        const phys = DefaultScene.MainScene.getPhysicsEngine().getPhysicsPlugin() as HavokPlugin;
        ParticleHelper.BaseAssetsUrl = window.location.href;

        //console.log(window.location.href);
        DefaultScene.MainScene.onReadyObservable.addOnce(async () => {
            this._explosion = await ParticleHelper.CreateAsync("explosion", DefaultScene.MainScene);
        });
        //
        /*phys.onTriggerCollisionObservable.add((eventData) => {
            if (eventData.collider.transformNode.id.indexOf('star') > -1) {
                return;
            }
            if (this.scored.has(eventData.collidedAgainst.transformNode.id)) {
                return;
            } else {
                this.scored.add(eventData.collidedAgainst.transformNode.id);
                //this.onScoreObservable.notifyObservers(1);
            }

        });
        */
        phys.onCollisionObservable.add( (eventData) => {
           this.onScoreObservable.notifyObservers({score: 0, message: eventData?.impulse?.toFixed(2)});
           if ((eventData.collidedAgainst.transformNode.id == 'bullet' ||
            eventData.collider.transformNode.id == 'bullet') &&
               (eventData.collidedAgainst.transformNode.id.indexOf('asteroid') > -1 ||
                   eventData.collider.transformNode.id.indexOf('asteroid') > -1)
           ){
               const point = eventData.point.clone();
               if (this._explosion) {
                   /*this._explosion.systems.forEach((system) => {
                       system.stop();
                   });*/
                   this._explosion.emitterNode = point;
                   this._explosion.start();
               }

               eventData.collider.transformNode.dispose();
               eventData.collidedAgainst.transformNode.dispose()

               eventData.collider.dispose();
               eventData.collidedAgainst.dispose();


               /*const myParticleSystem = new ParticleSystem("particles", 1000, DefaultScene.MainScene);
               myParticleSystem.emitter = point;
               myParticleSystem.emitRate = 100;
               myParticleSystem.minEmitPower = 2;
               myParticleSystem.maxEmitPower = 200;
               const sphereEmitter = myParticleSystem.createSphereEmitter(10);

               myParticleSystem.particleTexture = new Texture("./flare.png");
                myParticleSystem.maxLifeTime = 10000;

               //const coneEmitter = myParticleSystem.createConeEmitter(0.1, Math.PI / 9);
               myParticleSystem.addSizeGradient(0, 2);
               myParticleSystem.addSizeGradient(1, 4);
               //myParticleSystem.isLocal = true;

               myParticleSystem.start(); //S
               console.log(eventData);*/
           }

        });
        this._ship.onReadyObservable.add(() => {
           this._ship.position = new Vector3(0, 1, 0);
           this.createStartBase();
           this.createEndBase();

           createRock(1, new Vector3(0,0, 70), new Vector3(10,10,10));
            createRock(1, new Vector3(0,0, 100), new Vector3(10,10,10));
            createRock(1, new Vector3(0,0, 130), new Vector3(10,10,10));
            for (let i = 0; i < 100; i++) {
                createRock(i , Vector3.Random(-200, 200), Vector3.Random(5,20))
                    .then((rock) => {
                        rock.physicsBody.setAngularVelocity(Vector3.Random(-1, 1));
                    });

            }

        });
    }
    private createStartBase() {
        const mesh =  MeshBuilder.CreateCylinder("startBase", {diameter: 10, height: 1, tessellation: 72}, DefaultScene.MainScene);
        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(1, 1, 0);
        mesh.material = material;
        const agg = new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.ANIMATED);

    }
    private createEndBase() {
        const mesh =  MeshBuilder.CreateCylinder("endBase", {diameter: 10, height: 1, tessellation: 72}, DefaultScene.MainScene);
        mesh.position = new Vector3(0, 5, 200);
        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(0, 1, 0);
        mesh.material = material;
        const agg = new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.ANIMATED);
        /*agg.body.setCollisionCallbackEnabled(true);
        const collider = agg.body.getCollisionObservable().add((eventData) => {
            if (eventData.collidedAgainst.transformNode.id == 'ship') {
                console.log(eventData);
                this.onScoreObservable.notifyObservers({score: 0,
                    message: eventData?.impulse?.toFixed(2)})

            }
        }); */

    }
    private createTarget(i: number) {
        const target = MeshBuilder.CreateTorus("target" + i, {diameter: 10, tessellation: 72}, DefaultScene.MainScene);

        const targetLOD = MeshBuilder.CreateTorus("target" + i, {diameter: 50, tessellation: 10}, DefaultScene.MainScene);
        targetLOD.parent = target;
        target.addLODLevel(300, targetLOD);

        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.diffuseColor = new Color3(1, 0, 0);
        material.alpha = .9;
        target.material = material;
        target.position = Vector3.Random(-1000, 1000);
        target.rotation = Vector3.Random(0, Math.PI*2);
        const disc = MeshBuilder.CreateDisc("disc-"+i, {radius: 2, tessellation: 72}, DefaultScene.MainScene);
        const discMaterial = new StandardMaterial("material", DefaultScene.MainScene);
        discMaterial.ambientColor = new Color3(.1, 1, .1);
        discMaterial.alpha = .2;
        target.addLODLevel(200, null);
        disc.material = discMaterial;
        disc.parent = target;
        disc.rotation.x = -Math.PI/2;
        const agg = new PhysicsAggregate(disc, PhysicsShapeType.MESH, {mass: 0}, DefaultScene.MainScene);
        agg.body.setMotionType(PhysicsMotionType.STATIC);
        agg.shape.isTrigger = true;
        //agg.shape.filterCollideMask = 2;
        //agg.body.dispose();

        //const body = new PhysicsShapeMesh(disc, DefaultScene.MainScene);

        //agg.body.setCollisionCallbackEnabled(true);
        /*agg.body.getCollisionObservable().add((eventData) => {
            target.dispose(false, false);
            agg.dispose();
        });*/
    }
}