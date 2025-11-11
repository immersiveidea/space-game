import { GameConfig } from "../../core/gameConfig";

/**
 * Initialize the settings screen
 */
export function initializeSettingsScreen(): void {
    const config = GameConfig.getInstance();

    // Get form elements
    const physicsEnabledCheckbox = document.getElementById('physicsEnabled') as HTMLInputElement;
    const debugEnabledCheckbox = document.getElementById('debugEnabled') as HTMLInputElement;

    // Ship physics inputs
    const maxLinearVelocityInput = document.getElementById('maxLinearVelocity') as HTMLInputElement;
    const maxAngularVelocityInput = document.getElementById('maxAngularVelocity') as HTMLInputElement;
    const linearForceMultiplierInput = document.getElementById('linearForceMultiplier') as HTMLInputElement;
    const angularForceMultiplierInput = document.getElementById('angularForceMultiplier') as HTMLInputElement;

    const saveBtn = document.getElementById('saveSettingsBtn');
    const resetBtn = document.getElementById('resetSettingsBtn');
    const messageDiv = document.getElementById('settingsMessage');

    // Load current settings
    loadSettings();

    // Save button handler
    saveBtn?.addEventListener('click', () => {
        saveSettings();
        showMessage('Settings saved successfully!', 'success');
    });

    // Reset button handler
    resetBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            config.reset();
            loadSettings();
            showMessage('Settings reset to defaults', 'info');
        }
    });

    /**
     * Load current settings into form
     */
    function loadSettings(): void {
        if (physicsEnabledCheckbox) physicsEnabledCheckbox.checked = config.physicsEnabled;
        if (debugEnabledCheckbox) debugEnabledCheckbox.checked = config.debug;

        // Load ship physics settings
        if (maxLinearVelocityInput) maxLinearVelocityInput.value = config.shipPhysics.maxLinearVelocity.toString();
        if (maxAngularVelocityInput) maxAngularVelocityInput.value = config.shipPhysics.maxAngularVelocity.toString();
        if (linearForceMultiplierInput) linearForceMultiplierInput.value = config.shipPhysics.linearForceMultiplier.toString();
        if (angularForceMultiplierInput) angularForceMultiplierInput.value = config.shipPhysics.angularForceMultiplier.toString();
    }

    /**
     * Save form settings to GameConfig
     */
    function saveSettings(): void {
        config.physicsEnabled = physicsEnabledCheckbox.checked;
        config.debug = debugEnabledCheckbox.checked;

        // Save ship physics settings
        config.shipPhysics.maxLinearVelocity = parseFloat(maxLinearVelocityInput.value);
        config.shipPhysics.maxAngularVelocity = parseFloat(maxAngularVelocityInput.value);
        config.shipPhysics.linearForceMultiplier = parseFloat(linearForceMultiplierInput.value);
        config.shipPhysics.angularForceMultiplier = parseFloat(angularForceMultiplierInput.value);

        config.save();
    }

    /**
     * Show a temporary message
     */
    function showMessage(message: string, type: 'success' | 'info' | 'warning'): void {
        if (!messageDiv) return;

        const colors = {
            success: '#4CAF50',
            info: '#2196F3',
            warning: '#FF9800'
        };

        messageDiv.textContent = message;
        messageDiv.style.color = colors[type];
        messageDiv.style.opacity = '1';

        setTimeout(() => {
            messageDiv.style.opacity = '0';
        }, 3000);
    }
}
