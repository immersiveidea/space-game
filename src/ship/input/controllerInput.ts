import {
    Observable,
    Vector2,
    WebXRAbstractMotionController,
    WebXRControllerComponent,
    WebXRInputSource,
} from "@babylonjs/core";
import debugLog from "../../core/debug";
import { ControllerMappingConfig, StickAction } from "./controllerMapping";

const controllerComponents = [
    "a-button",
    "b-button",
    "x-button",
    "y-button",
    "thumbrest",
    "xr-standard-squeeze",
    "xr-standard-thumbstick",
    "xr-standard-trigger",
];

type ControllerEvent = {
    hand: "right" | "left" | "none";
    type: "thumbstick" | "button";
    controller: WebXRAbstractMotionController;
    component: WebXRControllerComponent;
    value: number;
    axisData: { x: number; y: number };
    pressed: boolean;
    touched: boolean;
};

interface CameraAdjustment {
    direction: "up" | "down";
}

/**
 * Handles VR controller input for ship control
 * Maps controller thumbsticks and buttons to ship controls
 */
export class ControllerInput {
    // Raw stick values (before mapping)
    private _rawLeftStickX: number = 0;
    private _rawLeftStickY: number = 0;
    private _rawRightStickX: number = 0;
    private _rawRightStickY: number = 0;

    // Legacy stick vectors (for compatibility)
    private _leftStick: Vector2 = Vector2.Zero();
    private _rightStick: Vector2 = Vector2.Zero();

    private _shooting: boolean = false;
    private _leftInputSource: WebXRInputSource;
    private _rightInputSource: WebXRInputSource;
    private _controllerObservable: Observable<ControllerEvent> =
        new Observable<ControllerEvent>();
    private _onShootObservable: Observable<void> = new Observable<void>();
    private _onCameraAdjustObservable: Observable<CameraAdjustment> =
        new Observable<CameraAdjustment>();
    private _onStatusScreenToggleObservable: Observable<void> = new Observable<void>();
    private _enabled: boolean = true;
    private _mappingConfig: ControllerMappingConfig;

    constructor() {
        this._controllerObservable.add(this.handleControllerEvent.bind(this));
        this._mappingConfig = ControllerMappingConfig.getInstance();
    }

    /**
     * Get observable that fires when trigger is pressed
     */
    public get onShootObservable(): Observable<void> {
        return this._onShootObservable;
    }

    /**
     * Get observable that fires when camera adjustment buttons are pressed
     */
    public get onCameraAdjustObservable(): Observable<CameraAdjustment> {
        return this._onCameraAdjustObservable;
    }

    /**
     * Get observable that fires when X button is pressed on left controller
     */
    public get onStatusScreenToggleObservable(): Observable<void> {
        return this._onStatusScreenToggleObservable;
    }

    /**
     * Get current input state (stick positions)
     * Applies controller mapping configuration to translate raw input to actions
     */
    public getInputState() {
        if (!this._enabled) {
            return {
                leftStick: Vector2.Zero(),
                rightStick: Vector2.Zero(),
            };
        }

        const mapping = this._mappingConfig.getMapping();

        // Create action values map
        const actions = new Map<StickAction, number>();
        actions.set('yaw', 0);
        actions.set('pitch', 0);
        actions.set('roll', 0);
        actions.set('forward', 0);

        // Apply raw stick values to configured actions (with inversion)
        const leftX = mapping.invertLeftStickX ? -this._rawLeftStickX : this._rawLeftStickX;
        const leftY = mapping.invertLeftStickY ? -this._rawLeftStickY : this._rawLeftStickY;
        const rightX = mapping.invertRightStickX ? -this._rawRightStickX : this._rawRightStickX;
        const rightY = mapping.invertRightStickY ? -this._rawRightStickY : this._rawRightStickY;

        if (mapping.leftStickX !== 'none') {
            actions.set(mapping.leftStickX, leftX);
        }
        if (mapping.leftStickY !== 'none') {
            actions.set(mapping.leftStickY, leftY);
        }
        if (mapping.rightStickX !== 'none') {
            actions.set(mapping.rightStickX, rightX);
        }
        if (mapping.rightStickY !== 'none') {
            actions.set(mapping.rightStickY, rightY);
        }

        // Map actions back to virtual stick positions for ShipPhysics
        // leftStick.x = yaw, leftStick.y = forward
        // rightStick.x = roll, rightStick.y = pitch
        return {
            leftStick: new Vector2(actions.get('yaw') || 0, actions.get('forward') || 0),
            rightStick: new Vector2(actions.get('roll') || 0, actions.get('pitch') || 0),
        };
    }

    /**
     * Enable or disable controller input
     */
    public setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            // Reset raw stick values when disabled
            this._rawLeftStickX = 0;
            this._rawLeftStickY = 0;
            this._rawRightStickX = 0;
            this._rawRightStickY = 0;
            // Also reset legacy values
            this._leftStick.x = 0;
            this._leftStick.y = 0;
            this._rightStick.x = 0;
            this._rightStick.y = 0;
        }
    }

    /**
     * Add a VR controller to the input system
     */
    public addController(controller: WebXRInputSource): void {
        debugLog(
            "ControllerInput.addController called for:",
            controller.inputSource.handedness
        );

        if (controller.inputSource.handedness === "left") {
            debugLog("Adding left controller");
            this._leftInputSource = controller;
            this._leftInputSource.onMotionControllerInitObservable.add(
                (motionController) => {
                    debugLog(
                        "Left motion controller initialized:",
                        motionController.handness
                    );
                    this.mapMotionController(motionController);
                }
            );

            // Check if motion controller is already initialized
            if (controller.motionController) {
                debugLog("Left motion controller already initialized, mapping now");
                this.mapMotionController(controller.motionController);
            }
        }

        if (controller.inputSource.handedness === "right") {
            debugLog("Adding right controller");
            this._rightInputSource = controller;
            this._rightInputSource.onMotionControllerInitObservable.add(
                (motionController) => {
                    debugLog(
                        "Right motion controller initialized:",
                        motionController.handness
                    );
                    this.mapMotionController(motionController);
                }
            );

            // Check if motion controller is already initialized
            if (controller.motionController) {
                debugLog("Right motion controller already initialized, mapping now");
                this.mapMotionController(controller.motionController);
            }
        }
    }

    /**
     * Map controller components to observables
     */
    private mapMotionController(
        controller: WebXRAbstractMotionController
    ): void {
        debugLog(
            "Mapping motion controller:",
            controller.handness,
            "Profile:",
            controller.profileId
        );

        controllerComponents.forEach((component) => {
            const comp = controller.components[component];

            if (!comp) {
                debugLog(
                    `  Component ${component} not found on ${controller.handness} controller`
                );
                return;
            }

            debugLog(
                `  Found component ${component} on ${controller.handness} controller`
            );
            const observable = this._controllerObservable;

            if (comp && comp.onAxisValueChangedObservable) {
                comp.onAxisValueChangedObservable.add((axisData) => {
                    observable.notifyObservers({
                        controller: controller,
                        hand: controller.handness,
                        type: "thumbstick",
                        component: comp,
                        value: comp.value,
                        axisData: { x: axisData.x, y: axisData.y },
                        pressed: comp.pressed,
                        touched: comp.touched,
                    });
                });
            }

            if (comp && comp.onButtonStateChangedObservable) {
                comp.onButtonStateChangedObservable.add((component) => {
                    observable.notifyObservers({
                        controller: controller,
                        hand: controller.handness,
                        type: "button",
                        component: comp,
                        value: component.value,
                        axisData: { x: component.axes.x, y: component.axes.y },
                        pressed: component.pressed,
                        touched: component.touched,
                    });
                });
            }
        });
    }

    /**
     * Handle controller events (thumbsticks and buttons)
     */
    private handleControllerEvent(controllerEvent: ControllerEvent): void {
        // Don't process ship control inputs when disabled (but allow status screen toggle)
        if (!this._enabled && controllerEvent.type === "thumbstick") {
            return;
        }

        if (!this._enabled && controllerEvent.type === "button") {
            // Only allow X-button on left controller (for status screen toggle)
            if (controllerEvent.component.id === "x-button" && controllerEvent.hand === "left") {
                // Allow this through
            } else {
                // Block all other buttons including triggers
                return;
            }
        }

        if (controllerEvent.type === "thumbstick") {
            // Store raw stick values (mapping will be applied in getInputState())
            if (controllerEvent.hand === "left") {
                this._rawLeftStickX = controllerEvent.axisData.x;
                this._rawLeftStickY = controllerEvent.axisData.y;
            }

            if (controllerEvent.hand === "right") {
                this._rawRightStickX = controllerEvent.axisData.x;
                this._rawRightStickY = controllerEvent.axisData.y;
            }
        }

        if (controllerEvent.type === "button") {
            if (controllerEvent.component.type === "trigger") {
                if (!this._enabled) {
                    return;
                }
                if (controllerEvent.value > 0.9 && !this._shooting) {
                    this._shooting = true;
                    this._onShootObservable.notifyObservers();
                }
                if (controllerEvent.value < 0.1) {
                    this._shooting = false;
                }
            }

            if (controllerEvent.component.type === "button") {
                if (controllerEvent.component.id === "a-button") {
                    this._onCameraAdjustObservable.notifyObservers({
                        direction: "down",
                    });
                }
                if (controllerEvent.component.id === "b-button") {
                    this._onCameraAdjustObservable.notifyObservers({
                        direction: "up",
                    });
                }
                if (controllerEvent.component.id === "x-button" && controllerEvent.hand === "left") {
                    // Only trigger on button press, not release
                    // X button always works, even when disabled, to allow toggling status screen
                    if (controllerEvent.pressed) {
                        this._onStatusScreenToggleObservable.notifyObservers();
                    }
                }
                console.log(controllerEvent);
            }
        }
    }

    /**
     * Cleanup observables
     */
    public dispose(): void {
        this._controllerObservable.clear();
        this._onShootObservable.clear();
        this._onCameraAdjustObservable.clear();
    }
}
