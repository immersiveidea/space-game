<script lang="ts">
  import { levelRegistryStore } from '../../stores/levelRegistry';
  import { authStore } from '../../stores/auth';
  import { CloudLevelService, type CloudLevelEntry } from '../../services/cloudLevelService';
  import LevelCard from './LevelCard.svelte';
  import Button from '../shared/Button.svelte';

  // Get levels in order (by sortOrder from Supabase)
  const LEVEL_ORDER = [
    'rookie-training',
    'asteroid-mania',
    'deep-space-patrol',
    'enemy-territory',
    'the-gauntlet',
    'final-challenge'
  ];

  let activeTab: 'official' | 'my-levels' = 'official';
  let myLevels: CloudLevelEntry[] = [];
  let loadingMyLevels = false;
  let myLevelsLoaded = false;

  // Reactive declarations for store values
  $: isReady = $levelRegistryStore.isInitialized;
  $: levels = $levelRegistryStore.levels;

  // Load my levels when tab switches and user is authenticated
  $: if (activeTab === 'my-levels' && $authStore.isAuthenticated && !myLevelsLoaded) {
    loadMyLevels();
  }

  async function loadMyLevels() {
    loadingMyLevels = true;
    try {
      myLevels = await CloudLevelService.getInstance().getMyLevels();
      myLevelsLoaded = true;
    } catch (err) {
      console.error('Failed to load my levels:', err);
    } finally {
      loadingMyLevels = false;
    }
  }

  function switchTab(tab: 'official' | 'my-levels') {
    activeTab = tab;
  }
</script>

<div id="mainDiv">
  <div id="levelSelect" class:ready={isReady}>
    <div class="hero">
      <h1 class="hero-title">Space Combat VR</h1>
      <p class="hero-subtitle">Pilot your spaceship through asteroid fields and complete missions</p>
    </div>

    <div class="level-section">
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'official'}
          on:click={() => switchTab('official')}
        >
          Official Levels
        </button>
        <button
          class="tab"
          class:active={activeTab === 'my-levels'}
          on:click={() => switchTab('my-levels')}
        >
          My Levels
        </button>
      </div>

      <div class="card-container" id="levelCardsContainer">
        {#if activeTab === 'official'}
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
                <LevelCard {levelId} levelEntry={entry} />
              {/if}
            {/each}
          {/if}
        {:else}
          {#if !$authStore.isAuthenticated}
            <div class="no-levels-message">
              <h2>Sign In Required</h2>
              <p>Sign in to view your custom levels.</p>
              <Button variant="primary" on:click={() => authStore.login()}>Sign In</Button>
            </div>
          {:else if loadingMyLevels}
            <div class="loading-message">Loading your levels...</div>
          {:else if myLevels.length === 0}
            <div class="no-levels-message">
              <h2>No Custom Levels</h2>
              <p>You haven't created any levels yet. Use the BabylonJS Editor plugin to create levels.</p>
            </div>
          {:else}
            {#each myLevels as level (level.id)}
              <LevelCard levelId={level.id} levelEntry={level} />
            {/each}
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    justify-content: center;
  }

  .tab {
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #aaa;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .tab.active {
    background: rgba(79, 195, 247, 0.2);
    border-color: #4fc3f7;
    color: #4fc3f7;
  }

  .loading-message, .no-levels-message {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-2xl, 2rem);
  }

  .no-levels-message h2 {
    margin-bottom: 0.5rem;
  }

  .no-levels-message p {
    margin-bottom: 1rem;
    color: #888;
  }
</style>
