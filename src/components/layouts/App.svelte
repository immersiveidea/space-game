<script lang="ts">
  import { onMount } from 'svelte';
  import { Router, Route } from 'svelte-routing';
  import AppHeader from './AppHeader.svelte';
  import { navigationStore } from '../../stores/navigation';
  import { AuthService } from '../../services/authService';
  import { authStore } from '../../stores/auth';

  // Import game views
  import LevelSelect from '../game/LevelSelect.svelte';
  import PlayLevel from '../game/PlayLevel.svelte';
  import LevelEditor from '../editor/LevelEditor.svelte';
  import SettingsScreen from '../settings/SettingsScreen.svelte';
  import ControlsScreen from '../controls/ControlsScreen.svelte';

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

<Router>
  <div class="app">
    <AppHeader />

    <div class="app-content">
      <Route path="/"><LevelSelect /></Route>
      <Route path="/play/:levelId" let:params>
        <PlayLevel {params} />
      </Route>
      <Route path="/editor"><LevelEditor /></Route>
      <Route path="/settings"><SettingsScreen /></Route>
      <Route path="/controls"><ControlsScreen /></Route>
    </div>
  </div>
</Router>

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
