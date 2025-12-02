<script lang="ts">
  import type { SunConfig } from '../../levels/config/levelConfig';
  import Vector3Input from './Vector3Input.svelte';
  import Section from '../shared/Section.svelte';

  export let config: SunConfig;

  let hasScale = !!config.scale;

  // Ensure arrays exist with defaults
  $: if (!config.position) config.position = [0, 0, 0];

  function toggleScale() {
    hasScale = !hasScale;
    if (hasScale && !config.scale) {
      config.scale = [1, 1, 1];
    } else if (!hasScale) {
      config.scale = undefined;
    }
  }
</script>

<Section title="Sun Configuration">
  <Vector3Input label="Position" bind:value={config.position} step={100} />

  <div class="field">
    <label for="diameter">Diameter</label>
    <input id="diameter" type="number" bind:value={config.diameter} step={10} class="settings-input" />
  </div>

  <div class="field">
    <label for="intensity">Intensity (optional)</label>
    <input id="intensity" type="number" bind:value={config.intensity} step={0.1} class="settings-input" />
  </div>

  <div class="toggle-field">
    <label>
      <input type="checkbox" checked={hasScale} on:change={toggleScale} />
      Custom Scale
    </label>
  </div>

  {#if hasScale && config.scale}
    <Vector3Input label="Scale" bind:value={config.scale} step={0.1} />
  {/if}
</Section>

<style>
  .field {
    margin-bottom: 1rem;
  }

  .field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary, #fff);
  }

  .field input {
    width: 100%;
  }

  .toggle-field {
    margin: 1rem 0;
  }

  .toggle-field label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--color-text-primary, #fff);
  }
</style>
