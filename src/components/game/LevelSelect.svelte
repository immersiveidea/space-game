<script lang="ts">
  import { levelRegistryStore } from '../../stores/levelRegistry';
  import { authStore } from '../../stores/auth';
  import LevelCard from './LevelCard.svelte';
  import ProgressBar from './ProgressBar.svelte';

  // Get default levels in order (must match directory.json)
  const DEFAULT_LEVEL_ORDER = [
    'rookie-training',
    'asteroid-mania',
    'deep-space-patrol',
    'enemy-territory',
    'the-gauntlet',
    'final-challenge'
  ];

  // Reactive declarations for store values
  $: isReady = $levelRegistryStore.isInitialized;
  $: defaultLevels = $levelRegistryStore.defaultLevels;
  $: customLevels = $levelRegistryStore.customLevels;
</script>

<div id="mainDiv">


  <div id="levelSelect" class:ready={isReady}>
    <!-- Hero Section -->
    <div class="hero">
      <h1 class="hero-title">🚀 Space Combat VR</h1>
      <p class="hero-subtitle">
        Pilot your spaceship through asteroid fields and complete missions
      </p>
    </div>
    <!-- Level Selection Section -->
    <div class="level-section">
      <h2 class="level-header">Your Mission</h2>
      <p class="level-description">
        Choose your level and prepare for launch
      </p>

      <div class="card-container" id="levelCardsContainer">
        {#if !isReady}
          <div class="loading-message">Loading levels...</div>
        {:else if defaultLevels.size === 0}
          <div class="no-levels-message">
            <h2>No Levels Found</h2>
            <p>No levels available. Please check your installation.</p>
          </div>
        {:else}
          {#each DEFAULT_LEVEL_ORDER as levelId}
            {@const entry = defaultLevels.get(levelId)}
            {#if entry}
              <LevelCard
                {levelId}
                directoryEntry={entry.directoryEntry}
                isDefault={entry.isDefault}
              />
            {/if}
          {/each}

          {#if customLevels.size > 0}
            <div style="grid-column: 1 / -1; margin-top: var(--space-2xl);">
              <h3 class="level-header">Custom Levels</h3>
            </div>

            {#each Array.from(customLevels.entries()) as [levelId, entry]}
              <LevelCard
                {levelId}
                directoryEntry={entry.directoryEntry}
                isDefault={false}
              />
            {/each}
          {/if}
        {/if}
      </div>




    </div>
  </div>
</div>

<style>
  /* Inherits from global styles.css */
  /* Most classes already defined */

  .loading-message, .no-levels-message {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-2xl, 2rem);
  }
</style>
