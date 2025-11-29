import { writable } from 'svelte/store';
import { LevelRegistry } from '../levels/storage/levelRegistry';
import type { LevelConfig } from '../levels/config/levelConfig';
import type { CloudLevelEntry } from '../services/cloudLevelService';
import log from '../core/logger';

interface LevelRegistryState {
  isInitialized: boolean;
  levels: Map<string, CloudLevelEntry>;
}

function createLevelRegistryStore() {
  const registry = LevelRegistry.getInstance();

  const initial: LevelRegistryState = {
    isInitialized: false,
    levels: new Map(),
  };

  const { subscribe, set: _set, update } = writable<LevelRegistryState>(initial);

  // Initialize registry
  (async () => {
    try {
      await registry.initialize();
      update(state => ({
        ...state,
        isInitialized: true,
        levels: registry.getAllLevels(),
      }));
    } catch (error) {
      log.error('[LevelRegistryStore] Failed to initialize:', error);
    }
  })();

  return {
    subscribe,
    getLevel: (levelId: string): LevelConfig | null => {
      return registry.getLevel(levelId);
    },
    getLevelEntry: (levelId: string): CloudLevelEntry | null => {
      return registry.getLevelEntry(levelId);
    },
    refresh: async () => {
      registry.reset();
      await registry.initialize();
      update(state => ({
        ...state,
        levels: registry.getAllLevels(),
      }));
    },
  };
}

export const levelRegistryStore = createLevelRegistryStore();
