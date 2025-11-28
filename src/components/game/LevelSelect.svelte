<script lang="ts">
  import { levelRegistryStore } from '../../stores/levelRegistry';
  import LevelCard from './LevelCard.svelte';
  import ProgressBar from './ProgressBar.svelte';

  // Get levels in order (by sortOrder from Supabase)
  const LEVEL_ORDER = [
    'rookie-training',
    'asteroid-mania',
    'deep-space-patrol',
    'enemy-territory',
    'the-gauntlet',
    'final-challenge'
  ];

  // Reactive declarations for store values
  $: isReady = $levelRegistryStore.isInitialized;
  $: levels = $levelRegistryStore.levels;
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
        {:else if levels.size === 0}
          <div class="no-levels-message">
            <h2>No Levels Found</h2>
            <p>No levels available. Please check your connection.</p>
          </div>
        {:else}
          {#each LEVEL_ORDER as levelId}
            {@const entry = levels.get(levelId)}
            {#if entry}
              <LevelCard
                {levelId}
                levelEntry={entry}
              />
            {/if}
          {/each}
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
