import { GameConfig, TextureLevel } from "./gameConfig";

/**
 * Initialize the settings screen
 */
export function initializeSettingsScreen(): void {
    const config = GameConfig.getInstance();

    // Get form elements
    const planetTextureSelect = document.getElementById('planetTextureLevel') as HTMLSelectElement;
    const asteroidTextureSelect = document.getElementById('asteroidTextureLevel') as HTMLSelectElement;
    const sunTextureSelect = document.getElementById('sunTextureLevel') as HTMLSelectElement;
    const physicsEnabledCheckbox = document.getElementById('physicsEnabled') as HTMLInputElement;
    const debugEnabledCheckbox = document.getElementById('debugEnabled') as HTMLInputElement;

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
        if (planetTextureSelect) planetTextureSelect.value = config.planetTextureLevel;
        if (asteroidTextureSelect) asteroidTextureSelect.value = config.asteroidTextureLevel;
        if (sunTextureSelect) sunTextureSelect.value = config.sunTextureLevel;
        if (physicsEnabledCheckbox) physicsEnabledCheckbox.checked = config.physicsEnabled;
        if (debugEnabledCheckbox) debugEnabledCheckbox.checked = config.debug;
    }

    /**
     * Save form settings to GameConfig
     */
    function saveSettings(): void {
        config.planetTextureLevel = planetTextureSelect.value as TextureLevel;
        config.asteroidTextureLevel = asteroidTextureSelect.value as TextureLevel;
        config.sunTextureLevel = sunTextureSelect.value as TextureLevel;
        config.physicsEnabled = physicsEnabledCheckbox.checked;
        config.debug = debugEnabledCheckbox.checked;
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
