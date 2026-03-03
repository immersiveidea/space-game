<script lang="ts">
  import { onMount } from 'svelte';
  import { Link, navigate } from 'svelte-routing';
  import { CloudLevelService, type CloudLevelEntry } from '../../services/cloudLevelService';
  import type { LevelConfig, StartBaseConfig } from '../../levels/config/levelConfig';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import InfoBox from '../shared/InfoBox.svelte';
  import ShipConfigEditor from './ShipConfigEditor.svelte';
  import BaseConfigEditor from './BaseConfigEditor.svelte';
  import SunConfigEditor from './SunConfigEditor.svelte';
  import StarfieldConfigEditor from './StarfieldConfigEditor.svelte';
  import AsteroidListEditor from './AsteroidListEditor.svelte';
  import PlanetListEditor from './PlanetListEditor.svelte';
  import TargetListEditor from './TargetListEditor.svelte';

  export let levelId: string = '';

  let isLoading = true;
  let isAuthorized = false;
  let isSaving = false;
  let level: CloudLevelEntry | null = null;
  let config: LevelConfig | null = null;
  let error = '';
  let activeTab = 'general';

  // Message state
  let message = '';
  let messageType: 'success' | 'error' | 'warning' = 'success';
  let showMessage = false;

  const tabs = [
    { id: 'general', label: '⚙️ General' },
    { id: 'ship', label: '🚀 Ship' },
    { id: 'base', label: '🛬 Base' },
    { id: 'sun', label: '☀️ Sun' },
    { id: 'starfield', label: '✨ Stars' },
    { id: 'targets', label: '🎯 Targets' },
    { id: 'asteroids', label: '☄️ Asteroids' },
    { id: 'planets', label: '🪐 Planets' }
  ];

  const musicOptions = ['song1.mp3', 'song2.mp3','song3.mp3'];

  onMount(async () => {
    await loadLevel();
  });

  async function loadLevel() {
    isLoading = true;
    error = '';

    try {
      const service = CloudLevelService.getInstance();
      const permissions = await service.getAdminPermissions();

      if (!permissions?.canManageOfficial) {
        isAuthorized = false;
        isLoading = false;
        return;
      }

      isAuthorized = true;
      level = await service.getLevelById(levelId);

      if (!level) {
        error = 'Level not found';
        isLoading = false;
        return;
      }

      // Deep clone config to avoid mutating original
      config = JSON.parse(JSON.stringify(level.config));
    } catch (err) {
      error = 'Failed to load level';
      console.error('[LevelConfigEditor] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    if (!level || !config) return;

    isSaving = true;
    showMessage = false;

    try {
      const service = CloudLevelService.getInstance();
      // Convert empty strings to undefined before saving
      const cleanConfig = {
        ...config,
        backgroundMusic: config.backgroundMusic || undefined
      };
      const updated = await service.updateLevelAsAdmin(level.id, { config: cleanConfig });

      if (updated) {
        level = updated;
        message = 'Config saved successfully!';
        messageType = 'success';
      } else {
        message = 'Failed to save config';
        messageType = 'error';
      }
    } catch (err) {
      message = 'Error saving config';
      messageType = 'error';
      console.error('[LevelConfigEditor] Save error:', err);
    } finally {
      isSaving = false;
      showMessage = true;
      setTimeout(() => { showMessage = false; }, 5000);
    }
  }

  function handleCancel() {
    navigate(`/editor/${levelId}`);
  }

  function handleBaseToggle(enabled: boolean) {
    if (!config) return;
    if (enabled && !config.startBase) {
      config.startBase = { position: [0, 0, 0] };
    } else if (!enabled) {
      config.startBase = undefined;
    }
  }

  function handleStarfieldToggle(enabled: boolean) {
    if (!config) return;
    if (enabled && !config.starfield) {
      config.starfield = {};
    } else if (!enabled) {
      config.starfield = undefined;
    }
  }

  function ensureTargets() {
    if (config && !config.targets) {
      config.targets = [];
    }
  }
</script>

<div class="editor-container">
  <Link to="/editor/{levelId}" class="back-link">← Back to Level Details</Link>

  <h1>⚙️ Edit Config</h1>

  {#if isLoading}
    <Section title="Loading...">
      <p>Loading level configuration...</p>
    </Section>
  {:else if !isAuthorized}
    <Section title="🚫 Access Denied">
      <p>You do not have permission to edit level configs.</p>
    </Section>
  {:else if error}
    <Section title="❌ Error">
      <p>{error}</p>
      <Button variant="secondary" on:click={() => navigate('/editor')}>Back to List</Button>
    </Section>
  {:else if level && config}
    <p class="subtitle">Level: {level.name}</p>

    <!-- Tab Navigation -->
    <div class="tabs">
      {#each tabs as tab}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          on:click={() => activeTab = tab.id}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'general'}
        <Section title="General Settings">
          <div class="field-row">
            <label for="backgroundMusic">Background Music</label>
            <select id="backgroundMusic" bind:value={config.backgroundMusic}>
              <option value="">Default (song1.mp3)</option>
              {#each musicOptions as song}
                <option value={song}>{song}</option>
              {/each}
            </select>
          </div>
          <div class="field-row">
            <label for="difficulty">Difficulty</label>
            <input id="difficulty" type="text" bind:value={config.difficulty} />
          </div>
        </Section>
      {:else if activeTab === 'ship'}
        <ShipConfigEditor bind:config={config.ship} />
      {:else if activeTab === 'base'}
        <BaseConfigEditor config={config.startBase} onToggle={handleBaseToggle} />
      {:else if activeTab === 'sun'}
        <SunConfigEditor bind:config={config.sun} />
      {:else if activeTab === 'starfield'}
        <StarfieldConfigEditor config={config.starfield} onToggle={handleStarfieldToggle} />
      {:else if activeTab === 'targets'}
        {ensureTargets()}
        <TargetListEditor bind:targets={config.targets} />
      {:else if activeTab === 'asteroids'}
        {ensureTargets()}
        <AsteroidListEditor bind:asteroids={config.asteroids} targets={config.targets || []} />
      {:else if activeTab === 'planets'}
        <PlanetListEditor bind:planets={config.planets} />
      {/if}
    </div>

    <div class="button-group">
      <Button variant="primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '💾 Save Config'}
      </Button>
      <Button variant="secondary" on:click={handleCancel} disabled={isSaving}>Cancel</Button>
    </div>

    <InfoBox {message} type={messageType} visible={showMessage} />
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid var(--color-border, #333);
    padding-bottom: 0.5rem;
  }

  .tab {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--color-text-secondary, #888);
    cursor: pointer;
    font-size: 1rem;
    border-radius: 4px 4px 0 0;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--color-text-primary, #fff);
    background: var(--color-bg-hover, #252540);
  }

  .tab.active {
    color: var(--color-primary, #4a9eff);
    background: var(--color-bg-secondary, #1a1a2e);
    font-weight: 600;
  }

  .tab-content {
    min-height: 300px;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .field-row label {
    min-width: 150px;
    color: var(--color-text-secondary, #888);
  }

  .field-row select,
  .field-row input {
    flex: 1;
    padding: 0.5rem;
    background: var(--color-bg-tertiary, #252540);
    border: 1px solid var(--color-border, #333);
    border-radius: 4px;
    color: var(--color-text-primary, #fff);
    max-width: 300px;
  }
</style>
