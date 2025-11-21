<script lang="ts">
  import { link } from 'svelte-spa-router';
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
          <a href="/controls" use:link class="nav-link controls-link">🎮 Customize Controls</a>
        <UserProfile />
        <a href="/editor" use:link class="nav-link editor-link">📝 Level Editor</a>

        <a href="/settings" use:link class="nav-link settings-link">⚙️ Settings</a>
      </nav>
    </div>
  </header>
{/if}

<style>
  /* Inherits from global styles.css */
  /* .app-header, .header-content, etc. are already defined */
</style>
