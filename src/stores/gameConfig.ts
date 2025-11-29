import { writable, get } from 'svelte/store';
import log from '../core/logger';

const STORAGE_KEY = 'game-config';

interface GameConfigData {
  physicsEnabled: boolean;
  debugEnabled: boolean;
  progressionEnabled: boolean;
  shipPhysics: {
    maxLinearVelocity: number;
    maxAngularVelocity: number;
    linearForceMultiplier: number;
    angularForceMultiplier: number;
  };
}

const defaultConfig: GameConfigData = {
  physicsEnabled: true,
  debugEnabled: false,
  progressionEnabled: true,
  shipPhysics: {
    maxLinearVelocity: 200,
    maxAngularVelocity: 1.4,
    linearForceMultiplier: 800,
    angularForceMultiplier: 15,
  },
};

function loadFromStorage(): GameConfigData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultConfig, ...parsed };
    }
  } catch (error) {
    log.warn('[GameConfig Store] Failed to load from localStorage:', error);
  }
  return { ...defaultConfig };
}

function createGameConfigStore() {
  const initial = loadFromStorage();
  const { subscribe, set, update } = writable<GameConfigData>(initial);

  return {
    subscribe,
    update,
    set,
    save: () => {
      const config = get(gameConfigStore);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        log.info('[GameConfig Store] Saved to localStorage');
      } catch (error) {
        log.error('[GameConfig Store] Failed to save:', error);
      }
    },
    reset: () => {
      set({ ...defaultConfig });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
        log.info('[GameConfig Store] Reset to defaults');
      } catch (error) {
        log.error('[GameConfig Store] Failed to save defaults:', error);
      }
    },
  };
}

export const gameConfigStore = createGameConfigStore();
