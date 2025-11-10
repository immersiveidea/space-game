import { getSavedLevels } from "./levelEditor";
import { LevelConfig } from "./levelConfig";
import { ProgressionManager } from "./progression";
import { GameConfig } from "./gameConfig";
import debugLog from './debug';

const SELECTED_LEVEL_KEY = 'space-game-selected-level';

/**
 * Populate the level selection screen with saved levels
 * Shows default levels and custom levels with progression tracking
 */
export function populateLevelSelector(): boolean {
    const container = document.getElementById('levelCardsContainer');
    if (!container) {
        console.warn('Level cards container not found');
        return false;
    }

    const savedLevels = getSavedLevels();
    const gameConfig = GameConfig.getInstance();
    const progressionEnabled = gameConfig.progressionEnabled;
    const progression = ProgressionManager.getInstance();

    if (savedLevels.size === 0) {
        container.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 40px 20px;
                color: #ccc;
            ">
                <h2 style="margin-bottom: 20px;">No Levels Found</h2>
                <p style="margin-bottom: 30px;">Something went wrong - default levels should be auto-generated!</p>
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

    // Separate default and custom levels
    const defaultLevels = new Map<string, LevelConfig>();
    const customLevels = new Map<string, LevelConfig>();

    for (const [name, config] of savedLevels.entries()) {
        if (config.metadata?.type === 'default') {
            defaultLevels.set(name, config);
        } else {
            customLevels.set(name, config);
        }
    }

    let html = '';

    // Show progression stats only if progression is enabled
    if (progressionEnabled) {
        const completedCount = progression.getCompletedCount();
        const totalCount = progression.getTotalDefaultLevels();
        const completionPercent = progression.getCompletionPercentage();
        const nextLevel = progression.getNextLevel();

        html += `
            <div style="
                grid-column: 1 / -1;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid rgba(102, 126, 234, 0.3);
            ">
                <h3 style="margin: 0 0 10px 0; color: #fff;">Progress</h3>
                <div style="color: #ccc; margin-bottom: 10px;">
                    ${completedCount} of ${totalCount} default levels completed (${completionPercent.toFixed(0)}%)
                </div>
                <div style="
                    width: 100%;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 5px;
                    overflow: hidden;
                ">
                    <div style="
                        width: ${completionPercent}%;
                        height: 100%;
                        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                        transition: width 0.3s ease;
                    "></div>
                </div>
                ${nextLevel ? `<div style="color: #888; margin-top: 10px; font-size: 0.9em;">Next: ${nextLevel}</div>` : ''}
            </div>
        `;
    }

    // Default levels section - show all levels if progression disabled, or current/next if enabled
    if (defaultLevels.size > 0) {
        html += `
            <div style="grid-column: 1 / -1; margin: 20px 0 10px 0;">
                <h3 style="color: #fff; margin: 0;">Available Levels</h3>
            </div>
        `;

        // If progression is disabled, just show all default levels
        if (!progressionEnabled) {
            for (const [name, config] of defaultLevels.entries()) {
                const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
                const estimatedTime = config.metadata?.estimatedTime || '';

                html += `
                    <div class="level-card">
                        <h2 style="margin: 0;">${name}</h2>
                        <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                            Difficulty: ${config.difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                        </div>
                        <p style="margin: 10px 0;">${description}</p>
                        <button class="level-button" data-level="${name}">Play Level</button>
                    </div>
                `;
            }
        } else {
            // Progression enabled - show current and next level only
            // Get the default level names in order
            const defaultLevelNames = [
                'Tutorial: Asteroid Field',
                'Rescue Mission',
                'Deep Space Patrol',
                'Enemy Territory',
                'The Gauntlet',
                'Final Challenge'
            ];

            // Find current level (last completed or first if none completed)
            let currentLevelName: string | null = null;
            let nextLevelName: string | null = null;

            // Find the first incomplete level (this is the "next" level)
            for (let i = 0; i < defaultLevelNames.length; i++) {
                const levelName = defaultLevelNames[i];
                if (!progression.isLevelComplete(levelName)) {
                    nextLevelName = levelName;
                    // Current level is the one before (if it exists)
                    if (i > 0) {
                        currentLevelName = defaultLevelNames[i - 1];
                    }
                    break;
                }
            }

            // If all levels complete, show the last level as current
            if (!nextLevelName) {
                currentLevelName = defaultLevelNames[defaultLevelNames.length - 1];
            }

        // If no levels completed yet, show first as next (no current)
        if (!currentLevelName && nextLevelName) {
            // First time player - just show the first level
            const config = defaultLevels.get(nextLevelName);
            if (config) {
                const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
                const estimatedTime = config.metadata?.estimatedTime || '';

                html += `
                    <div class="level-card" style="border: 2px solid #667eea; box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <h2 style="margin: 0;">${nextLevelName}</h2>
                            <div style="font-size: 0.8em; background: #667eea; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold;">START HERE</div>
                        </div>
                        <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                            Difficulty: ${config.difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                        </div>
                        <p style="margin: 10px 0;">${description}</p>
                        <button class="level-button" data-level="${nextLevelName}">Play Level</button>
                    </div>
                `;
            }
        } else {
            // Show current (completed) level
            if (currentLevelName) {
                const config = defaultLevels.get(currentLevelName);
                if (config) {
                    const levelProgress = progression.getLevelProgress(currentLevelName);
                    const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
                    const estimatedTime = config.metadata?.estimatedTime || '';

                    html += `
                        <div class="level-card">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <h2 style="margin: 0;">${currentLevelName}</h2>
                                <div style="font-size: 1.5em; color: #4ade80;">✓</div>
                            </div>
                            <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                                Difficulty: ${config.difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                            </div>
                            <p style="margin: 10px 0;">${description}</p>
                            ${levelProgress?.playCount ? `<div style="font-size: 0.8em; color: #888; margin-bottom: 10px;">Played ${levelProgress.playCount} time${levelProgress.playCount > 1 ? 's' : ''}</div>` : ''}
                            <button class="level-button" data-level="${currentLevelName}">Play Again</button>
                        </div>
                    `;
                }
            }

            // Show next level if it exists
            if (nextLevelName) {
                const config = defaultLevels.get(nextLevelName);
                if (config) {
                    const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
                    const estimatedTime = config.metadata?.estimatedTime || '';

                    html += `
                        <div class="level-card" style="border: 2px solid #667eea; box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <h2 style="margin: 0;">${nextLevelName}</h2>
                                <div style="font-size: 0.8em; background: #667eea; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold;">NEXT</div>
                            </div>
                            <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                                Difficulty: ${config.difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                            </div>
                            <p style="margin: 10px 0;">${description}</p>
                            <button class="level-button" data-level="${nextLevelName}">Play Level</button>
                        </div>
                    `;
                }
            }
        }

            // Show "more levels beyond" indicator if there are additional levels after next
            const nextLevelIndex = defaultLevelNames.indexOf(nextLevelName || '');
            const hasMoreLevels = nextLevelIndex >= 0 && nextLevelIndex < defaultLevelNames.length - 1;

            if (hasMoreLevels) {
                const remainingCount = defaultLevelNames.length - nextLevelIndex - 1;
                html += `
                    <div style="
                        grid-column: 1 / -1;
                        text-align: center;
                        padding: 30px;
                        color: #888;
                        font-size: 1.1em;
                        background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
                        border-radius: 10px;
                        border: 1px dashed rgba(102, 126, 234, 0.3);
                        margin-top: 10px;
                    ">
                        <div style="font-size: 2em; margin-bottom: 10px; opacity: 0.5;">✦ ✦ ✦</div>
                        <div style="font-weight: bold; color: #aaa;">
                            ${remainingCount} more level${remainingCount > 1 ? 's' : ''} beyond...
                        </div>
                        <div style="font-size: 0.9em; margin-top: 5px; color: #777;">
                            Complete challenges to unlock new missions
                        </div>
                    </div>
                `;
            }
        } // End of progressionEnabled else block
    }

    // Custom levels section
    if (customLevels.size > 0) {
        html += `
            <div style="grid-column: 1 / -1; margin: 30px 0 10px 0;">
                <h3 style="color: #fff; margin: 0;">Custom Levels</h3>
            </div>
        `;

        for (const [name, config] of customLevels.entries()) {
            const timestamp = config.timestamp ? new Date(config.timestamp).toLocaleDateString() : '';
            const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
            const author = config.metadata?.author || 'Unknown';

            html += `
                <div class="level-card">
                    <h2>${name}</h2>
                    <div style="font-size: 0.9em; color: #aaa; margin: 10px 0;">
                        Difficulty: ${config.difficulty} • By ${author}
                    </div>
                    <p>${description}</p>
                    ${timestamp ? `<div style="font-size: 0.8em; color: #888; margin-bottom: 10px;">Created ${timestamp}</div>` : ''}
                    <button class="level-button" data-level="${name}">Play Level</button>
                </div>
            `;
        }
    }

    // Editor unlock button (always unlocked if progression disabled)
    const isEditorUnlocked = !progressionEnabled || progression.isEditorUnlocked();
    const completedCount = progression.getCompletedCount();

    html += `
        <div style="grid-column: 1 / -1; margin-top: 20px; text-align: center;">
            ${isEditorUnlocked ? `
                <a href="#/editor" style="
                    display: inline-block;
                    padding: 15px 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 1.1em;
                    transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🎨 Create Custom Level
                </a>
            ` : `
                <div style="
                    padding: 15px 40px;
                    background: rgba(100, 100, 100, 0.3);
                    color: #888;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 1.1em;
                    display: inline-block;
                    cursor: not-allowed;
                " title="Complete ${progression.getTotalDefaultLevels() - progression.getCompletedCount()} more default level(s) to unlock">
                    🔒 Level Editor (Complete ${3 - completedCount} more level${(3 - completedCount) !== 1 ? 's' : ''})
                </div>
            `}
        </div>
    `;

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
