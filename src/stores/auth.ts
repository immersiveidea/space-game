import { writable } from 'svelte/store';
import { AuthService } from '../services/authService';

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

  console.log('[AuthStore] Store created with initial state:', initial);

  // Initialize auth state - will be properly initialized after AuthService.initialize() is called
  (async () => {
    console.log('[AuthStore] Checking initial auth state...');
    const isAuth = await authService.isAuthenticated();
    const user = authService.getUser();
    console.log('[AuthStore] Initial auth check:', { isAuth, user: user?.name || user?.email || null });
    set({ isAuthenticated: isAuth, user, isLoading: false });
  })();

  return {
    subscribe,
    login: async () => {
      console.log('[AuthStore] login() called');
      await authService.login();
      // After redirect, page will reload and auth state will be refreshed
    },
    logout: async () => {
      console.log('[AuthStore] logout() called');
      await authService.logout();
      // After logout redirect, page will reload
    },
    refresh: async () => {
      console.log('[AuthStore] refresh() called');
      const isAuth = await authService.isAuthenticated();
      const user = authService.getUser();
      console.log('[AuthStore] Refreshed auth state:', { isAuth, user: user?.name || user?.email || null });
      update(state => ({ ...state, isAuthenticated: isAuth, user }));
    },
  };
}

export const authStore = createAuthStore();
