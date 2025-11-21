<script lang="ts">
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import AppHeader from './AppHeader.svelte';
  import { navigationStore } from '../../stores/navigation';
  import { AuthService } from '../../services/authService';
  import { authStore } from '../../stores/auth';

  // Import game view directly (most common route)
  import LevelSelect from '../game/LevelSelect.svelte';

  // Lazy load other views for better performance
  const routes = {
    '/': LevelSelect,
    '/editor': wrap({
      asyncComponent: () => import('../editor/LevelEditor.svelte')
    }),
    '/settings': wrap({
      asyncComponent: () => import('../settings/SettingsScreen.svelte')
    }),
    '/controls': wrap({
      asyncComponent: () => import('../controls/ControlsScreen.svelte')
    }),
  };

  // Track route changes
  function routeLoaded(event: CustomEvent) {
    const { route } = event.detail;
    navigationStore.setRoute(route);
  }

  // Initialize Auth0 when component mounts
  onMount(async () => {
    console.log('[App] ========== APP MOUNTED - INITIALIZING AUTH0 ==========');
    try {
      const authService = AuthService.getInstance();
      await authService.initialize();
      console.log('[App] Auth0 initialized successfully');

      // Refresh auth store to update UI with current auth state
      console.log('[App] Refreshing auth store...');
      await authStore.refresh();
      console.log('[App] Auth store refreshed');
    } catch (error) {
      console.error('[App] !!!!! AUTH0 INITIALIZATION FAILED !!!!!', error);
      console.error('[App] Error details:', error?.message, error?.stack);
    }
    console.log('[App] ========== AUTH0 INITIALIZATION COMPLETE ==========');
  });
</script>

<div class="app">
  <AppHeader />

  <div class="app-content">
    <Router {routes} on:routeLoaded={routeLoaded} />
  </div>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-content {
    flex: 1;
    position: relative;
  }

  /* Ensure canvas stays in background */
  :global(#gameCanvas) {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }
</style>
