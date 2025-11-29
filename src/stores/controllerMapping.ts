import { writable, get } from 'svelte/store';
import type { ControllerMapping } from '../ship/input/controllerMapping';
import { ControllerMappingConfig } from '../ship/input/controllerMapping';

const _STORAGE_KEY = 'space-game-controller-mapping';

function createControllerMappingStore() {
  const config = ControllerMappingConfig.getInstance();
  const initial = config.getMapping();

  const { subscribe, set, update } = writable<ControllerMapping>(initial);

  return {
    subscribe,
    update,
    set: (value: ControllerMapping) => {
      set(value);
      config.setMapping(value);
    },
    save: () => {
      const mapping = get(controllerMappingStore);
      config.setMapping(mapping);
      config.save();
      console.log('[ControllerMapping Store] Saved');
    },
    reset: () => {
      config.resetToDefault();
      config.save();
      set(config.getMapping());
      console.log('[ControllerMapping Store] Reset to defaults');
    },
    validate: () => {
      return config.validate();
    },
  };
}

export const controllerMappingStore = createControllerMappingStore();
