<script lang="ts">
  import { authStore } from '../../stores/auth';
  import Button from '../shared/Button.svelte';

  async function handleLogin() {
    await authStore.login();
  }

  async function handleLogout() {
    await authStore.logout();
  }
</script>

<div id="userProfile">
  {#if $authStore.isLoading}
    <span class="loading">Loading...</span>
  {:else if $authStore.isAuthenticated && $authStore.user}
    <div class="user-info">
      <span class="user-name">{$authStore.user.name || $authStore.user.email}</span>
      <Button variant="secondary" on:click={handleLogout}>Logout</Button>
    </div>
  {:else}
    <Button variant="primary" on:click={handleLogin}>Sign In</Button>
  {/if}
</div>

<style>
  #userProfile {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
  }

  .user-name {
    color: var(--color-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .loading {
    color: var(--color-text-secondary, #ccc);
    font-size: var(--font-size-sm, 0.875rem);
  }
</style>
