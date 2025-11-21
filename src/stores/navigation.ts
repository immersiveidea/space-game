import { writable } from 'svelte/store';

export interface NavigationState {
  currentRoute: string;
  isLoading: boolean;
  loadingMessage: string;
}

function createNavigationStore() {
  const initial: NavigationState = {
    currentRoute: '/',
    isLoading: false,
    loadingMessage: '',
  };

  const { subscribe, set, update } = writable<NavigationState>(initial);

  return {
    subscribe,
    setRoute: (route: string) => {
      update(state => ({ ...state, currentRoute: route }));
    },
    setLoading: (isLoading: boolean, message: string = '') => {
      update(state => ({ ...state, isLoading, loadingMessage: message }));
    },
  };
}

export const navigationStore = createNavigationStore();
