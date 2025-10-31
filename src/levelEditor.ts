import { LevelGenerator } from "./levelGenerator";
import { LevelConfig, DifficultyConfig, Vector3Array, validateLevelConfig } from "./levelConfig";
import debugLog from './debug';

const STORAGE_KEY = 'space-game-levels';

/**
 * Level Editor UI Controller
 * Handles the level editor interface and configuration generation
 */
class LevelEditor {
    private currentConfig: LevelConfig | null = null;
    private savedLevels: Map<string, LevelConfig> = new Map();

    constructor() {
        this.loadSavedLevels();
        this.setupEventListeners();
        this.loadPreset('captain'); // Default to captain difficulty
        this.renderSavedLevelsList();
    }

    private setupEventListeners() {
        // Preset buttons
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = (e.target as HTMLButtonElement).dataset.difficulty;
                this.loadPreset(difficulty);

                // Update active state
                presetButtons.forEach(b => b.classList.remove('active'));
                (e.target as HTMLElement).classList.add('active');
            });
        });

        // Difficulty dropdown
        const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;
        difficultySelect.addEventListener('change', (e) => {
            this.loadPreset((e.target as HTMLSelectElement).value);
        });

        // Generate button - now saves to localStorage
        document.getElementById('generateBtn')?.addEventListener('click', () => {
            this.generateLevel();
            this.saveToLocalStorage();
        });

        // Download button
        document.getElementById('downloadBtn')?.addEventListener('click', () => {
            this.downloadJSON();
        });

        // Copy button
        document.getElementById('copyBtn')?.addEventListener('click', () => {
            this.copyToClipboard();
        });

        // Save edited JSON button
        document.getElementById('saveEditedJsonBtn')?.addEventListener('click', () => {
            this.saveEditedJSON();
        });

        // Validate JSON button
        document.getElementById('validateJsonBtn')?.addEventListener('click', () => {
            this.validateJSON();
        });
    }

    /**
     * Load saved levels from localStorage
     */
    private loadSavedLevels(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const levelsArray: [string, LevelConfig][] = JSON.parse(stored);
                this.savedLevels = new Map(levelsArray);
                debugLog(`Loaded ${this.savedLevels.size} saved levels from localStorage`);
            }
        } catch (error) {
            console.error('Failed to load saved levels:', error);
            this.savedLevels = new Map();
        }
    }

    /**
     * Save current level to localStorage
     */
    private saveToLocalStorage(): void {
        if (!this.currentConfig) {
            alert('Please generate a level configuration first!');
            return;
        }

        const levelName = (document.getElementById('levelName') as HTMLInputElement).value ||
                         `${this.currentConfig.difficulty}-${Date.now()}`;

        // Save to map
        this.savedLevels.set(levelName, this.currentConfig);

        // Convert Map to array for storage
        const levelsArray = Array.from(this.savedLevels.entries());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(levelsArray));

        debugLog(`Saved level: ${levelName}`);
        this.renderSavedLevelsList();

        // Show feedback
        const feedback = document.createElement('div');
        feedback.textContent = `✓ Saved "${levelName}" to local storage`;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(feedback);
        setTimeout(() => {
            feedback.remove();
        }, 3000);
    }

    /**
     * Delete a saved level
     */
    private deleteSavedLevel(levelName: string): void {
        if (confirm(`Delete "${levelName}"?`)) {
            this.savedLevels.delete(levelName);
            const levelsArray = Array.from(this.savedLevels.entries());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(levelsArray));
            this.renderSavedLevelsList();
            debugLog(`Deleted level: ${levelName}`);
        }
    }

    /**
     * Load a saved level into the editor
     */
    private loadSavedLevel(levelName: string): void {
        const config = this.savedLevels.get(levelName);
        if (!config) {
            alert('Level not found!');
            return;
        }

        this.currentConfig = config;

        // Populate form with saved values
        (document.getElementById('levelName') as HTMLInputElement).value = levelName;
        (document.getElementById('difficulty') as HTMLSelectElement).value = config.difficulty;

        if (config.metadata?.author) {
            (document.getElementById('author') as HTMLInputElement).value = config.metadata.author;
        }
        if (config.metadata?.description) {
            (document.getElementById('description') as HTMLInputElement).value = config.metadata.description;
        }

        // Ship
        (document.getElementById('shipX') as HTMLInputElement).value = config.ship.position[0].toString();
        (document.getElementById('shipY') as HTMLInputElement).value = config.ship.position[1].toString();
        (document.getElementById('shipZ') as HTMLInputElement).value = config.ship.position[2].toString();

        // Start base
        (document.getElementById('baseX') as HTMLInputElement).value = config.startBase.position[0].toString();
        (document.getElementById('baseY') as HTMLInputElement).value = config.startBase.position[1].toString();
        (document.getElementById('baseZ') as HTMLInputElement).value = config.startBase.position[2].toString();
        (document.getElementById('baseDiameter') as HTMLInputElement).value = config.startBase.diameter.toString();
        (document.getElementById('baseHeight') as HTMLInputElement).value = config.startBase.height.toString();

        // Sun
        (document.getElementById('sunX') as HTMLInputElement).value = config.sun.position[0].toString();
        (document.getElementById('sunY') as HTMLInputElement).value = config.sun.position[1].toString();
        (document.getElementById('sunZ') as HTMLInputElement).value = config.sun.position[2].toString();
        (document.getElementById('sunDiameter') as HTMLInputElement).value = config.sun.diameter.toString();

        // Planets
        (document.getElementById('planetCount') as HTMLInputElement).value = config.planets.length.toString();

        // Asteroids (use difficulty config if available)
        if (config.difficultyConfig) {
            (document.getElementById('asteroidCount') as HTMLInputElement).value = config.difficultyConfig.rockCount.toString();
            (document.getElementById('forceMultiplier') as HTMLInputElement).value = config.difficultyConfig.forceMultiplier.toString();
            (document.getElementById('asteroidMinSize') as HTMLInputElement).value = config.difficultyConfig.rockSizeMin.toString();
            (document.getElementById('asteroidMaxSize') as HTMLInputElement).value = config.difficultyConfig.rockSizeMax.toString();
            (document.getElementById('asteroidMinDist') as HTMLInputElement).value = config.difficultyConfig.distanceMin.toString();
            (document.getElementById('asteroidMaxDist') as HTMLInputElement).value = config.difficultyConfig.distanceMax.toString();
        }

        // Display the JSON
        this.displayJSON();

        debugLog(`Loaded level: ${levelName}`);
    }

    /**
     * Render the list of saved levels
     */
    private renderSavedLevelsList(): void {
        const container = document.getElementById('savedLevelsList');
        if (!container) return;

        if (this.savedLevels.size === 0) {
            container.innerHTML = '<p style="color: #888; font-style: italic;">No saved levels yet. Generate a level to save it.</p>';
            return;
        }

        let html = '<div style="display: grid; gap: 10px;">';

        for (const [name, config] of this.savedLevels.entries()) {
            const timestamp = config.timestamp ? new Date(config.timestamp).toLocaleString() : 'Unknown';
            html += `
                <div style="
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 5px;
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${name}</div>
                        <div style="font-size: 0.85em; color: #aaa;">
                            ${config.difficulty} • ${config.asteroids.length} asteroids • ${timestamp}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="load-level-btn" data-level="${name}" style="
                            padding: 6px 12px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 0.9em;
                        ">Load</button>
                        <button class="delete-level-btn" data-level="${name}" style="
                            padding: 6px 12px;
                            background: #f44336;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 0.9em;
                        ">Delete</button>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

        // Add event listeners to load/delete buttons
        container.querySelectorAll('.load-level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const levelName = (e.target as HTMLButtonElement).dataset.level;
                if (levelName) this.loadSavedLevel(levelName);
            });
        });

        container.querySelectorAll('.delete-level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const levelName = (e.target as HTMLButtonElement).dataset.level;
                if (levelName) this.deleteSavedLevel(levelName);
            });
        });
    }

    /**
     * Load a difficulty preset into the form
     */
    private loadPreset(difficulty: string) {
        const difficultyConfig = this.getDifficultyConfig(difficulty);

        // Update difficulty dropdown
        (document.getElementById('difficulty') as HTMLSelectElement).value = difficulty;

        // Update asteroid settings based on difficulty
        (document.getElementById('asteroidCount') as HTMLInputElement).value = difficultyConfig.rockCount.toString();
        (document.getElementById('forceMultiplier') as HTMLInputElement).value = difficultyConfig.forceMultiplier.toString();
        (document.getElementById('asteroidMinSize') as HTMLInputElement).value = difficultyConfig.rockSizeMin.toString();
        (document.getElementById('asteroidMaxSize') as HTMLInputElement).value = difficultyConfig.rockSizeMax.toString();
        (document.getElementById('asteroidMinDist') as HTMLInputElement).value = difficultyConfig.distanceMin.toString();
        (document.getElementById('asteroidMaxDist') as HTMLInputElement).value = difficultyConfig.distanceMax.toString();
    }

    /**
     * Get difficulty configuration
     */
    private getDifficultyConfig(difficulty: string): DifficultyConfig {
        switch (difficulty) {
            case 'recruit':
                return {
                    rockCount: 5,
                    forceMultiplier: .5,
                    rockSizeMin: 10,
                    rockSizeMax: 15,
                    distanceMin: 80,
                    distanceMax: 100
                };
            case 'pilot':
                return {
                    rockCount: 10,
                    forceMultiplier: 1,
                    rockSizeMin: 8,
                    rockSizeMax: 12,
                    distanceMin: 80,
                    distanceMax: 150
                };
            case 'captain':
                return {
                    rockCount: 20,
                    forceMultiplier: 1.2,
                    rockSizeMin: 2,
                    rockSizeMax: 7,
                    distanceMin: 100,
                    distanceMax: 250
                };
            case 'commander':
                return {
                    rockCount: 50,
                    forceMultiplier: 1.3,
                    rockSizeMin: 2,
                    rockSizeMax: 8,
                    distanceMin: 90,
                    distanceMax: 280
                };
            case 'test':
                return {
                    rockCount: 100,
                    forceMultiplier: 0.3,
                    rockSizeMin: 8,
                    rockSizeMax: 15,
                    distanceMin: 150,
                    distanceMax: 200
                };
            default:
                return {
                    rockCount: 5,
                    forceMultiplier: 1.0,
                    rockSizeMin: 4,
                    rockSizeMax: 8,
                    distanceMin: 170,
                    distanceMax: 220
                };
        }
    }

    /**
     * Read form values and generate level configuration
     */
    private generateLevel() {
        const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
        const levelName = (document.getElementById('levelName') as HTMLInputElement).value || difficulty;
        const author = (document.getElementById('author') as HTMLInputElement).value;
        const description = (document.getElementById('description') as HTMLInputElement).value;

        // Create a custom generator with modified parameters
        const generator = new CustomLevelGenerator(difficulty);

        // Override ship position
        generator.shipPosition = [
            parseFloat((document.getElementById('shipX') as HTMLInputElement).value),
            parseFloat((document.getElementById('shipY') as HTMLInputElement).value),
            parseFloat((document.getElementById('shipZ') as HTMLInputElement).value)
        ];

        // Override start base
        generator.startBasePosition = [
            parseFloat((document.getElementById('baseX') as HTMLInputElement).value),
            parseFloat((document.getElementById('baseY') as HTMLInputElement).value),
            parseFloat((document.getElementById('baseZ') as HTMLInputElement).value)
        ];
        generator.startBaseDiameter = parseFloat((document.getElementById('baseDiameter') as HTMLInputElement).value);
        generator.startBaseHeight = parseFloat((document.getElementById('baseHeight') as HTMLInputElement).value);

        // Override sun
        generator.sunPosition = [
            parseFloat((document.getElementById('sunX') as HTMLInputElement).value),
            parseFloat((document.getElementById('sunY') as HTMLInputElement).value),
            parseFloat((document.getElementById('sunZ') as HTMLInputElement).value)
        ];
        generator.sunDiameter = parseFloat((document.getElementById('sunDiameter') as HTMLInputElement).value);

        // Override planet generation params
        generator.planetCount = parseInt((document.getElementById('planetCount') as HTMLInputElement).value);
        generator.planetMinDiameter = parseFloat((document.getElementById('planetMinDiam') as HTMLInputElement).value);
        generator.planetMaxDiameter = parseFloat((document.getElementById('planetMaxDiam') as HTMLInputElement).value);
        generator.planetMinDistance = parseFloat((document.getElementById('planetMinDist') as HTMLInputElement).value);
        generator.planetMaxDistance = parseFloat((document.getElementById('planetMaxDist') as HTMLInputElement).value);

        // Override asteroid generation params
        const customDifficulty: DifficultyConfig = {
            rockCount: parseInt((document.getElementById('asteroidCount') as HTMLInputElement).value),
            forceMultiplier: parseFloat((document.getElementById('forceMultiplier') as HTMLInputElement).value),
            rockSizeMin: parseFloat((document.getElementById('asteroidMinSize') as HTMLInputElement).value),
            rockSizeMax: parseFloat((document.getElementById('asteroidMaxSize') as HTMLInputElement).value),
            distanceMin: parseFloat((document.getElementById('asteroidMinDist') as HTMLInputElement).value),
            distanceMax: parseFloat((document.getElementById('asteroidMaxDist') as HTMLInputElement).value)
        };
        generator.setDifficultyConfig(customDifficulty);

        // Generate the config
        this.currentConfig = generator.generate();

        // Add metadata
        if (author) {
            this.currentConfig.metadata = this.currentConfig.metadata || {};
            this.currentConfig.metadata.author = author;
        }
        if (description) {
            this.currentConfig.metadata = this.currentConfig.metadata || {};
            this.currentConfig.metadata.description = description;
        }

        // Display the JSON
        this.displayJSON();
    }

    /**
     * Display generated JSON in the output section
     */
    private displayJSON() {
        if (!this.currentConfig) return;

        const outputSection = document.getElementById('outputSection');
        const jsonEditor = document.getElementById('jsonEditor') as HTMLTextAreaElement;

        if (outputSection && jsonEditor) {
            const jsonString = JSON.stringify(this.currentConfig, null, 2);
            jsonEditor.value = jsonString;
            outputSection.style.display = 'block';

            // Scroll to output
            outputSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Validate the JSON in the editor
     */
    private validateJSON(): boolean {
        const jsonEditor = document.getElementById('jsonEditor') as HTMLTextAreaElement;
        const messageDiv = document.getElementById('jsonValidationMessage');

        if (!jsonEditor || !messageDiv) return false;

        try {
            const json = jsonEditor.value;
            const parsed = JSON.parse(json);

            // Validate against schema
            const validation = validateLevelConfig(parsed);

            if (validation.valid) {
                messageDiv.innerHTML = '<div style="color: #4CAF50; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">✓ JSON is valid!</div>';
                return true;
            } else {
                messageDiv.innerHTML = `<div style="color: #f44336; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 5px;">
                    <strong>Validation Errors:</strong><br>
                    ${validation.errors.map(e => `• ${e}`).join('<br>')}
                </div>`;
                return false;
            }
        } catch (error) {
            messageDiv.innerHTML = `<div style="color: #f44336; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 5px;">
                <strong>JSON Parse Error:</strong><br>
                ${error.message}
            </div>`;
            return false;
        }
    }

    /**
     * Save edited JSON from the editor
     */
    private saveEditedJSON() {
        const jsonEditor = document.getElementById('jsonEditor') as HTMLTextAreaElement;
        const messageDiv = document.getElementById('jsonValidationMessage');

        if (!jsonEditor) {
            alert('JSON editor not found!');
            return;
        }

        // First validate
        if (!this.validateJSON()) {
            messageDiv.innerHTML += '<div style="color: #ff9800; margin-top: 10px;">Please fix validation errors before saving.</div>';
            return;
        }

        try {
            const json = jsonEditor.value;
            const config = JSON.parse(json) as LevelConfig;

            // Update current config
            this.currentConfig = config;

            // Save to localStorage
            this.saveToLocalStorage();

            // Update message
            messageDiv.innerHTML = '<div style="color: #4CAF50; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">✓ Edited JSON saved successfully!</div>';

            debugLog('Saved edited JSON');
        } catch (error) {
            alert(`Failed to save: ${error.message}`);
        }
    }

    /**
     * Download the current configuration as JSON file
     */
    private downloadJSON() {
        if (!this.currentConfig) {
            alert('Please generate a level configuration first!');
            return;
        }

        const levelName = (document.getElementById('levelName') as HTMLInputElement).value ||
                         this.currentConfig.difficulty;
        const filename = `level-${levelName}-${Date.now()}.json`;

        const json = JSON.stringify(this.currentConfig, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        debugLog(`Downloaded: ${filename}`);
    }

    /**
     * Copy current configuration JSON to clipboard
     */
    private async copyToClipboard() {
        if (!this.currentConfig) {
            alert('Please generate a level configuration first!');
            return;
        }

        const json = JSON.stringify(this.currentConfig, null, 2);

        try {
            await navigator.clipboard.writeText(json);
            alert('JSON copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard. Please copy manually from the output.');
        }
    }
}

/**
 * Custom level generator that allows overriding default values
 * Simply extends LevelGenerator - all properties are now public on the base class
 */
class CustomLevelGenerator extends LevelGenerator {
    // No need to duplicate anything - just use the public properties from base class
    // Properties like shipPosition, startBasePosition, etc. are already defined and public in LevelGenerator
}

// Initialize the editor when this module is loaded
if (!(window as any).__levelEditorInstance) {
    (window as any).__levelEditorInstance = new LevelEditor();
}

/**
 * Helper to get all saved levels from localStorage
 */
export function getSavedLevels(): Map<string, LevelConfig> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const levelsArray: [string, LevelConfig][] = JSON.parse(stored);
            return new Map(levelsArray);
        }
    } catch (error) {
        console.error('Failed to load saved levels:', error);
    }
    return new Map();
}

/**
 * Helper to get a specific saved level by name
 */
export function getSavedLevel(name: string): LevelConfig | null {
    const levels = getSavedLevels();
    return levels.get(name) || null;
}

/**
 * Generate default levels if localStorage is empty
 * Creates 4 levels: recruit, pilot, captain, commander
 */
export function generateDefaultLevels(): void {
    const existing = getSavedLevels();
    if (existing.size > 0) {
        debugLog('Levels already exist in localStorage, skipping default generation');
        return;
    }

    debugLog('No saved levels found, generating 4 default levels...');

    const difficulties = ['recruit', 'pilot', 'captain', 'commander'];
    const levelsMap = new Map<string, LevelConfig>();

    for (const difficulty of difficulties) {
        const generator = new LevelGenerator(difficulty);
        const config = generator.generate();

        // Add metadata
        config.metadata = {
            author: 'System',
            description: `Default ${difficulty} level`
        };

        levelsMap.set(difficulty, config);
        debugLog(`Generated default level: ${difficulty}`);
    }

    // Save all levels to localStorage
    const levelsArray = Array.from(levelsMap.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levelsArray));

    debugLog('Default levels saved to localStorage');
}

// Export for manual initialization if needed
export { LevelEditor, CustomLevelGenerator };
