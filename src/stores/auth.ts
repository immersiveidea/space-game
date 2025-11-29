import { writable } from 'svelte/store';
import { AuthService } from '../services/authService';
import log from '../core/logger';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  isLoading: boolean;
}

function createAuthStore() {
  const authService = AuthService.getInstance();

  const initial: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
  };

  const { subscribe, set, update } = writable<AuthState>(initial);

  log.info('[AuthStore] Store created with initial state:', initial);

  // Initialize auth state - will be properly initialized after AuthService.initialize() is called
  (async () => {
    log.info('[AuthStore] Checking initial auth state...');
    const isAuth = await authService.isAuthenticated();
    const user = authService.getUser();
    log.info('[AuthStore] Initial auth check:', { isAuth, user: user?.name || user?.email || null });
    set({ isAuthenticated: isAuth, user, isLoading: false });
  })();

  return {
    subscribe,
    login: async () => {
      log.info('[AuthStore] login() called');
      await authService.login();
      // After redirect, page will reload and auth state will be refreshed
    },
    logout: async () => {
      log.info('[AuthStore] logout() called');
      await authService.logout();
      // After logout redirect, page will reload
    },
    refresh: async () => {
      log.info('[AuthStore] refresh() called');
      const isAuth = await authService.isAuthenticated();
      const user = authService.getUser();
      log.info('[AuthStore] Refreshed auth state:', { isAuth, user: user?.name || user?.email || null });
      update(state => ({ ...state, isAuthenticated: isAuth, user }));
    },
  };
}

export const authStore = createAuthStore();
