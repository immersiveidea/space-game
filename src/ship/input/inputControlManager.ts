import { Observable } from "@babylonjs/core";
import { KeyboardInput } from "./keyboardInput";
import { ControllerInput } from "./controllerInput";
import debugLog from "../../core/debug";

/**
 * State change event emitted when ship controls or pointer selection state changes
 */
export interface InputControlStateChange {
    shipControlsEnabled: boolean;
    pointerSelectionEnabled: boolean;
    requester: string;  // e.g., "StatusScreen", "MissionBrief", "Level1"
    timestamp: number;
}

/**
 * Centralized manager for ship controls and pointer selection
 * Ensures ship controls and pointer selection are mutually exclusive
 * Emits events when state changes for debugging and analytics
 *
 * Design principles:
 * - Last-wins behavior: Most recent state change takes precedence
 * - Mutually exclusive: Ship controls and pointer selection are inverses
 * - Event-driven: Emits observables when state changes
 * - Centralized: Single source of truth via singleton pattern
 */
export class InputControlManager {
    private static _instance: InputControlManager | null = null;

    private _shipControlsEnabled: boolean = true;
    private _pointerSelectionEnabled: boolean = false;

    // Observable for state changes
    private _onStateChangedObservable: Observable<InputControlStateChange> = new Observable();

    // References to systems we control
    private _keyboardInput: KeyboardInput | null = null;
    private _controllerInput: ControllerInput | null = null;
    private _xrPointerFeature: any = null;

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {
        debugLog('[InputControlManager] Instance created');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): InputControlManager {
        if (!InputControlManager._instance) {
            InputControlManager._instance = new InputControlManager();
        }
        return InputControlManager._instance;
    }

    /**
     * Register input systems (called by Ship during initialization)
     */
    public registerInputSystems(keyboard: KeyboardInput | null, controller: ControllerInput | null): void {
        debugLog('[InputControlManager] Registering input systems', { keyboard: !!keyboard, controller: !!controller });
        this._keyboardInput = keyboard;
        this._controllerInput = controller;
    }

    /**
     * Register XR pointer feature (called by main.ts during XR setup)
     */
    public registerPointerFeature(pointerFeature: any): void {
        debugLog('[InputControlManager] Registering XR pointer feature');
        this._xrPointerFeature = pointerFeature;

        // Apply current state to the newly registered pointer feature
        this.updatePointerFeature();
    }

    /**
     * Enable ship controls, disable pointer selection
     */
    public enableShipControls(requester: string): void {
        debugLog(`[InputControlManager] Enabling ship controls (requester: ${requester})`);

        // Update state
        this._shipControlsEnabled = true;
        this._pointerSelectionEnabled = false;

        // Apply to input systems
        if (this._keyboardInput) {
            this._keyboardInput.setEnabled(true);
        }
        if (this._controllerInput) {
            this._controllerInput.setEnabled(true);
        }

        // Disable pointer selection
        this.updatePointerFeature();

        // Emit state change event
        this.emitStateChange(requester);
    }

    /**
     * Disable ship controls, enable pointer selection
     */
    public disableShipControls(requester: string): void {
        debugLog(`[InputControlManager] Disabling ship controls (requester: ${requester})`);

        // Update state
        this._shipControlsEnabled = false;
        this._pointerSelectionEnabled = true;

        // Apply to input systems
        if (this._keyboardInput) {
            this._keyboardInput.setEnabled(false);
        }
        if (this._controllerInput) {
            this._controllerInput.setEnabled(false);
        }

        // Enable pointer selection
        this.updatePointerFeature();

        // Emit state change event
        this.emitStateChange(requester);
    }

    /**
     * Update XR pointer feature state based on current settings
     */
    private updatePointerFeature(): void {
        if (!this._xrPointerFeature) {
            return;
        }

        try {
            if (this._pointerSelectionEnabled) {
                // Enable pointer selection (attach feature)
                this._xrPointerFeature.attach();
                debugLog('[InputControlManager] Pointer selection enabled');
            } else {
                // Disable pointer selection (detach feature)
                this._xrPointerFeature.detach();
                debugLog('[InputControlManager] Pointer selection disabled');
            }
        } catch (error) {
            console.warn('[InputControlManager] Failed to update pointer feature:', error);
        }
    }

    /**
     * Emit state change event
     */
    private emitStateChange(requester: string): void {
        const stateChange: InputControlStateChange = {
            shipControlsEnabled: this._shipControlsEnabled,
            pointerSelectionEnabled: this._pointerSelectionEnabled,
            requester: requester,
            timestamp: Date.now()
        };

        this._onStateChangedObservable.notifyObservers(stateChange);

        debugLog('[InputControlManager] State changed:', stateChange);
    }

    /**
     * Get current ship controls enabled state
     */
    public get shipControlsEnabled(): boolean {
        return this._shipControlsEnabled;
    }

    /**
     * Get current pointer selection enabled state
     */
    public get pointerSelectionEnabled(): boolean {
        return this._pointerSelectionEnabled;
    }

    /**
     * Get observable for state changes
     */
    public get onStateChanged(): Observable<InputControlStateChange> {
        return this._onStateChangedObservable;
    }

    /**
     * Cleanup (for testing or hot reload)
     */
    public dispose(): void {
        debugLog('[InputControlManager] Disposing');
        this._onStateChangedObservable.clear();
        this._keyboardInput = null;
        this._controllerInput = null;
        this._xrPointerFeature = null;
    }

    /**
     * Reset singleton instance (for testing)
     */
    public static reset(): void {
        if (InputControlManager._instance) {
            InputControlManager._instance.dispose();
            InputControlManager._instance = null;
        }
    }
}
