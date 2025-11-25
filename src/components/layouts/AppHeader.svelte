<script lang="ts">
  import { Link } from 'svelte-routing';
  import { authStore } from '../../stores/auth';
  import UserProfile from '../auth/UserProfile.svelte';

  let visible = false;

  // Show header when not in game
  $: visible = true; // We'll control visibility via parent component if needed
</script>

{#if visible}
  <header class="app-header" id="appHeader">
    <div class="header-content">
      <div class="header-left">
        <h1 class="app-title">Space Combat VR</h1>
      </div>
      <nav class="header-nav">
          <Link to="/controls" class="nav-link controls-link">🎮 Customize Controls</Link>
        <UserProfile />
        <Link to="/editor" class="nav-link editor-link">📝 Level Editor</Link>

        <Link to="/settings" class="nav-link settings-link">⚙️ Settings</Link>
      </nav>
    </div>
  </header>
{/if}

<style>
  /* Inherits from global styles.css */
  /* .app-header, .header-content, etc. are already defined */
</style>
