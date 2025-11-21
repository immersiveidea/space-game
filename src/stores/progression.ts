import { writable, get } from 'svelte/store';
import { ProgressionManager, type LevelProgress } from '../game/progression';
import { gameConfigStore } from './gameConfig';

interface ProgressionState {
  completedLevels: Map<string, LevelProgress>;
  editorUnlocked: boolean;
  completedCount: number;
  totalLevels: number;
  completionPercentage: number;
}

function createProgressionStore() {
  const progression = ProgressionManager.getInstance();

  // Create initial state from progression manager
  const initialState: ProgressionState = {
    completedLevels: new Map(),
    editorUnlocked: progression.isEditorUnlocked(),
    completedCount: progression.getCompletedCount(),
    totalLevels: progression.getTotalDefaultLevels(),
    completionPercentage: progression.getCompletionPercentage(),
  };

  const { subscribe, set, update } = writable<ProgressionState>(initialState);

  return {
    subscribe,

    /**
     * Check if a level is unlocked and can be played
     * @param levelName - The name of the level (e.g., "Rookie Training")
     * @param isDefault - Whether this is a default level (not custom)
     * @returns true if the level is unlocked
     */
    isLevelUnlocked: (levelName: string, isDefault: boolean): boolean => {
      const config = get(gameConfigStore);

      // If progression is disabled, all levels are unlocked
      if (!config.progressionEnabled) {
        return true;
      }

      // Custom levels are always unlocked
      if (!isDefault) {
        return true;
      }

      // Check with progression manager
      return progression.isLevelUnlocked(levelName);
    },

    /**
     * Check if a level has been completed
     */
    isLevelComplete: (levelName: string): boolean => {
      return progression.isLevelComplete(levelName);
    },

    /**
     * Mark a level as completed
     */
    markLevelComplete: (levelName: string, stats?: { completionTime?: number; accuracy?: number }) => {
      progression.markLevelComplete(levelName, stats);

      // Update store state
      update(state => ({
        ...state,
        completedLevels: new Map(), // Could be populated if needed
        editorUnlocked: progression.isEditorUnlocked(),
        completedCount: progression.getCompletedCount(),
        totalLevels: progression.getTotalDefaultLevels(),
        completionPercentage: progression.getCompletionPercentage(),
      }));
    },

    /**
     * Get the previous level name (for lock messages)
     */
    getPreviousLevelName: (levelName: string): string | null => {
      const defaultLevels = [
        'Rookie Training',
        'Rescue Mission',
        'Deep Space Patrol',
        'Enemy Territory',
        'The Gauntlet',
        'Final Challenge'
      ];

      const levelIndex = defaultLevels.indexOf(levelName);
      if (levelIndex > 0) {
        return defaultLevels[levelIndex - 1];
      }
      return null;
    },

    /**
     * Check if this is the tutorial level
     */
    isTutorial: (levelName: string): boolean => {
      return levelName === 'Rookie Training';
    },

    /**
     * Get next level to play
     */
    getNextLevel: (): string | null => {
      return progression.getNextLevel();
    },

    /**
     * Reset all progression
     */
    reset: () => {
      progression.reset();
      update(state => ({
        ...state,
        completedLevels: new Map(),
        editorUnlocked: false,
        completedCount: 0,
        completionPercentage: 0,
      }));
    },
  };
}

export const progressionStore = createProgressionStore();
