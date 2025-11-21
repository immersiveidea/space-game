<script lang="ts">
  import type { LevelDirectoryEntry } from '../../levels/storage/levelRegistry';
  import { levelRegistryStore } from '../../stores/levelRegistry';
  import { authStore } from '../../stores/auth';
  import { progressionStore } from '../../stores/progression';
  import { gameConfigStore } from '../../stores/gameConfig';
  import Button from '../shared/Button.svelte';

  export let levelId: string;
  export let directoryEntry: LevelDirectoryEntry;
  export let isDefault: boolean = true;

  async function handleLevelClick() {
    console.log('[LevelCard] Level clicked:', {
      levelId,
      levelName: directoryEntry.name,
      isUnlocked,
      isAuthenticated: $authStore.isAuthenticated,
      buttonText
    });

    // If level is locked and user not authenticated, prompt to sign in
    if (!isUnlocked && !$authStore.isAuthenticated) {
      console.log('[LevelCard] Locked level clicked - prompting for sign in');
      try {
        await authStore.login();
        console.log('[LevelCard] Login completed');
      } catch (error) {
        console.error('[LevelCard] Login failed:', error);
      }
      return;
    }

    // If level is still locked (progression), don't allow play
    if (!isUnlocked) {
      console.log('[LevelCard] Level still locked after auth check (progression lock)');
      return;
    }

    // Dispatch custom event for main.ts to handle
    console.log('[LevelCard] Level unlocked, loading config...');
    const config = await levelRegistryStore.getLevel(levelId);
    if (config) {
      console.log('[LevelCard] Config loaded, dispatching levelSelected event');
      window.dispatchEvent(new CustomEvent('levelSelected', {
        detail: { levelName: levelId, config }
      }));
    } else {
      console.error('[LevelCard] Failed to load level config');
    }
  }

  async function handleDelete() {
    if (confirm(`Are you sure you want to delete "${levelId}"?`)) {
      levelRegistryStore.deleteCustomLevel(levelId);
    }
  }

  // Determine if level is unlocked - complex logic matching original implementation
  $: {
    const isTutorial = progressionStore.isTutorial(directoryEntry.name);
    const isAuthenticated = $authStore.isAuthenticated;
    const progressionEnabled = $gameConfigStore.progressionEnabled;

    if (isTutorial) {
      // Tutorial is always unlocked
      isUnlocked = true;
      lockReason = '';
      buttonText = 'Play Level';
    } else if (!isAuthenticated) {
      // Non-tutorial requires authentication
      isUnlocked = false;
      lockReason = 'Sign in to unlock';
      buttonText = 'Sign In Required';
    } else if (progressionEnabled && isDefault) {
      // Check sequential progression
      isUnlocked = progressionStore.isLevelUnlocked(directoryEntry.name, isDefault);
      if (!isUnlocked) {
        const prevLevel = progressionStore.getPreviousLevelName(directoryEntry.name);
        lockReason = prevLevel ? `Complete "${prevLevel}" to unlock` : 'Locked';
        buttonText = 'Locked';
      } else {
        lockReason = '';
        buttonText = 'Play Level';
      }
    } else {
      // Custom levels or progression disabled - always unlocked when authenticated
      isUnlocked = true;
      lockReason = '';
      buttonText = 'Play Level';
    }
  }

  let isUnlocked: boolean = false;
  let lockReason: string = '';
  let buttonText: string = 'Play Level';

  $: cardClasses = isUnlocked ? 'level-card' : 'level-card level-card-locked';
</script>

<div class={cardClasses}>
  <div class="level-card-header">
    <h2 class="level-card-title">{directoryEntry.name}</h2>
    {#if !isUnlocked}
      <div class="level-card-status level-card-status-locked">🔒</div>
    {/if}
    {#if !isDefault}
      <div class="level-card-badge level-card-badge-custom">CUSTOM</div>
    {/if}
  </div>

  <div class="level-meta">
    Difficulty: {directoryEntry.difficulty || 'unknown'}
    {#if directoryEntry.estimatedTime}
      • {directoryEntry.estimatedTime}
    {/if}
  </div>

  <p class="level-card-description">{directoryEntry.description}</p>

  {#if !isUnlocked && lockReason}
    <div class="level-lock-reason">{lockReason}</div>
  {/if}

  <div class="level-card-actions">
    <Button
      variant="primary"
      on:click={handleLevelClick}
    >
      {buttonText}
    </Button>

    {#if !isDefault && isUnlocked}
      <Button variant="secondary" on:click={handleDelete} title="Delete level">
        🗑️
      </Button>
    {/if}
  </div>
</div>

<style>
  /* Inherits from global styles.css */
  /* All .level-card-* classes already defined */
</style>
