<script lang="ts">
  import { onMount } from 'svelte';
  import { Router, Route } from 'svelte-routing';
  import AppHeader from './AppHeader.svelte';
  import { navigationStore } from '../../stores/navigation';
  import { AuthService } from '../../services/authService';
  import { authStore } from '../../stores/auth';
  import log from '../../core/logger';

  // Import game views
  import LevelSelect from '../game/LevelSelect.svelte';
  import PlayLevel from '../game/PlayLevel.svelte';
  import LevelEditor from '../editor/LevelEditor.svelte';
  import LevelEditForm from '../editor/LevelEditForm.svelte';
  import SettingsScreen from '../settings/SettingsScreen.svelte';
  import ControlsScreen from '../controls/ControlsScreen.svelte';
  import Leaderboard from '../leaderboard/Leaderboard.svelte';

  // Initialize Auth0 when component mounts
  onMount(async () => {
    log.info('[App] ========== APP MOUNTED - INITIALIZING AUTH0 ==========');
    try {
      const authService = AuthService.getInstance();
      await authService.initialize();
      log.info('[App] Auth0 initialized successfully');

      // Refresh auth store to update UI with current auth state
      log.info('[App] Refreshing auth store...');
      await authStore.refresh();
      log.info('[App] Auth store refreshed');
    } catch (error) {
      log.error('[App] !!!!! AUTH0 INITIALIZATION FAILED !!!!!', error);
      log.error('[App] Error details:', error?.message, error?.stack);
    }
    log.info('[App] ========== AUTH0 INITIALIZATION COMPLETE ==========');
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
      <Route path="/editor/:levelId" let:params>
        <LevelEditForm levelId={params.levelId} />
      </Route>
      <Route path="/settings"><SettingsScreen /></Route>
      <Route path="/controls"><ControlsScreen /></Route>
      <Route path="/leaderboard"><Leaderboard /></Route>
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
