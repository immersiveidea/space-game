import log from '../../core/logger';

const STORAGE_KEY = 'space-game-controller-mapping';

/**
 * Available stick actions
 */
export type StickAction =
    | 'yaw'       // Rotation around Y-axis (left/right turn)
    | 'pitch'     // Rotation around X-axis (nose up/down)
    | 'roll'      // Rotation around Z-axis (barrel roll)
    | 'forward'   // Forward/backward thrust
    | 'none';     // No action

/**
 * Available button actions
 */
type ButtonAction =
    | 'fire'          // Fire weapon
    | 'cameraUp'      // Adjust camera up
    | 'cameraDown'    // Adjust camera down
    | 'statusScreen'  // Toggle status screen
    | 'none';         // No action

/**
 * Complete controller mapping configuration
 */
export interface ControllerMapping {
    // Stick axis mappings
    leftStickX: StickAction;
    leftStickY: StickAction;
    rightStickX: StickAction;
    rightStickY: StickAction;

    // Inversion flags for each axis
    invertLeftStickX: boolean;
    invertLeftStickY: boolean;
    invertRightStickX: boolean;
    invertRightStickY: boolean;

    // Button mappings
    trigger: ButtonAction;
    aButton: ButtonAction;
    bButton: ButtonAction;
    xButton: ButtonAction;
    yButton: ButtonAction;
    squeeze: ButtonAction;
}

/**
 * Singleton configuration manager for controller mappings
 * Handles loading, saving, and validation of controller configurations
 */
export class ControllerMappingConfig {
    private static _instance: ControllerMappingConfig | null = null;
    private _mapping: ControllerMapping;

    /**
     * Default controller mapping (matches original game behavior)
     */
    private static readonly DEFAULT_MAPPING: ControllerMapping = {
        // Stick mappings (original behavior)
        leftStickX: 'yaw',
        leftStickY: 'forward',
        rightStickX: 'roll',
        rightStickY: 'pitch',

        // No inversions by default
        invertLeftStickX: false,
        invertLeftStickY: false,
        invertRightStickX: false,
        invertRightStickY: false,

        // Button mappings (original behavior)
        trigger: 'fire',
        aButton: 'cameraDown',
        bButton: 'cameraUp',
        xButton: 'statusScreen',
        yButton: 'none',
        squeeze: 'none',
    };

    private constructor() {
        this._mapping = { ...ControllerMappingConfig.DEFAULT_MAPPING };
        this.loadFromStorage();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ControllerMappingConfig {
        if (!ControllerMappingConfig._instance) {
            ControllerMappingConfig._instance = new ControllerMappingConfig();
        }
        return ControllerMappingConfig._instance;
    }

    /**
     * Get current mapping configuration
     */
    public getMapping(): Readonly<ControllerMapping> {
        return { ...this._mapping };
    }

    /**
     * Update mapping configuration
     */
    public setMapping(mapping: ControllerMapping): void {
        this._mapping = { ...mapping };
        log.debug('[ControllerMapping] Configuration updated:', this._mapping);
    }

    /**
     * Reset to default mapping
     */
    public resetToDefault(): void {
        this._mapping = { ...ControllerMappingConfig.DEFAULT_MAPPING };
        log.debug('[ControllerMapping] Reset to default configuration');
    }

    /**
     * Save current mapping to localStorage
     */
    public save(): void {
        try {
            const json = JSON.stringify(this._mapping);
            localStorage.setItem(STORAGE_KEY, json);
            log.debug('[ControllerMapping] Saved to localStorage');
        } catch (error) {
            log.error('[ControllerMapping] Failed to save to localStorage:', error);
        }
    }

    /**
     * Load mapping from localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<ControllerMapping>;

                // Merge with defaults to handle missing properties (backward compatibility)
                this._mapping = {
                    ...ControllerMappingConfig.DEFAULT_MAPPING,
                    ...parsed,
                };

                log.debug('[ControllerMapping] Loaded from localStorage:', this._mapping);
            } else {
                log.debug('[ControllerMapping] No saved configuration, using defaults');
            }
        } catch (error) {
            log.warn('[ControllerMapping] Failed to load from localStorage, using defaults:', error);
            this._mapping = { ...ControllerMappingConfig.DEFAULT_MAPPING };
        }
    }

    /**
     * Validate mapping configuration
     * Returns array of warning messages (empty if valid)
     */
    public validate(): string[] {
        const warnings: string[] = [];

        // Check if fire action is mapped
        const hasFireAction = this._mapping.trigger === 'fire' ||
                              this._mapping.aButton === 'fire' ||
                              this._mapping.bButton === 'fire' ||
                              this._mapping.xButton === 'fire' ||
                              this._mapping.yButton === 'fire' ||
                              this._mapping.squeeze === 'fire';

        if (!hasFireAction) {
            warnings.push('Warning: No button is mapped to "Fire Weapon"');
        }

        // Check if forward thrust is mapped
        const hasForwardAction = this._mapping.leftStickX === 'forward' ||
                                 this._mapping.leftStickY === 'forward' ||
                                 this._mapping.rightStickX === 'forward' ||
                                 this._mapping.rightStickY === 'forward';

        if (!hasForwardAction) {
            warnings.push('Warning: No stick is mapped to "Forward Thrust"');
        }

        // Check for duplicate stick actions (excluding 'none')
        const stickActions = [
            this._mapping.leftStickX,
            this._mapping.leftStickY,
            this._mapping.rightStickX,
            this._mapping.rightStickY,
        ].filter(action => action !== 'none');

        const duplicateStickActions = stickActions.filter((action, index) =>
            stickActions.indexOf(action) !== index
        );

        if (duplicateStickActions.length > 0) {
            const unique = Array.from(new Set(duplicateStickActions));
            warnings.push(`Warning: Multiple sticks mapped to same action: ${unique.join(', ')}`);
        }

        // Check for duplicate button actions (excluding 'none')
        const buttonActions = [
            this._mapping.trigger,
            this._mapping.aButton,
            this._mapping.bButton,
            this._mapping.xButton,
            this._mapping.yButton,
            this._mapping.squeeze,
        ].filter(action => action !== 'none');

        const duplicateButtonActions = buttonActions.filter((action, index) =>
            buttonActions.indexOf(action) !== index
        );

        if (duplicateButtonActions.length > 0) {
            const unique = Array.from(new Set(duplicateButtonActions));
            warnings.push(`Warning: Multiple buttons mapped to same action: ${unique.join(', ')}`);
        }

        return warnings;
    }

    /**
     * Get human-readable label for a stick action
     */
    public static getStickActionLabel(action: StickAction): string {
        switch (action) {
            case 'yaw': return 'Yaw (Turn Left/Right)';
            case 'pitch': return 'Pitch (Nose Up/Down)';
            case 'roll': return 'Roll (Barrel Roll)';
            case 'forward': return 'Forward/Backward Thrust';
            case 'none': return 'None';
            default: return action;
        }
    }

    /**
     * Get human-readable label for a button action
     */
    public static getButtonActionLabel(action: ButtonAction): string {
        switch (action) {
            case 'fire': return 'Fire Weapon';
            case 'cameraUp': return 'Camera Adjust Up';
            case 'cameraDown': return 'Camera Adjust Down';
            case 'statusScreen': return 'Toggle Status Screen';
            case 'none': return 'None';
            default: return action;
        }
    }

    /**
     * Get all available stick actions
     */
    public static getAvailableStickActions(): StickAction[] {
        return ['yaw', 'pitch', 'roll', 'forward', 'none'];
    }

    /**
     * Get all available button actions
     */
    public static getAvailableButtonActions(): ButtonAction[] {
        return ['fire', 'cameraUp', 'cameraDown', 'statusScreen', 'none'];
    }
}
