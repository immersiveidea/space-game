import {
    AbstractMesh,
    Color3,
    DirectionalLight,
    FreeCamera,
    GlowLayer, InstancedMesh, Mesh,
    MeshBuilder,
    Observable,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType, PointLight,
    SceneLoader,
    SpotLight,
    StandardMaterial,
    TransformNode,
    Vector2,
    Vector3,
    WebXRAbstractMotionController,
    WebXRControllerComponent,
    WebXRInputSource
} from "@babylonjs/core";
import type {AudioEngineV2, StaticSound} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
const MAX_FORWARD_THRUST = 40;

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
    BEGINNER,
    ARCADE,
    REALISTIC
}

export class Ship {
    private _ship: TransformNode;
    private _controllerObservable: Observable<ControllerEvent> = new Observable<ControllerEvent>();
    private _ammoMaterial: StandardMaterial;
    private _forwardNode: TransformNode;
    private _rotationNode: TransformNode;
    private _glowLayer: GlowLayer;
    private _primaryThrustVectorSound: StaticSound;
    private _secondaryThrustVectorSound: StaticSound;
    private _shot: StaticSound;
    private _primaryThrustPlaying: boolean = false;
    private _secondaryThrustPlaying: boolean = false;
    private _shooting: boolean = false;
    private _camera: FreeCamera;
    private _ammoBaseMesh: AbstractMesh;
    private _controllerMode: ControllerStickMode;
    private _active = false;
    private _audioEngine: AudioEngineV2;
    constructor(mode: ControllerStickMode = ControllerStickMode.BEGINNER, audioEngine?: AudioEngineV2) {
        this._controllerMode = mode;
        this._audioEngine = audioEngine;
        this.setup();
        this.initialize();
    }
    public set controllerMode(mode: ControllerStickMode) {
        this._controllerMode = mode;
    }

    private async initializeSounds() {
        if (!this._audioEngine) return;

        this._primaryThrustVectorSound = await this._audioEngine.createSoundAsync("thrust", "/thrust5.mp3", {
            loop: true,
            volume: .2
        });
        this._secondaryThrustVectorSound = await this._audioEngine.createSoundAsync("thrust2", "/thrust5.mp3", {
            loop: true,
            volume: 0.5
        });
        this._shot = await this._audioEngine.createSoundAsync("shot", "/shot.mp3", {
            loop: false,
            volume: 0.5
        });
    }

    private shoot() {
        this._shot?.play();
        const ammo = new InstancedMesh("ammo", this._ammoBaseMesh as Mesh);
        ammo.parent = this._ship;
        ammo.position.y = 2;
        ammo.rotation.x = Math.PI / 2;
        ammo.setParent(null);
        const ammoAggregate = new PhysicsAggregate(ammo, PhysicsShapeType.CONVEX_HULL, {
            mass: 1000,
            restitution: 0
        }, DefaultScene.MainScene);
        ammoAggregate.body.setAngularDamping(1);


        ammoAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

        ammoAggregate.body.setLinearVelocity(this._ship.forward.scale(100000))
            //.add(this._ship.physicsBody.getLinearVelocity()));

        window.setTimeout(() => {
            ammoAggregate.dispose();
            ammo.dispose()
        }, 1500);
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

        // Create sounds asynchronously if audio engine is available
        if (this._audioEngine) {
            this.initializeSounds();
        }
        this._ammoMaterial = new StandardMaterial("ammoMaterial", DefaultScene.MainScene);
        this._ammoMaterial.emissiveColor = new Color3(1, 1, 0);
        this._ammoBaseMesh = MeshBuilder.CreateCapsule("bullet", {radius: .1, height: 2.5}, DefaultScene.MainScene);
        this._ammoBaseMesh.material = this._ammoMaterial;
        this._ammoBaseMesh.setEnabled(false);



        //const landingLight = new SpotLight("landingLight", new Vector3(0, 0, 0), new Vector3(0, -.5, .5), 1.5, .5, DefaultScene.MainScene);
       // landingLight.parent = this._ship;
       // landingLight.position.z = 5;
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
        signtMaterial.ambientColor = Color3.Yellow();
        sight.material = signtMaterial;
        sight.position = new Vector3(0, 2, 125);
        let i = Date.now();
        DefaultScene.MainScene.onBeforeRenderObservable.add(() => {
            if (Date.now() - i > 50 && this._active == true) {
                this.applyForce();
                i = Date.now();
            }
        });
        this._active = true;
    }
    private async initialize() {
        const importMesh = await SceneLoader.ImportMeshAsync(null, "./", "cockpit2.glb", DefaultScene.MainScene);
        const shipMesh = importMesh.meshes[0];
        shipMesh.id = "shipMesh";
        shipMesh.name = "shipMesh";
        shipMesh.parent = this._ship;
        shipMesh.rotation.y = Math.PI;
        shipMesh.position.y = 1;
        shipMesh.position.z = -1;
        shipMesh.renderingGroupId = 3;
        const light = new PointLight("ship.light", new Vector3(0, 1, .9), DefaultScene.MainScene);
        light.intensity = 4;
        light.includedOnlyMeshes = [shipMesh];
        for (const mesh of shipMesh.getChildMeshes()) {
            mesh.renderingGroupId = 3;
            if (mesh.material.id.indexOf('glass') === -1) {
                light.includedOnlyMeshes.push(mesh);
            }
        }
        light.parent = this._ship;
        DefaultScene.MainScene.getMaterialById('glass_mat.002').alpha = .4;
    }


    private _leftStickVector = Vector2.Zero().clone();
    private _rightStickVector = Vector2.Zero().clone();
    private _forwardValue = 0;
    private _yawValue = 0;
    private _rollValue = 0;
    private _pitchValue = 0;
    private _mouseDown = false;
    private _mousePos = new Vector2(0, 0);

    public get transformNode() {
        return this._ship;
    }


    private applyForce() {
        if (!this?._ship?.physicsBody) {
            return;
        }
        const body = this._ship.physicsBody;
        //If we're moving over MAX_FORWARD_THRUST, we can't add any more thrust,
        //just continue at MAX_FORWARD_THRUST
        if (Math.abs(this._forwardValue) > MAX_FORWARD_THRUST) {
            this._forwardValue = Math.sign(this._forwardValue) * MAX_FORWARD_THRUST;
        }

        //if forward thrust is under 40 we can apply more thrust
        if (Math.abs(this._forwardValue) <= MAX_FORWARD_THRUST) {
            if (Math.abs(this._leftStickVector.y) > .1) {
                if (this._primaryThrustVectorSound && !this._primaryThrustPlaying) {
                    this._primaryThrustVectorSound.play();
                    this._primaryThrustPlaying = true;
                }
                if (this._primaryThrustVectorSound) {
                    this._primaryThrustVectorSound.volume = Math.abs(this._leftStickVector.y);
                }
                this._forwardValue += this._leftStickVector.y * .8;
            } else {
                if (this._primaryThrustVectorSound && this._primaryThrustPlaying) {
                    this._primaryThrustVectorSound.stop();
                    this._primaryThrustPlaying = false;
                }
                this._forwardValue = decrementValue(this._forwardValue, .98);
            }
        }

        this._yawValue = adjustStickValue(this._leftStickVector.x, this._yawValue);
        this._rollValue = adjustStickValue(this._rightStickVector.x, this._rollValue);
        this._pitchValue = adjustStickValue(this._rightStickVector.y, this._pitchValue);

        this._forwardNode.position.z = this._forwardValue;
        this._rotationNode.position.y = this._yawValue;
        this._rotationNode.position.z = -this._rollValue;
        this._rotationNode.position.x = -this._pitchValue;

        const thrust2 = Math.abs(this._rightStickVector.y) +
            Math.abs(this._rightStickVector.x) +
            Math.abs(this._leftStickVector.x);

        if (thrust2 > .01) {
            if (this._secondaryThrustVectorSound && !this._secondaryThrustPlaying) {
                this._secondaryThrustVectorSound.play();
                this._secondaryThrustPlaying = true;
            }
            if (this._secondaryThrustVectorSound) {
                this._secondaryThrustVectorSound.volume = thrust2 * .4;
            }
        } else {
            if (this._secondaryThrustVectorSound && this._secondaryThrustPlaying) {
                this._secondaryThrustVectorSound.stop();
                this._secondaryThrustPlaying = false;
            }

        }
        body.setAngularVelocity(this._rotationNode.absolutePosition.subtract(this._ship.absolutePosition));
        body.setLinearVelocity(this._forwardNode.absolutePosition.subtract(this._ship.absolutePosition).scale(-1));
    }

    private controllerCallback = (controllerEvent: ControllerEvent) => {
        // Log first few events to verify they're firing
        if (Math.random() < 0.01) { // Only log 1% to avoid spam
            console.log('Controller event:', controllerEvent.type, controllerEvent.hand,
                       controllerEvent.type === 'thumbstick' ? controllerEvent.axisData : controllerEvent.value);
        }

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
        console.log('Ship.addController called for:', controller.inputSource.handedness);

        if (controller.inputSource.handedness == "left") {
            console.log('Adding left controller');
            this._leftInputSource = controller;
            this._leftInputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log('Left motion controller initialized:', motionController.handness);
                this.mapMotionController(motionController);
            });

            // Check if motion controller is already initialized
            if (controller.motionController) {
                console.log('Left motion controller already initialized, mapping now');
                this.mapMotionController(controller.motionController);
            }
        }
        if (controller.inputSource.handedness == "right") {
            console.log('Adding right controller');
            this._rightInputSource = controller;
            this._rightInputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log('Right motion controller initialized:', motionController.handness);
                this.mapMotionController(motionController);
            });

            // Check if motion controller is already initialized
            if (controller.motionController) {
                console.log('Right motion controller already initialized, mapping now');
                this.mapMotionController(controller.motionController);
            }
        }
    }

    private mapMotionController(controller: WebXRAbstractMotionController) {
        console.log('Mapping motion controller:', controller.handness, 'Profile:', controller.profileId);

        controllerComponents.forEach((component) => {
            const comp = controller.components[component];

            if (!comp) {
                console.log(`  Component ${component} not found on ${controller.handness} controller`);
                return;
            }

            console.log(`  Found component ${component} on ${controller.handness} controller`);
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
function decrementValue(value: number, increment: number = .8): number {
    if (Math.abs(value) < .01) {
        return 0;
    } else {
        return value * increment;
    }
}

function adjustStickValue(stickVector: number, thrustValue: number): number {
    if (Math.abs(stickVector) > .03) {
        return thrustValue + (Math.pow(stickVector, 3) * .1);
    } else {
        return decrementValue(thrustValue, .85);
    }
}
