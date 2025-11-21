import { writable, get } from 'svelte/store';
import { LevelRegistry, type LevelDirectoryEntry } from '../levels/storage/levelRegistry';
import type { LevelConfig } from '../levels/config/levelConfig';

export interface LevelRegistryState {
  isInitialized: boolean;
  defaultLevels: Map<string, { config: LevelConfig | null; directoryEntry: LevelDirectoryEntry; isDefault: boolean }>;
  customLevels: Map<string, { config: LevelConfig | null; directoryEntry: LevelDirectoryEntry; isDefault: boolean }>;
}

function createLevelRegistryStore() {
  const registry = LevelRegistry.getInstance();

  const initial: LevelRegistryState = {
    isInitialized: false,
    defaultLevels: new Map(),
    customLevels: new Map(),
  };

  const { subscribe, set, update } = writable<LevelRegistryState>(initial);

  // Initialize registry
  (async () => {
    await registry.initialize();
    update(state => ({
      ...state,
      isInitialized: true,
      defaultLevels: registry.getDefaultLevels(),
      customLevels: registry.getCustomLevels(),
    }));
  })();

  return {
    subscribe,
    getLevel: async (levelId: string): Promise<LevelConfig | null> => {
      return await registry.getLevel(levelId);
    },
    refresh: async () => {
      await registry.initialize();
      update(state => ({
        ...state,
        defaultLevels: registry.getDefaultLevels(),
        customLevels: registry.getCustomLevels(),
      }));
    },
    deleteCustomLevel: (levelId: string): boolean => {
      const success = registry.deleteCustomLevel(levelId);
      if (success) {
        update(state => ({
          ...state,
          customLevels: registry.getCustomLevels(),
        }));
      }
      return success;
    },
  };
}

export const levelRegistryStore = createLevelRegistryStore();
