import { FreeCamera, Observable, Scene, Vector2 } from "@babylonjs/core";

/**
 * Handles keyboard and mouse input for ship control
 * Combines both input methods into a unified interface
 */
/**
 * Recording control action types
 */
type RecordingAction =
    | "exportRingBuffer"      // R key
    | "toggleLongRecording"    // Ctrl+R
    | "exportLongRecording";   // Shift+R

export class KeyboardInput {
    private _leftStick: Vector2 = Vector2.Zero();
    private _rightStick: Vector2 = Vector2.Zero();
    private _mouseDown: boolean = false;
    private _mousePos: Vector2 = new Vector2(0, 0);
    private _onShootObservable: Observable<void> = new Observable<void>();
    private _onCameraChangeObservable: Observable<number> = new Observable<number>();
    private _onRecordingActionObservable: Observable<RecordingAction> = new Observable<RecordingAction>();
    private _scene: Scene;
    private _enabled: boolean = true;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    /**
     * Get observable that fires when shoot key/button is pressed
     */
    public get onShootObservable(): Observable<void> {
        return this._onShootObservable;
    }

    /**
     * Get observable that fires when camera change key is pressed
     */
    public get onCameraChangeObservable(): Observable<number> {
        return this._onCameraChangeObservable;
    }

    /**
     * Get observable that fires when recording action is triggered
     */
    public get onRecordingActionObservable(): Observable<RecordingAction> {
        return this._onRecordingActionObservable;
    }

    /**
     * Get current input state (stick positions)
     */
    public getInputState() {
        if (!this._enabled) {
            return {
                leftStick: Vector2.Zero(),
                rightStick: Vector2.Zero(),
            };
        }
        return {
            leftStick: this._leftStick.clone(),
            rightStick: this._rightStick.clone(),
        };
    }

    /**
     * Enable or disable keyboard input
     */
    public setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            // Reset stick values when disabled
            this._leftStick.x = 0;
            this._leftStick.y = 0;
            this._rightStick.x = 0;
            this._rightStick.y = 0;
        }
    }

    /**
     * Setup keyboard and mouse event listeners
     */
    public setup(): void {
        this.setupKeyboard();
        this.setupMouse();
    }

    /**
     * Setup keyboard event listeners
     */
    private setupKeyboard(): void {
        document.onkeyup = () => {
            this._leftStick.y = 0;
            this._leftStick.x = 0;
            this._rightStick.y = 0;
            this._rightStick.x = 0;
        };

        document.onkeydown = (ev) => {
            // Always allow inspector and camera toggle, even when disabled
            if (ev.key === 'i') {
                // Toggle Babylon Inspector
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show({
                        overlay: true,
                        showExplorer: true,
                    });
                }
                return;
            }

            if (ev.key === '1') {
                this._onCameraChangeObservable.notifyObservers(1);
                return;
            }

            // Don't process ship control inputs when disabled
            if (!this._enabled) {
                return;
            }

            // Recording controls (with modifiers)
            /*if (ev.key === 'r' || ev.key === 'R') {
                if (ev.ctrlKey || ev.metaKey) {
                    // Ctrl+R or Cmd+R: Toggle long recording
                    ev.preventDefault(); // Prevent browser reload
                    this._onRecordingActionObservable.notifyObservers("toggleLongRecording");
                    return;
                } else if (ev.shiftKey) {
                    // Shift+R: Export long recording
                    this._onRecordingActionObservable.notifyObservers("exportLongRecording");
                    return;
                } else {
                    // R: Export ring buffer (last 30 seconds)
                    this._onRecordingActionObservable.notifyObservers("exportRingBuffer");
                    return;
                }
            }*/

            switch (ev.key) {
                case ' ':
                    this._onShootObservable.notifyObservers();
                    break;
                case 'e':
                    break;
                case 'w':
                    this._leftStick.y = -1;
                    break;
                case 's':
                    this._leftStick.y = 1;
                    break;
                case 'a':
                    this._leftStick.x = -1;
                    break;
                case 'd':
                    this._leftStick.x = 1;
                    break;
                case 'ArrowUp':
                    this._rightStick.y = -1;
                    break;
                case 'ArrowDown':
                    this._rightStick.y = 1;
                    break;
                case 'ArrowLeft':
                    this._rightStick.x = -1;
                    break;
                case 'ArrowRight':
                    this._rightStick.x = 1;
                    break;
            }
        };
    }

    /**
     * Setup mouse event listeners for drag-based rotation control
     */
    private setupMouse(): void {
        this._scene.onPointerDown = (evt) => {
            this._mousePos.x = evt.x;
            this._mousePos.y = evt.y;
            this._mouseDown = true;
        };

        this._scene.onPointerUp = () => {
            this._mouseDown = false;
        };

        this._scene.onPointerMove = (ev) => {
            if (!this._mouseDown) {
                return;
            }

            const xInc = (ev.x - this._mousePos.x) / 100;
            const yInc = (ev.y - this._mousePos.y) / 100;

            if (Math.abs(xInc) <= 1) {
                this._rightStick.x = xInc;
            } else {
                this._rightStick.x = Math.sign(xInc);
            }

            if (Math.abs(yInc) <= 1) {
                this._rightStick.y = yInc;
            } else {
                this._rightStick.y = Math.sign(yInc);
            }
        };
    }

    /**
     * Cleanup event listeners
     */
    public dispose(): void {
        document.onkeydown = null;
        document.onkeyup = null;
        this._scene.onPointerDown = null;
        this._scene.onPointerUp = null;
        this._scene.onPointerMove = null;
        this._onShootObservable.clear();
        this._onCameraChangeObservable.clear();
        this._onRecordingActionObservable.clear();
    }
}
