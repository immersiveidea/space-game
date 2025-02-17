import {
    AbstractMesh,
    Color3,
    DirectionalLight,
    Engine,
    FreeCamera,
    GlowLayer,
    MeshBuilder,
    Observable,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Sound,
    SpotLight,
    StandardMaterial,
    TransformNode,
    Vector2,
    Vector3,
    WebXRAbstractMotionController,
    WebXRControllerComponent,
    WebXRInputSource
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";

import {ShipEngine} from "./shipEngine";
import {Level1} from "./level1";

const controllerComponents = [
    'a-button',
    'b-button',
    'x-button',
    'y-button',
    'thumbrest',
    'xr-standard-squeeze',
    'xr-standard-thumbstick',
    'xr-standard-trigger',
]
type ControllerEvent = {
    hand: 'right' | 'left' | 'none',
    type: 'thumbstick' | 'button',
    controller: WebXRAbstractMotionController,
    component: WebXRControllerComponent,
    value: number,
    axisData: { x: number, y: number },
    pressed: boolean,
    touched: boolean

}

enum ControllerStickMode {
    ARCADE,
    REALISTIC
}

export class Ship {
    private _ship: TransformNode;
    private _controllerObservable: Observable<ControllerEvent> = new Observable<ControllerEvent>();
    public onReadyObservable: Observable<unknown> = new Observable<unknown>();
    private _engine: ShipEngine;
    private _ammoMaterial: StandardMaterial;
    private _forwardNode: TransformNode;
    private _rotationNode: TransformNode;
    private _onscore: Observable<number>;
    private _ammo: Array<AbstractMesh> = [];
    private _glowLayer: GlowLayer;
    private _thrust: Sound;
    private _thrust2: Sound;
    private _shot: Sound;
    private _shooting: boolean = false;
    private _camera: FreeCamera;

    constructor() {

        this.setup();
        this.initialize();
    }

    private shoot() {
        this._shot.play();
        const ammo = MeshBuilder.CreateCapsule("bullet", {radius: .1, height: 2.5}, DefaultScene.MainScene);
        ammo.parent = this._ship
        ammo.position.y = 2;
        ammo.rotation.x = Math.PI / 2;
        ammo.setParent(null);
        const ammoAggregate = new PhysicsAggregate(ammo, PhysicsShapeType.CONVEX_HULL, {
            mass: 1000,
            restitution: 0
        }, DefaultScene.MainScene);


        ammo.material = this._ammoMaterial;
        ammoAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

        ammoAggregate.body.setLinearVelocity(this._ship.forward.scale(200).add(this._ship.physicsBody.getLinearVelocity()));

        window.setTimeout(() => {
            ammoAggregate.dispose();
            ammo.dispose()
        }, 1500)
    }

    public set position(newPosition: Vector3) {
        const body = this._ship.physicsBody;
        body.disablePreStep = false;
        body.transformNode.position.copyFrom(newPosition);
        DefaultScene.MainScene.onAfterRenderObservable.addOnce(() => {
            body.disablePreStep = true;
        })

    }
    private setup() {
        this._ship = new TransformNode("ship", DefaultScene.MainScene);
        this._glowLayer = new GlowLayer('bullets', DefaultScene.MainScene);
        this._glowLayer.intensity = 1;
        this._thrust = new Sound("thrust", "/thrust5.mp3", DefaultScene.MainScene, null, {
            loop: true,
            autoplay: false
        });
        this._thrust2 = new Sound("thrust2", "/thrust5.mp3", DefaultScene.MainScene, null, {
            loop: true,
            autoplay: false,
            volume: .5
        });
        this._shot = new Sound("shot", "/shot.mp3", DefaultScene.MainScene, null,
            {loop: false, autoplay: false, volume: .5});
        this._ammoMaterial = new StandardMaterial("ammoMaterial", DefaultScene.MainScene);
        this._ammoMaterial.emissiveColor = new Color3(1, 1, 0);
        const light = new DirectionalLight("light", new Vector3(.1, -1, 0), DefaultScene.MainScene);

        const landingLight = new SpotLight("landingLight", new Vector3(0, 0, 0), new Vector3(0, -.5, .5), 1.5, .5, DefaultScene.MainScene);
        landingLight.parent = this._ship;
        landingLight.position.z = 5;
        const agg = new PhysicsAggregate(this._ship, PhysicsShapeType.BOX, {
            mass: 100,
            extents: new Vector3(4, 4, 7.4),
            center: new Vector3(0, 1, 1.8)
        }, DefaultScene.MainScene);

        agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
        agg.body.setLinearDamping(.1);
        agg.body.setAngularDamping(.2);
        agg.body.setAngularVelocity(new Vector3(0, 0, 0));
        agg.body.setCollisionCallbackEnabled(true);
        this.setupKeyboard();
        this.setupMouse();
        this._controllerObservable.add(this.controllerCallback);
        this._forwardNode = new TransformNode("forward", DefaultScene.MainScene);
        this._rotationNode = new TransformNode("rotation", DefaultScene.MainScene);
        this._forwardNode.parent = this._ship;
        this._rotationNode.parent = this._ship;
        this._camera = new FreeCamera("Flat Camera",
            new Vector3(0, .5, 0),
            DefaultScene.MainScene);
        this._camera.parent = this._ship;

        DefaultScene.MainScene.setActiveCameraByName("Flat Camera");

        //const sightPos = this._forwardNode.position.scale(30);
        const sight = MeshBuilder.CreateSphere("sight", {diameter: 1}, DefaultScene.MainScene);
        sight.parent = this._ship
        const signtMaterial = new StandardMaterial("sightMaterial", DefaultScene.MainScene);
        signtMaterial.emissiveColor = Color3.Yellow();
        sight.material = signtMaterial;
        sight.position = new Vector3(0, 2, 125);

        window.setInterval(() => {
            this.applyForce();
        }, 50);
    }
    private async initialize() {
        const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "cockpit3.glb", DefaultScene.MainScene);
        const shipMesh = importMesh.meshes[0];
        shipMesh.id = "shipMesh";
        shipMesh.name = "shipMesh";
        shipMesh.parent = this._ship;
        shipMesh.rotation.y = Math.PI;
        shipMesh.position.y = 1;
        shipMesh.position.z = -1;
        DefaultScene.MainScene.getMaterialById('glass_mat.002').alpha = .7;
    }


    private _leftStickVector = Vector2.Zero().clone();
    private _rightStickVector = Vector2.Zero().clone();
    private _forwardValue = 0;
    private _yawValue = 0;
    private _rollValue = 0;
    private _pitchValue = 0;
    private _mouseDown = false;
    private _mousePos = new Vector2(0, 0);

    private scale(value: number) {
        return value * .8;
    }


    public get transformNode() {
        return this._ship;
    }

    private adjust(value: number, increment: number = .8): number {
        if (Math.abs(value) < .001) {
            return 0;
        } else {
            return value * increment;
        }
    }

    private applyForce() {
        if (!this?._ship?.physicsBody) {
            return;
        }
        const body = this._ship.physicsBody;
        if (Math.abs(this._forwardValue) > 40) {
            this._forwardValue = Math.sign(this._forwardValue) * 40;
        }

        if (Math.abs(this._forwardValue) <= 40) {
            if (Math.abs(this._leftStickVector.y) > .1) {
                if (!this._thrust.isPlaying) {
                    this._thrust.play();
                }
                this._thrust.setVolume(Math.abs(this._leftStickVector.y));
                this._forwardValue += this._leftStickVector.y * .8;
            } else {
                if (this._thrust.isPlaying) {
                    this._thrust.pause();
                }
                this._forwardValue = this.adjust(this._forwardValue, .98);
            }
        }

        if (Math.abs(this._leftStickVector.x) > .1) {
            this._yawValue += this._leftStickVector.x * .03;
        } else {

            this._yawValue = this.adjust(this._yawValue);
        }

        if (Math.abs(this._rightStickVector.x) > .1) {
            this._rollValue += this._rightStickVector.x * .03;
        } else {
            this._rollValue = this.adjust(this._rollValue);
        }

        if (Math.abs(this._rightStickVector.y) > .1) {
            this._pitchValue += this._rightStickVector.y * .03;
        } else {
            this._pitchValue = this.adjust(this._pitchValue);
        }

        this._forwardNode.position.z = this._forwardValue;
        this._rotationNode.position.y = this._yawValue;
        this._rotationNode.position.z = -this._rollValue;
        this._rotationNode.position.x = -this._pitchValue;

        const thrust2 = Math.abs(this._rightStickVector.y) +
            Math.abs(this._rightStickVector.x) +
            Math.abs(this._leftStickVector.x);

        if (thrust2 > .01) {
            if (!this._thrust2.isPlaying) {
                this._thrust2.play();
            }
            this._thrust2.setVolume(thrust2 * .4);
        } else {
            if (this._thrust2.isPlaying) {
                this._thrust2.pause();
            }

        }

        body.setAngularVelocity(this._rotationNode.absolutePosition.subtract(this._ship.absolutePosition));
        body.setLinearVelocity(this._forwardNode.absolutePosition.subtract(this._ship.absolutePosition).scale(-1));
        //this._engine.forwardback(this._forwardValue);
    }

    private controllerCallback = (controllerEvent: ControllerEvent) => {
        if (controllerEvent.type == 'thumbstick') {
            if (controllerEvent.hand == 'left') {
                this._leftStickVector.x = controllerEvent.axisData.x;
                this._leftStickVector.y = controllerEvent.axisData.y;
            }

            if (controllerEvent.hand == 'right') {
                this._rightStickVector.x = controllerEvent.axisData.x;
                this._rightStickVector.y = controllerEvent.axisData.y;

            }
            this.applyForce();
        }
        if (controllerEvent.type == 'button') {
            if (controllerEvent.component.type == 'trigger') {
                if (controllerEvent.value > .9 && !this._shooting) {
                    this._shooting = true;
                    this.shoot();
                }
                if (controllerEvent.value < .1) {
                    this._shooting = false;
                }
            }
        }
    }

    private setupMouse() {
        this._ship.getScene().onPointerDown = (evt) => {
            this._mousePos.x = evt.x;
            this._mousePos.y = evt.y;
            this._mouseDown = true;

        }
        this._ship.getScene().onPointerUp = () => {
            this._mouseDown = false;
        }
        this._ship.getScene().onPointerMove = () => {

        };
        this._ship.getScene().onPointerMove = (ev) => {
            if (!this._mouseDown) {
                return
            }
            ;
            const xInc = this._rightStickVector.x = (ev.x - this._mousePos.x) / 100;
            const yInc = this._rightStickVector.y = (ev.y - this._mousePos.y) / 100;
            if (Math.abs(xInc) <= 1) {
                this._rightStickVector.x = xInc;
            } else {
                this._rightStickVector.x = Math.sign(xInc);
            }
            if (Math.abs(yInc) <= 1) {
                this._rightStickVector.y = yInc;
            } else {
                this._rightStickVector.y = Math.sign(yInc);
            }

        };
    }

    private setupKeyboard() {
        document.onkeyup = () => {
            this._leftStickVector.y = 0;
            this._leftStickVector.x = 0;
            this._rightStickVector.y = 0;
            this._rightStickVector.x = 0;
        }
        document.onkeydown = (ev) => {
            switch (ev.key) {
                case '1':
                    this._camera.position.x = 15;
                    this._camera.rotation.y = -Math.PI / 2;
                    console.log(1);
                    break;
                case ' ':
                    this.shoot();
                    break;
                case 'e':
                    break;
                case 'w':
                    this._leftStickVector.y = -1;
                    break;
                case 's':
                    this._leftStickVector.y = 1;
                    break;
                case 'a':
                    this._leftStickVector.x = -1;
                    break;
                case 'd':
                    this._leftStickVector.x = 1;
                    break;
                case 'ArrowUp':
                    this._rightStickVector.y = -1;
                    break;
                case 'ArrowDown':
                    this._rightStickVector.y = 1;
                    break;

            }
        };
    }

    private _leftInputSource: WebXRInputSource;
    private _rightInputSource: WebXRInputSource;

    public addController(controller: WebXRInputSource) {
        if (controller.inputSource.handedness == "left") {
            this._leftInputSource = controller;
            this._leftInputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log(motionController);
                this.mapMotionController(motionController);
            });
        }
        if (controller.inputSource.handedness == "right") {
            this._rightInputSource = controller;
            this._rightInputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log(motionController);
                this.mapMotionController(motionController);
            });
        }
    }

    private mapMotionController(controller: WebXRAbstractMotionController) {
        controllerComponents.forEach((component) => {
            const comp = controller.components[component];
            const observable = this._controllerObservable;

            if (comp && comp.onAxisValueChangedObservable) {
                comp.onAxisValueChangedObservable.add((axisData) => {
                    observable.notifyObservers({
                        controller: controller,
                        hand: controller.handness,
                        type: 'thumbstick',
                        component: comp,
                        value: comp.value,
                        axisData: {x: axisData.x, y: axisData.y},
                        pressed: comp.pressed,
                        touched: comp.touched
                    })
                });
            }
            if (comp && comp.onButtonStateChangedObservable) {
                comp.onButtonStateChangedObservable.add((component) => {
                    observable.notifyObservers({
                        controller: controller,
                        hand: controller.handness,
                        type: 'button',
                        component: comp,
                        value: component.value,
                        axisData: {x: component.axes.x, y: component.axes.y},
                        pressed: component.pressed,
                        touched: component.touched
                    });
                });
            }
        });
    }
}