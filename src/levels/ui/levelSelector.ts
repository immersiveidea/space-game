import {LevelConfig} from "../config/levelConfig";
import {ProgressionManager} from "../../game/progression";
import {GameConfig} from "../../core/gameConfig";
import {AuthService} from "../../services/authService";
import debugLog from '../../core/debug';
import {LevelRegistry} from "../storage/levelRegistry";
import {LevelVersionManager} from "../versioning/levelVersionManager";
import {LevelStatsManager} from "../stats/levelStats";

const SELECTED_LEVEL_KEY = 'space-game-selected-level';

// Default level IDs in display order (matches directory.json)
const DEFAULT_LEVEL_ORDER = [
    'rookie-training',
    'rescue-mission',
    'deep-space-patrol',
    'enemy-territory',
    'the-gauntlet',
    'final-challenge'
];

/**
 * Populate the level selection screen with levels from registry
 * Shows all 6 default levels in a 3x2 carousel with locked/unlocked states
 */
export async function populateLevelSelector(): Promise<boolean> {
    console.log('[LevelSelector] populateLevelSelector() called');
    const container = document.getElementById('levelCardsContainer');
    if (!container) {
        console.warn('[LevelSelector] Level cards container not found');
        return false;
    }
    console.log('[LevelSelector] Container found:', container);

    const registry = LevelRegistry.getInstance();
    const versionManager = LevelVersionManager.getInstance();
    const statsManager = LevelStatsManager.getInstance();

    // Initialize registry
    try {
        console.log('[LevelSelector] Initializing registry...');
        await registry.initialize();
        console.log('[LevelSelector] Registry initialized');
    } catch (error) {
        console.error('[LevelSelector] Registry initialization error:', error);
        container.innerHTML = `
            <div class="no-levels-message">
                <h2>Failed to Load Levels</h2>
                <p>Could not load level directory. Check your connection and try again.</p>
                <button onclick="location.reload()" class="btn-primary">Reload</button>
            </div>
        `;
        return false;
    }

    const gameConfig = GameConfig.getInstance();
    const progressionEnabled = gameConfig.progressionEnabled;
    const progression = ProgressionManager.getInstance();

    // Update version manager with directory
    const directory = registry.getDirectory();
    if (directory) {
        versionManager.updateManifestVersions(directory);
    }

    const defaultLevels = registry.getDefaultLevels();
    const customLevels = registry.getCustomLevels();

    console.log('[LevelSelector] Default levels:', defaultLevels.size);
    console.log('[LevelSelector] Custom levels:', customLevels.size);
    console.log('[LevelSelector] Default level IDs:', Array.from(defaultLevels.keys()));

    if (defaultLevels.size === 0 && customLevels.size === 0) {
        console.warn('[LevelSelector] No levels found!');
        container.innerHTML = `
            <div class="no-levels-message">
                <h2>No Levels Found</h2>
                <p>No levels available. Please check your installation.</p>
                <a href="#/editor" class="btn-primary">Create Custom Level</a>
            </div>
        `;
        return false;
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

    // Check if user is authenticated
    const authService = AuthService.getInstance();
    const isAuthenticated = await authService.isAuthenticated();
    const isTutorial = (levelId: string) => levelId === DEFAULT_LEVEL_ORDER[0];

    debugLog('[LevelSelector] Authenticated:', isAuthenticated);
    debugLog('[LevelSelector] Progression enabled:', progressionEnabled);
    debugLog('[LevelSelector] Default levels count:', defaultLevels.size);

    // Show all default levels in order (3x2 grid)
    if (defaultLevels.size > 0) {
        for (const levelId of DEFAULT_LEVEL_ORDER) {
            const entry = defaultLevels.get(levelId);

            if (!entry) {
                // Level doesn't exist - show empty slot
                html += `
                    <div class="level-card level-card-locked">
                        <div class="level-card-header">
                            <h2 class="level-card-title">Missing Level</h2>
                            <div class="level-card-status level-card-status-locked">🔒</div>
                        </div>
                        <div class="level-meta">Level not found</div>
                        <p class="level-card-description">This level has not been created yet.</p>
                        <button class="level-button" disabled>Locked</button>
                    </div>
                `;
                continue;
            }

            const dirEntry = entry.directoryEntry;
            const levelName = dirEntry.name;
            const description = dirEntry.description;
            const estimatedTime = dirEntry.estimatedTime || '';
            const difficulty = dirEntry.difficulty || 'unknown';

            // Check for version updates
            const hasUpdate = versionManager.hasUpdate(levelId);

            // Get stats
            const stats = statsManager.getStats(levelId);
            const completionRate = stats?.completionRate || 0;
            const bestTime = stats?.bestTimeSeconds;

            // Check progression
            const isCompleted = progressionEnabled && progression.isLevelComplete(levelName);

            // Check if level is unlocked
            let isUnlocked = false;
            const isTut = isTutorial(levelId);

            if (isTut) {
                isUnlocked = true; // Tutorial always unlocked
            } else if (!isAuthenticated) {
                isUnlocked = false; // Non-tutorial levels require authentication
            } else {
                isUnlocked = !progressionEnabled || progression.isLevelUnlocked(levelName);
            }

            const isCurrentNext = progressionEnabled && progression.getNextLevel() === levelName;

            // Determine card state
            let cardClasses = 'level-card';
            let statusIcons = '';
            let buttonText = 'Play Level';
            let buttonDisabled = '';
            let lockReason = '';
            let metaTags = '';

            // Version update badge
            if (hasUpdate) {
                statusIcons += '<div class="level-card-badge level-card-badge-update">UPDATED</div>';
            }

            if (isCompleted) {
                cardClasses += ' level-card-completed';
                statusIcons += '<div class="level-card-status level-card-status-complete">✓</div>';
                buttonText = 'Replay';
            } else if (isCurrentNext && isUnlocked) {
                cardClasses += ' level-card-current';
                statusIcons += '<div class="level-card-badge">START HERE</div>';
            } else if (!isUnlocked) {
                cardClasses += ' level-card-locked';
                statusIcons += '<div class="level-card-status level-card-status-locked">🔒</div>';

                // Determine why it's locked
                if (!isAuthenticated && !isTutorial(levelId)) {
                    buttonText = 'Sign In Required';
                    lockReason = '<div class="level-lock-reason">Sign in to unlock</div>';
                } else if (progressionEnabled) {
                    const levelIndex = DEFAULT_LEVEL_ORDER.indexOf(levelId);
                    if (levelIndex > 0) {
                        const prevId = DEFAULT_LEVEL_ORDER[levelIndex - 1];
                        const prevEntry = defaultLevels.get(prevId);
                        const prevName = prevEntry?.directoryEntry.name || 'previous level';
                        lockReason = `<div class="level-lock-reason">Complete "${prevName}" to unlock</div>`;
                    }
                    buttonText = 'Locked';
                } else {
                    buttonText = 'Locked';
                }
                buttonDisabled = ' disabled';
            }

            // Show stats if available
            if (stats && stats.totalAttempts > 0) {
                metaTags = '<div class="level-stats">';
                if (bestTime) {
                    metaTags += `<span class="stat-badge">⏱️ ${LevelStatsManager.formatTime(bestTime)}</span>`;
                }
                if (stats.totalCompletions > 0) {
                    metaTags += `<span class="stat-badge">✓ ${stats.totalCompletions}</span>`;
                }
                metaTags += `<span class="stat-badge">${LevelStatsManager.formatCompletionRate(completionRate)}</span>`;
                metaTags += '</div>';
            }

            html += `
                <div class="${cardClasses}">
                    <div class="level-card-header">
                        <h2 class="level-card-title">${levelName}</h2>
                        <div class="level-card-badges">${statusIcons}</div>
                    </div>
                    <div class="level-meta">
                        Difficulty: ${difficulty}${estimatedTime ? ` • ${estimatedTime}` : ''}
                    </div>
                    <p class="level-card-description">${description}</p>
                    ${metaTags}
                    ${lockReason}
                    <div class="level-card-actions">
                        <button class="level-button" data-level-id="${levelId}"${buttonDisabled}>${buttonText}</button>
                        ${entry.isDefault && isUnlocked ? `<button class="level-button-secondary" data-copy-level="${levelId}" title="Copy to custom levels">📋 Copy</button>` : ''}
                    </div>
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

        for (const [levelId, entry] of customLevels.entries()) {
            const config = entry.config;
            if (!config) continue;

            const description = config.metadata?.description || `${config.asteroids.length} asteroids`;
            const author = config.metadata?.author ? ` by ${config.metadata.author}` : '';
            const difficulty = config.difficulty || 'custom';

            // Get stats
            const stats = statsManager.getStats(levelId);
            const bestTime = stats?.bestTimeSeconds;
            let metaTags = '';

            if (stats && stats.totalAttempts > 0) {
                metaTags = '<div class="level-stats">';
                if (bestTime) {
                    metaTags += `<span class="stat-badge">⏱️ ${LevelStatsManager.formatTime(bestTime)}</span>`;
                }
                if (stats.totalCompletions > 0) {
                    metaTags += `<span class="stat-badge">✓ ${stats.totalCompletions}</span>`;
                }
                metaTags += '</div>';
            }

            html += `
                <div class="level-card">
                    <div class="level-card-header">
                        <h2 class="level-card-title">${levelId}</h2>
                        <div class="level-card-badge level-card-badge-custom">CUSTOM</div>
                    </div>
                    <div class="level-meta">
                        ${difficulty}${author}
                    </div>
                    <p class="level-card-description">${description}</p>
                    ${metaTags}
                    <div class="level-card-actions">
                        <button class="level-button" data-level-id="${levelId}">Play Level</button>
                        <button class="level-button-secondary" data-delete-level="${levelId}" title="Delete level">🗑️</button>
                    </div>
                </div>
            `;
        }
    }

    console.log('[LevelSelector] Setting container innerHTML, html length:', html.length);
    container.innerHTML = html;
    console.log('[LevelSelector] Container innerHTML set, now attaching event listeners');

    // Attach event listeners to all level buttons
    const playButtons = container.querySelectorAll('.level-button:not([disabled])');
    playButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            const levelId = target.getAttribute('data-level-id');
            if (levelId) {
                selectLevel(levelId);
            }
        });
    });

    // Attach copy button listeners
    const copyButtons = container.querySelectorAll('[data-copy-level]');
    copyButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const target = e.target as HTMLButtonElement;
            const levelId = target.getAttribute('data-copy-level');
            if (levelId) {
                await copyLevelToCustom(levelId);
            }
        });
    });

    // Attach delete button listeners
    const deleteButtons = container.querySelectorAll('[data-delete-level]');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            const levelId = target.getAttribute('data-delete-level');
            if (levelId) {
                deleteCustomLevel(levelId);
            }
        });
    });

    console.log('[LevelSelector] Event listeners attached, returning true');

    // Make the level selector visible by adding 'ready' class
    const levelSelectDiv = document.getElementById('levelSelect');
    if (levelSelectDiv) {
        levelSelectDiv.classList.add('ready');
        console.log('[LevelSelector] Added "ready" class to #levelSelect');
    }

    return true;
}

/**
 * Copy a default level to custom levels
 */
async function copyLevelToCustom(levelId: string): Promise<void> {
    const registry = LevelRegistry.getInstance();
    const customName = prompt(`Enter a name for your copy of this level:`, `${levelId}-copy`);

    if (!customName || customName.trim() === '') {
        return;
    }

    const success = await registry.copyDefaultToCustom(levelId, customName);

    if (success) {
        alert(`Level copied as "${customName}"!`);
        await populateLevelSelector(); // Refresh UI
    } else {
        alert('Failed to copy level. Please try again.');
    }
}

/**
 * Delete a custom level
 */
function deleteCustomLevel(levelId: string): void {
    if (!confirm(`Are you sure you want to delete "${levelId}"?`)) {
        return;
    }

    const registry = LevelRegistry.getInstance();
    const success = registry.deleteCustomLevel(levelId);

    if (success) {
        populateLevelSelector(); // Refresh UI
    }
}

/**
 * Select a level and dispatch event to start it
 */
export async function selectLevel(levelId: string): Promise<void> {
    debugLog(`[LevelSelector] Level selected: ${levelId}`);

    const registry = LevelRegistry.getInstance();
    const config = await registry.getLevel(levelId);

    if (!config) {
        console.error(`Level not found: ${levelId}`);
        return;
    }

    // Save selected level
    localStorage.setItem(SELECTED_LEVEL_KEY, levelId);

    // Dispatch custom event that Main class will listen for
    const event = new CustomEvent('levelSelected', {
        detail: {levelName: levelId, config}
    });
    window.dispatchEvent(event);
}

/**
 * Get the last selected level ID
 */
export function getSelectedLevel(): string | null {
    return localStorage.getItem(SELECTED_LEVEL_KEY);
}
