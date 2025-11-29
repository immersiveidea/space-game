<script lang="ts">
  import { navigate } from 'svelte-routing';
  import type { CloudLevelEntry } from '../../services/cloudLevelService';
  import { authStore } from '../../stores/auth';
  import { progressionStore } from '../../stores/progression';
  import { gameConfigStore } from '../../stores/gameConfig';
  import Button from '../shared/Button.svelte';
  import log from '../../core/logger';

  export let levelId: string;
  export let levelEntry: CloudLevelEntry;

  async function handleLevelClick() {
    log.info('[LevelCard] Level clicked:', {
      levelId,
      levelName: levelEntry.name,
      isUnlocked,
      isAuthenticated: $authStore.isAuthenticated,
      buttonText
    });

    // If level is locked and user not authenticated, prompt to sign in
    if (!isUnlocked && !$authStore.isAuthenticated) {
      log.info('[LevelCard] Locked level clicked - prompting for sign in');
      try {
        await authStore.login();
        log.info('[LevelCard] Login completed');
      } catch (error) {
        log.error('[LevelCard] Login failed:', error);
      }
      return;
    }

    // If level is still locked (progression), don't allow play
    if (!isUnlocked) {
      log.info('[LevelCard] Level still locked after auth check (progression lock)');
      return;
    }

    // Navigate to level play route
    log.info('[LevelCard] Level unlocked, navigating to /play/' + levelId);
    navigate(`/play/${levelId}`);
  }

  // Determine if level is unlocked
  $: {
    const isTutorial = progressionStore.isTutorial(levelEntry.name);
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
    } else if (progressionEnabled) {
      // Check sequential progression
      isUnlocked = progressionStore.isLevelUnlocked(levelEntry.name, true);
      if (!isUnlocked) {
        const prevLevel = progressionStore.getPreviousLevelName(levelEntry.name);
        lockReason = prevLevel ? `Complete "${prevLevel}" to unlock` : 'Locked';
        buttonText = 'Locked';
      } else {
        lockReason = '';
        buttonText = 'Play Level';
      }
    } else {
      // Progression disabled - always unlocked when authenticated
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
    <h2 class="level-card-title">{levelEntry.name}</h2>
    {#if !isUnlocked}
      <div class="level-card-status level-card-status-locked">🔒</div>
    {/if}
  </div>

  <div class="level-meta">
    Difficulty: {levelEntry.difficulty || 'unknown'}
    {#if levelEntry.estimatedTime}
      • {levelEntry.estimatedTime}
    {/if}
  </div>

  <p class="level-card-description">{levelEntry.description}</p>

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
  </div>
</div>

<style>
  /* Inherits from global styles.css */
  /* All .level-card-* classes already defined */
</style>
