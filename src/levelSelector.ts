import { getSavedLevels } from "./levelEditor";
import { LevelConfig } from "./levelConfig";
import debugLog from './debug';

const SELECTED_LEVEL_KEY = 'space-game-selected-level';

/**
 * Populate the level selection screen with saved levels
 */
export function populateLevelSelector(): boolean {
    const container = document.getElementById('levelCardsContainer');
    if (!container) {
        console.warn('Level cards container not found');
        return false;
    }

    const savedLevels = getSavedLevels();

    // Filter to only show recruit and pilot difficulty levels
    const filteredLevels = new Map<string, LevelConfig>();
    for (const [name, config] of savedLevels.entries()) {
        if (config.difficulty === 'recruit' || config.difficulty === 'pilot') {
            filteredLevels.set(name, config);
        }
    }

    if (filteredLevels.size === 0) {
        container.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 40px 20px;
                color: #ccc;
            ">
                <h2 style="margin-bottom: 20px;">No Levels Found</h2>
                <p style="margin-bottom: 30px;">Create your first level to get started!</p>
                <a href="#/editor" style="
                    display: inline-block;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    font-size: 1.1em;
                ">Go to Level Editor</a>
            </div>
        `;
        return false;
    }

    // Create level cards
    let html = '';
    for (const [name, config] of filteredLevels.entries()) {
        const timestamp = config.timestamp ? new Date(config.timestamp).toLocaleDateString() : '';
        const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;

        html += `
            <div class="level-card">
                <h2>${name}</h2>
                <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                    Difficulty: ${config.difficulty}
                </div>
                <p>${description}</p>
                ${timestamp ? `<div style="font-size: 0.8em; color: #888; margin-bottom: 10px;">${timestamp}</div>` : ''}
                <button class="level-button" data-level="${name}">Play Level</button>
            </div>
        `;
    }

    container.innerHTML = html;

    // Add event listeners to level buttons
    container.querySelectorAll('.level-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const levelName = (e.target as HTMLButtonElement).dataset.level;
            if (levelName) {
                selectLevel(levelName);
            }
        });
    });

    return true;
}

/**
 * Initialize level button listeners (for any dynamically created buttons)
 */
export function initializeLevelButtons(): void {
    document.querySelectorAll('.level-button').forEach(button => {
        if (!button.hasAttribute('data-listener-attached')) {
            button.setAttribute('data-listener-attached', 'true');
            button.addEventListener('click', (e) => {
                const levelName = (e.target as HTMLButtonElement).dataset.level;
                if (levelName) {
                    selectLevel(levelName);
                }
            });
        }
    });
}

/**
 * Select a level and store it for Level1 to use
 */
export function selectLevel(levelName: string): void {
    const savedLevels = getSavedLevels();
    const config = savedLevels.get(levelName);

    if (!config) {
        console.error(`Level "${levelName}" not found`);
        alert(`Level "${levelName}" not found!`);
        return;
    }

    // Store selected level name
    sessionStorage.setItem(SELECTED_LEVEL_KEY, levelName);

    debugLog(`Selected level: ${levelName}`);

    // Trigger level start (the existing code will pick this up)
    const event = new CustomEvent('levelSelected', { detail: { levelName, config } });
    window.dispatchEvent(event);
}

/**
 * Get the currently selected level configuration
 */
export function getSelectedLevel(): { name: string, config: LevelConfig } | null {
    const levelName = sessionStorage.getItem(SELECTED_LEVEL_KEY);
    if (!levelName) return null;

    const savedLevels = getSavedLevels();
    const config = savedLevels.get(levelName);

    if (!config) return null;

    return { name: levelName, config };
}

/**
 * Clear the selected level
 */
export function clearSelectedLevel(): void {
    sessionStorage.removeItem(SELECTED_LEVEL_KEY);
}

/**
 * Check if there are any saved levels
 */
export function hasSavedLevels(): boolean {
    const savedLevels = getSavedLevels();
    return savedLevels.size > 0;
}
