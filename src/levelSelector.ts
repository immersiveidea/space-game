import { getSavedLevels } from "./levelEditor";
import { LevelConfig } from "./levelConfig";
import { ProgressionManager } from "./progression";
import { GameConfig } from "./gameConfig";
import { AuthService } from "./authService";
import debugLog from './debug';

const SELECTED_LEVEL_KEY = 'space-game-selected-level';

// Default level order for the carousel
const DEFAULT_LEVEL_ORDER = [
    'Rookie Training',
    'Rescue Mission',
    'Deep Space Patrol',
    'Enemy Territory',
    'The Gauntlet',
    'Final Challenge'
];

/**
 * Populate the level selection screen with saved levels
 * Shows all 6 default levels in a 3x2 carousel with locked/unlocked states
 */
export async function populateLevelSelector(): Promise<boolean> {
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
            <div class="no-levels-message">
                <h2>No Levels Found</h2>
                <p>Something went wrong - default levels should be auto-generated!</p>
                <a href="#/editor" class="btn-primary">Go to Level Editor</a>
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
            <div class="progress-bar-container" style="grid-column: 1 / -1;">
                <h3 class="progress-bar-title">Progress</h3>
                <div class="level-description">
                    ${completedCount} of ${totalCount} default levels completed (${completionPercent.toFixed(0)}%)
                </div>
                <div class="progress-bar-track">
                    <div class="progress-fill" style="width: ${completionPercent}%;"></div>
                </div>
                ${nextLevel ? `<div class="progress-percentage">Next: ${nextLevel}</div>` : ''}
            </div>
        `;
    }

    // Check if user is authenticated (ASYNC!)
    const authService = AuthService.getInstance();
    const isAuthenticated = await authService.isAuthenticated();
    const isTutorial = (levelName: string) => levelName === DEFAULT_LEVEL_ORDER[0];

    debugLog('[LevelSelector] Authenticated:', isAuthenticated);
    debugLog('[LevelSelector] Progression enabled:', progressionEnabled);
    debugLog('[LevelSelector] Tutorial level name:', DEFAULT_LEVEL_ORDER[0]);
    debugLog('[LevelSelector] Default levels count:', defaultLevels.size);
    debugLog('[LevelSelector] Default level names:', Array.from(defaultLevels.keys()));

    // Show all 6 default levels in order (3x2 grid)
    if (defaultLevels.size > 0) {
        for (const levelName of DEFAULT_LEVEL_ORDER) {
            const config = defaultLevels.get(levelName);

            if (!config) {
                // Level doesn't exist - show empty slot
                html += `
                    <div class="level-card level-card-locked">
                        <div class="level-card-header">
                            <h2 class="level-card-title">${levelName}</h2>
                            <div class="level-card-status level-card-status-locked">🔒</div>
                        </div>
                        <div class="level-meta">Level not found</div>
                        <p class="level-card-description">This level has not been created yet.</p>
                        <button class="level-button" disabled>Locked</button>
                    </div>
                `;
                continue;
            }

            const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
            const estimatedTime = config.metadata?.estimatedTime || '';
            const isCompleted = progressionEnabled && progression.isLevelComplete(levelName);

            // Check if level is unlocked:
            // - Tutorial is always unlocked
            // - If authenticated: check progression unlock status
            // - If not authenticated: only Tutorial is unlocked
            let isUnlocked = false;
            const isTut = isTutorial(levelName);

            if (isTut) {
                isUnlocked = true; // Tutorial always unlocked
                debugLog(`[LevelSelector] ${levelName}: Tutorial - always unlocked`);
            } else if (!isAuthenticated) {
                isUnlocked = false; // Non-tutorial levels require authentication
                debugLog(`[LevelSelector] ${levelName}: Not authenticated - locked`);
            } else {
                isUnlocked = !progressionEnabled || progression.isLevelUnlocked(levelName);
                debugLog(`[LevelSelector] ${levelName}: Authenticated - unlocked:`, isUnlocked);
            }

            const isCurrentNext = progressionEnabled && progression.getNextLevel() === levelName;

            // Determine card state
            let cardClasses = 'level-card';
            let statusIcon = '';
            let buttonText = 'Play Level';
            let buttonDisabled = '';
            let lockReason = '';

            if (isCompleted) {
                cardClasses += ' level-card-completed';
                statusIcon = '<div class="level-card-status level-card-status-complete">✓</div>';
                buttonText = 'Replay';
            } else if (isCurrentNext && isUnlocked) {
                cardClasses += ' level-card-current';
                statusIcon = '<div class="level-card-badge">START HERE</div>';
            } else if (!isUnlocked) {
                cardClasses += ' level-card-locked';
                statusIcon = '<div class="level-card-status level-card-status-locked">🔒</div>';

                // Determine why it's locked
                if (!isAuthenticated && !isTutorial(levelName)) {
                    buttonText = 'Sign In Required';
                    lockReason = '<div class="level-lock-reason">Sign in to unlock</div>';
                } else if (progressionEnabled) {
                    const levelIndex = DEFAULT_LEVEL_ORDER.indexOf(levelName);
                    if (levelIndex > 0) {
                        const previousLevel = DEFAULT_LEVEL_ORDER[levelIndex - 1];
                        lockReason = `<div class="level-lock-reason">Complete "${previousLevel}" to unlock</div>`;
                    }
                    buttonText = 'Locked';
                } else {
                    buttonText = 'Locked';
                }
                buttonDisabled = ' disabled';
            }

            html += `
                <div class="${cardClasses}">
                    <div class="level-card-header">
                        <h2 class="level-card-title">${levelName}</h2>
                        ${statusIcon}
                    </div>
                    <div class="level-meta">
                        Difficulty: ${config.difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                    </div>
                    <p class="level-card-description">${description}</p>
                    ${lockReason}
                    <button class="level-button" data-level="${levelName}"${buttonDisabled}>${buttonText}</button>
                </div>
            `;
        }
    }

    // Show custom levels section if any exist
    if (customLevels.size > 0) {
        html += `
            <div style="grid-column: 1 / -1; margin-top: var(--space-2xl);">
                <h3 class="level-header">Custom Levels</h3>
            </div>
        `;

        for (const [name, config] of customLevels.entries()) {
            const description = config.metadata?.description || `${config.asteroids.length} asteroids • ${config.planets.length} planets`;
            const author = config.metadata?.author ? ` by ${config.metadata.author}` : '';

            html += `
                <div class="level-card">
                    <div class="level-card-header">
                        <h2 class="level-card-title">${name}</h2>
                    </div>
                    <div class="level-meta">
                        Custom${author} • ${config.difficulty}
                    </div>
                    <p class="level-card-description">${description}</p>
                    <button class="level-button" data-level="${name}">Play Level</button>
                </div>
            `;
        }
    }

    container.innerHTML = html;

    // Attach event listeners to all level buttons
    const buttons = container.querySelectorAll('.level-button:not([disabled])');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            const levelName = target.getAttribute('data-level');
            if (levelName) {
                selectLevel(levelName);
            }
        });
    });

    return true;
}

/**
 * Select a level and dispatch event to start it
 */
export function selectLevel(levelName: string): void {
    debugLog(`[LevelSelector] Level selected: ${levelName}`);

    const savedLevels = getSavedLevels();
    const config = savedLevels.get(levelName);

    if (!config) {
        console.error(`Level not found: ${levelName}`);
        return;
    }

    // Save selected level
    localStorage.setItem(SELECTED_LEVEL_KEY, levelName);

    // Dispatch custom event that Main class will listen for
    const event = new CustomEvent('levelSelected', {
        detail: { levelName, config }
    });
    window.dispatchEvent(event);
}

/**
 * Get the last selected level name
 */
export function getSelectedLevel(): string | null {
    return localStorage.getItem(SELECTED_LEVEL_KEY);
}
