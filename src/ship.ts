import {
    AbstractMesh,
    Color3,
    FreeCamera,
    InstancedMesh, Mesh,
    MeshBuilder,
    Observable,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
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
import { GameConfig } from "./gameConfig";
import { Sight } from "./sight";
import debugLog from './debug';
import {Scoreboard} from "./scoreboard";
import loadAsset from "./utils/loadAsset";
import {Debug} from "@babylonjs/core/Legacy/legacy";
const MAX_LINEAR_VELOCITY = 200;
const MAX_ANGULAR_VELOCITY = 1.4;
const LINEAR_FORCE_MULTIPLIER = 800;
const ANGULAR_FORCE_MULTIPLIER = 15;

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


export class Ship {
    private _ship: TransformNode;
    private _scoreboard: Scoreboard;
    private _controllerObservable: Observable<ControllerEvent> = new Observable<ControllerEvent>();
    private _ammoMaterial: StandardMaterial;
    private _primaryThrustVectorSound: StaticSound;
    private _secondaryThrustVectorSound: StaticSound;
    private _shot: StaticSound;
    private _primaryThrustPlaying: boolean = false;
    private _secondaryThrustPlaying: boolean = false;
    private _shooting: boolean = false;
    private _camera: FreeCamera;
    private _ammoBaseMesh: AbstractMesh;
    private _audioEngine: AudioEngineV2;
    private _sight: Sight;

    constructor( audioEngine?: AudioEngineV2) {
        this._audioEngine = audioEngine;
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
    public get scoreboard(): Scoreboard {
        return this._scoreboard;
    }
    private shoot() {
        // Only allow shooting if physics is enabled
        const config = GameConfig.getInstance();
        if (!config.physicsEnabled) {
            return;
        }

        this._shot?.play();
        const ammo = new InstancedMesh("ammo", this._ammoBaseMesh as Mesh);
        ammo.parent = this._ship;
        ammo.position.y = .1;
        ammo.position.z =  8.4;
        //ammo.rotation.x = Math.PI / 2;
        ammo.setParent(null);
        const ammoAggregate = new PhysicsAggregate(ammo, PhysicsShapeType.SPHERE, {
            mass: 1000,
            restitution: 0
        }, DefaultScene.MainScene);
        ammoAggregate.body.setAngularDamping(1);


        ammoAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

        ammoAggregate.body.setLinearVelocity(this._ship.forward.scale(200000))
            //.add(this._ship.physicsBody.getLinearVelocity()));

        window.setTimeout(() => {
            ammoAggregate.dispose();
            ammo.dispose()
        }, 2000);
    }

    public set position(newPosition: Vector3) {
        const body = this._ship.physicsBody;

        // Physics body might not exist yet if called before initialize() completes
        if (!body) {
            // Just set position directly on transform node
            this._ship.position.copyFrom(newPosition);
            return;
        }

        body.disablePreStep = false;
        body.transformNode.position.copyFrom(newPosition);
        DefaultScene.MainScene.onAfterRenderObservable.addOnce(() => {
            body.disablePreStep = true;
        })

    }

    public async initialize() {
        this._scoreboard = new Scoreboard();
        this._ship = new TransformNode("shipBawe", DefaultScene.MainScene);
        //this._ship.rotation.y = Math.PI;
        const data = await loadAsset('ship.glb');
        const axes = new Debug.AxesViewer(DefaultScene.MainScene, 1);
        //axes.xAxis.parent = data.container.rootNodes[0];
        //axes.yAxis.parent = data.container.rootNodes[0];
        axes.zAxis.parent = data.container.transformNodes[0];
        //data.container.transformNodes[0].parent = this._ship;
        this._ship = data.container.transformNodes[0];
        this._ship.position.y = 5;

        const config = GameConfig.getInstance();
        if (config.physicsEnabled) {
            console.log('Physics Enabled for Ship');
            if (this._ship) {
                const agg = new PhysicsAggregate(
                    this._ship,
                    PhysicsShapeType.MESH,
                    {
                        mass: 10,
                        mesh: data.container.rootNodes[0].getChildMeshes()[0] as Mesh
                    },
                    DefaultScene.MainScene
                );

                agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
                agg.body.setLinearDamping(.2);
                agg.body.setAngularDamping(.4);
                agg.body.setAngularVelocity(new Vector3(0, 0, 0));
                agg.body.setCollisionCallbackEnabled(true);

            } else {
                console.warn("No geometry mesh found, cannot create physics");
            }
        }
        //shipMesh.position.z = -1;

        if (this._audioEngine) {
            await this.initializeSounds();
        }
        this._ammoMaterial = new StandardMaterial("ammoMaterial", DefaultScene.MainScene);
        this._ammoMaterial.emissiveColor = new Color3(1, 1, 0);
        this._ammoBaseMesh = MeshBuilder.CreateIcoSphere("bullet", {radius: .1, subdivisions: 2}, DefaultScene.MainScene);
        this._ammoBaseMesh.material = this._ammoMaterial;
        this._ammoBaseMesh.setEnabled(false);



        //const landingLight = new SpotLight("landingLight", new Vector3(0, 0, 0), new Vector3(0, -.5, .5), 1.5, .5, DefaultScene.MainScene);
        // landingLight.parent = this._ship;
        // landingLight.position.z = 5;

        // Physics will be set up after mesh loads in initialize()

        this.setupKeyboard();
        this.setupMouse();
        this._controllerObservable.add(this.controllerCallback);
        this._camera = new FreeCamera("Flat Camera",
            new Vector3(0, .5, 0),
            DefaultScene.MainScene);
        this._camera.parent = this._ship;

        //DefaultScene.MainScene.setActiveCameraByName("Flat Camera");

        // Create sight reticle
        this._sight = new Sight(DefaultScene.MainScene, this._ship, {
            position: new Vector3(0, .1, 125),
            circleRadius: 2,
            crosshairLength: 1.5,
            lineThickness: 0.1,
            color: Color3.Green(),
            renderingGroupId: 3,
            centerGap: 0.5
        });
        console.log(data.meshes.get('Screen'));
        const screen = DefaultScene.MainScene.getMaterialById('Screen').getBindedMeshes()[0] as Mesh
        console.log(screen);
        const old = screen.parent;
        screen.setParent(null);
        screen.setPivotPoint(screen.getBoundingInfo().boundingSphere.center);
        screen.setParent(old);
        screen.rotation.y  = Math.PI;
        console.log(screen.rotation);
        console.log(screen.scaling);

        this._scoreboard.initialize(screen);


    }


    private _leftStickVector = Vector2.Zero().clone();
    private _rightStickVector = Vector2.Zero().clone();
    private _mouseDown = false;
    private _mousePos = new Vector2(0, 0);

    public get transformNode() {
        return this._ship;
    }

    private applyForces() {
        if (!this?._ship?.physicsBody) {
            return;
        }
        const body = this._ship.physicsBody;

        // Get current velocities for velocity cap checks
        const currentLinearVelocity = body.getLinearVelocity();
        const currentAngularVelocity = body.getAngularVelocity();
        const currentSpeed = currentLinearVelocity.length();

        // Apply linear force from left stick Y (forward/backward)
        if (Math.abs(this._leftStickVector.y) > .1) {
            // Only apply force if we haven't reached max velocity
            if (currentSpeed < MAX_LINEAR_VELOCITY) {
                // Get local direction (Z-axis for forward/backward thrust)
                const localDirection = new Vector3(0, 0, -this._leftStickVector.y);
                // Transform to world space - TransformNode vectors are in local space!
                const worldDirection = Vector3.TransformNormal(localDirection, this._ship.getWorldMatrix());
                const force = worldDirection.scale(LINEAR_FORCE_MULTIPLIER);
                const thrustPoint = Vector3.TransformCoordinates(this._ship.physicsBody.getMassProperties().centerOfMass.add(new Vector3(0,1,0)), this._ship.getWorldMatrix());
                body.applyForce(force, thrustPoint);

            }

            // Handle primary thrust sound
            if (this._primaryThrustVectorSound && !this._primaryThrustPlaying) {
                this._primaryThrustVectorSound.play();
                this._primaryThrustPlaying = true;
            }
            if (this._primaryThrustVectorSound) {
                this._primaryThrustVectorSound.volume = Math.abs(this._leftStickVector.y);
            }
        } else {
            // Stop thrust sound when no input
            if (this._primaryThrustVectorSound && this._primaryThrustPlaying) {
                this._primaryThrustVectorSound.stop();
                this._primaryThrustPlaying = false;
            }
        }

        // Calculate rotation magnitude for torque and sound
        const rotationMagnitude = Math.abs(this._rightStickVector.y) +
            Math.abs(this._rightStickVector.x) +
            Math.abs(this._leftStickVector.x);

        // Apply angular forces if any stick has significant rotation input
        if (rotationMagnitude > .1) {
            const currentAngularSpeed = currentAngularVelocity.length();

            // Only apply torque if we haven't reached max angular velocity
            if (currentAngularSpeed < MAX_ANGULAR_VELOCITY) {
                const yaw = -this._leftStickVector.x;
                const pitch = this._rightStickVector.y;
                const roll = this._rightStickVector.x;

                // Create torque in local space, then transform to world space
                const localTorque = new Vector3(pitch, yaw, roll).scale(ANGULAR_FORCE_MULTIPLIER);
                const worldTorque = Vector3.TransformNormal(localTorque, this._ship.getWorldMatrix());

                body.applyAngularImpulse(worldTorque);

                // Debug visualization for angular forces
            }

            // Handle secondary thrust sound for rotation
            if (this._secondaryThrustVectorSound && !this._secondaryThrustPlaying) {
                this._secondaryThrustVectorSound.play();
                this._secondaryThrustPlaying = true;
            }
            if (this._secondaryThrustVectorSound) {
                this._secondaryThrustVectorSound.volume = rotationMagnitude * .4;
            }
        } else {
            // Stop rotation thrust sound when no input
            if (this._secondaryThrustVectorSound && this._secondaryThrustPlaying) {
                this._secondaryThrustVectorSound.stop();
                this._secondaryThrustPlaying = false;
            }
        }
    }


    private controllerCallback = (controllerEvent: ControllerEvent) => {
        // Log first few events to verify they're firing

        if (controllerEvent.type == 'thumbstick') {
            if (controllerEvent.hand == 'left') {
                this._leftStickVector.x = controllerEvent.axisData.x;
                this._leftStickVector.y = controllerEvent.axisData.y;
            }

            if (controllerEvent.hand == 'right') {
                this._rightStickVector.x = controllerEvent.axisData.x;
                this._rightStickVector.y = controllerEvent.axisData.y;
            }
            this.applyForces();
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
            if (controllerEvent.component.type == 'button') {
                if (controllerEvent.component.id == 'a-button') {
                    DefaultScene.XR.baseExperience.camera.position.y = DefaultScene.XR.baseExperience.camera.position.y - .1;
                }
                if (controllerEvent.component.id == 'b-button') {
                    DefaultScene.XR.baseExperience.camera.position.y = DefaultScene.XR.baseExperience.camera.position.y + .1;
                }
                console.log(controllerEvent);

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
            this.applyForces();

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
            this.applyForces();
        };
    }

    private _leftInputSource: WebXRInputSource;
    private _rightInputSource: WebXRInputSource;

    public addController(controller: WebXRInputSource) {
        debugLog('Ship.addController called for:', controller.inputSource.handedness);

        if (controller.inputSource.handedness == "left") {
            debugLog('Adding left controller');
            this._leftInputSource = controller;
            this._leftInputSource.onMotionControllerInitObservable.add((motionController) => {
                debugLog('Left motion controller initialized:', motionController.handness);
                this.mapMotionController(motionController);
            });

            // Check if motion controller is already initialized
            if (controller.motionController) {
                debugLog('Left motion controller already initialized, mapping now');
                this.mapMotionController(controller.motionController);
            }
        }
        if (controller.inputSource.handedness == "right") {
            debugLog('Adding right controller');
            this._rightInputSource = controller;
            this._rightInputSource.onMotionControllerInitObservable.add((motionController) => {
                debugLog('Right motion controller initialized:', motionController.handness);
                this.mapMotionController(motionController);
            });

            // Check if motion controller is already initialized
            if (controller.motionController) {
                debugLog('Right motion controller already initialized, mapping now');
                this.mapMotionController(controller.motionController);
            }
        }
    }

    private mapMotionController(controller: WebXRAbstractMotionController) {
        debugLog('Mapping motion controller:', controller.handness, 'Profile:', controller.profileId);

        controllerComponents.forEach((component) => {
            const comp = controller.components[component];

            if (!comp) {
                debugLog(`  Component ${component} not found on ${controller.handness} controller`);
                return;
            }

            debugLog(`  Found component ${component} on ${controller.handness} controller`);
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

    /**
     * Dispose of ship resources
     */
    public dispose(): void {
        if (this._sight) {
            this._sight.dispose();
        }

        // Add other cleanup as needed
    }
}
