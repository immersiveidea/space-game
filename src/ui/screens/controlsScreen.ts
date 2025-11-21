import {
    ControllerMappingConfig,
    ControllerMapping,
    StickAction,
    ButtonAction
} from '../../ship/input/controllerMapping';

/**
 * Controller remapping screen
 * Allows users to customize VR controller button and stick mappings
 */
export class ControlsScreen {
    private config: ControllerMappingConfig;
    private messageDiv: HTMLElement | null = null;

    constructor() {
        this.config = ControllerMappingConfig.getInstance();
    }

    /**
     * Initialize the controls screen
     * Set up event listeners and populate form with current configuration
     */
    public initialize(): void {
        console.log('[ControlsScreen] Initializing');

        // Get form elements
        this.messageDiv = document.getElementById('controlsMessage');

        // Populate dropdowns
        this.populateDropdowns();

        // Load current configuration into form
        this.loadCurrentMapping();

        // Set up event listeners
        this.setupEventListeners();

        console.log('[ControlsScreen] Initialized');
    }

    /**
     * Populate all dropdown select elements with available actions
     */
    private populateDropdowns(): void {
        // Stick action dropdowns
        const stickSelects = [
            'leftStickX', 'leftStickY',
            'rightStickX', 'rightStickY'
        ];

        const stickActions = ControllerMappingConfig.getAvailableStickActions();

        stickSelects.forEach(id => {
            const select = document.getElementById(id) as HTMLSelectElement;
            if (select) {
                select.innerHTML = '';
                stickActions.forEach(action => {
                    const option = document.createElement('option');
                    option.value = action;
                    option.textContent = ControllerMappingConfig.getStickActionLabel(action);
                    select.appendChild(option);
                });
            }
        });

        // Button action dropdowns
        const buttonSelects = [
            'trigger', 'aButton', 'bButton',
            'xButton', 'yButton', 'squeeze'
        ];

        const buttonActions = ControllerMappingConfig.getAvailableButtonActions();

        buttonSelects.forEach(id => {
            const select = document.getElementById(id) as HTMLSelectElement;
            if (select) {
                select.innerHTML = '';
                buttonActions.forEach(action => {
                    const option = document.createElement('option');
                    option.value = action;
                    option.textContent = ControllerMappingConfig.getButtonActionLabel(action);
                    select.appendChild(option);
                });
            }
        });
    }

    /**
     * Load current mapping configuration into form elements
     */
    private loadCurrentMapping(): void {
        const mapping = this.config.getMapping();

        // Stick mappings
        this.setSelectValue('leftStickX', mapping.leftStickX);
        this.setSelectValue('leftStickY', mapping.leftStickY);
        this.setSelectValue('rightStickX', mapping.rightStickX);
        this.setSelectValue('rightStickY', mapping.rightStickY);

        // Inversion checkboxes
        this.setCheckboxValue('invertLeftStickX', mapping.invertLeftStickX);
        this.setCheckboxValue('invertLeftStickY', mapping.invertLeftStickY);
        this.setCheckboxValue('invertRightStickX', mapping.invertRightStickX);
        this.setCheckboxValue('invertRightStickY', mapping.invertRightStickY);

        // Button mappings
        this.setSelectValue('trigger', mapping.trigger);
        this.setSelectValue('aButton', mapping.aButton);
        this.setSelectValue('bButton', mapping.bButton);
        this.setSelectValue('xButton', mapping.xButton);
        this.setSelectValue('yButton', mapping.yButton);
        this.setSelectValue('squeeze', mapping.squeeze);

        console.log('[ControlsScreen] Loaded current mapping into form');
    }

    /**
     * Set up event listeners for buttons
     */
    private setupEventListeners(): void {
        // Save button
        const saveBtn = document.getElementById('saveControlsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveMapping());
        }

        // Reset button
        const resetBtn = document.getElementById('resetControlsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetToDefault());
        }

        // Test button (shows current mapping preview)
        const testBtn = document.getElementById('testControlsBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.showTestPreview());
        }
    }

    /**
     * Save current form values to configuration
     */
    private saveMapping(): void {
        // Read all form values
        const mapping: ControllerMapping = {
            // Stick mappings
            leftStickX: this.getSelectValue('leftStickX') as StickAction,
            leftStickY: this.getSelectValue('leftStickY') as StickAction,
            rightStickX: this.getSelectValue('rightStickX') as StickAction,
            rightStickY: this.getSelectValue('rightStickY') as StickAction,

            // Inversions
            invertLeftStickX: this.getCheckboxValue('invertLeftStickX'),
            invertLeftStickY: this.getCheckboxValue('invertLeftStickY'),
            invertRightStickX: this.getCheckboxValue('invertRightStickX'),
            invertRightStickY: this.getCheckboxValue('invertRightStickY'),

            // Button mappings
            trigger: this.getSelectValue('trigger') as ButtonAction,
            aButton: this.getSelectValue('aButton') as ButtonAction,
            bButton: this.getSelectValue('bButton') as ButtonAction,
            xButton: this.getSelectValue('xButton') as ButtonAction,
            yButton: this.getSelectValue('yButton') as ButtonAction,
            squeeze: this.getSelectValue('squeeze') as ButtonAction,
        };

        // Validate
        this.config.setMapping(mapping);
        const warnings = this.config.validate();

        if (warnings.length > 0) {
            // Show warnings but still save
            this.showMessage(
                'Configuration saved with warnings:\n' + warnings.join('\n'),
                'warning'
            );
        } else {
            this.showMessage('Configuration saved successfully!', 'success');
        }

        // Save to localStorage
        this.config.save();

        console.log('[ControlsScreen] Saved mapping:', mapping);
    }

    /**
     * Reset form to default mapping
     */
    private resetToDefault(): void {
        if (confirm('Reset all controller mappings to default? This cannot be undone.')) {
            this.config.resetToDefault();
            this.config.save();
            this.loadCurrentMapping();
            this.showMessage('Reset to default configuration', 'success');
            console.log('[ControlsScreen] Reset to defaults');
        }
    }

    /**
     * Show test preview of current mapping
     */
    private showTestPreview(): void {
        const mapping = this.readCurrentFormValues();

        let preview = 'Current Controller Mapping:\n\n';

        preview += '📋 STICK MAPPINGS:\n';
        preview += `  Left Stick X: ${ControllerMappingConfig.getStickActionLabel(mapping.leftStickX)}`;
        preview += mapping.invertLeftStickX ? ' (Inverted)\n' : '\n';
        preview += `  Left Stick Y: ${ControllerMappingConfig.getStickActionLabel(mapping.leftStickY)}`;
        preview += mapping.invertLeftStickY ? ' (Inverted)\n' : '\n';
        preview += `  Right Stick X: ${ControllerMappingConfig.getStickActionLabel(mapping.rightStickX)}`;
        preview += mapping.invertRightStickX ? ' (Inverted)\n' : '\n';
        preview += `  Right Stick Y: ${ControllerMappingConfig.getStickActionLabel(mapping.rightStickY)}`;
        preview += mapping.invertRightStickY ? ' (Inverted)\n' : '\n';

        preview += '\n🎮 BUTTON MAPPINGS:\n';
        preview += `  Trigger: ${ControllerMappingConfig.getButtonActionLabel(mapping.trigger)}\n`;
        preview += `  A Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.aButton)}\n`;
        preview += `  B Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.bButton)}\n`;
        preview += `  X Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.xButton)}\n`;
        preview += `  Y Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.yButton)}\n`;
        preview += `  Squeeze/Grip: ${ControllerMappingConfig.getButtonActionLabel(mapping.squeeze)}\n`;

        alert(preview);
    }

    /**
     * Read current form values into a mapping object
     */
    private readCurrentFormValues(): ControllerMapping {
        return {
            leftStickX: this.getSelectValue('leftStickX') as StickAction,
            leftStickY: this.getSelectValue('leftStickY') as StickAction,
            rightStickX: this.getSelectValue('rightStickX') as StickAction,
            rightStickY: this.getSelectValue('rightStickY') as StickAction,
            invertLeftStickX: this.getCheckboxValue('invertLeftStickX'),
            invertLeftStickY: this.getCheckboxValue('invertLeftStickY'),
            invertRightStickX: this.getCheckboxValue('invertRightStickX'),
            invertRightStickY: this.getCheckboxValue('invertRightStickY'),
            trigger: this.getSelectValue('trigger') as ButtonAction,
            aButton: this.getSelectValue('aButton') as ButtonAction,
            bButton: this.getSelectValue('bButton') as ButtonAction,
            xButton: this.getSelectValue('xButton') as ButtonAction,
            yButton: this.getSelectValue('yButton') as ButtonAction,
            squeeze: this.getSelectValue('squeeze') as ButtonAction,
        };
    }

    /**
     * Show a message to the user
     */
    private showMessage(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
        if (this.messageDiv) {
            this.messageDiv.textContent = message;
            this.messageDiv.className = `controls-message ${type}`;
            this.messageDiv.style.display = 'block';

            // Hide after 5 seconds
            setTimeout(() => {
                if (this.messageDiv) {
                    this.messageDiv.style.display = 'none';
                }
            }, 5000);
        }
    }

    // Helper methods for form manipulation
    private setSelectValue(id: string, value: string): void {
        const select = document.getElementById(id) as HTMLSelectElement;
        if (select) {
            select.value = value;
        }
    }

    private getSelectValue(id: string): string {
        const select = document.getElementById(id) as HTMLSelectElement;
        return select ? select.value : '';
    }

    private setCheckboxValue(id: string, checked: boolean): void {
        const checkbox = document.getElementById(id) as HTMLInputElement;
        if (checkbox) {
            checkbox.checked = checked;
        }
    }

    private getCheckboxValue(id: string): boolean {
        const checkbox = document.getElementById(id) as HTMLInputElement;
        return checkbox ? checkbox.checked : false;
    }
}
