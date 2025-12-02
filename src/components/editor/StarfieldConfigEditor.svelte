<script lang="ts">
  import type { StarfieldConfig } from '../../levels/config/levelConfig';
  import Section from '../shared/Section.svelte';

  export let config: StarfieldConfig | undefined;
  export let onToggle: (enabled: boolean) => void;

  let isEnabled = !!config;

  // Default values matching BackgroundStars.DEFAULT_CONFIG
  const defaults: Required<StarfieldConfig> = {
    count: 4500,
    radius: 50000,
    minBrightness: 0.1,
    maxBrightness: 1.0,
    pointSize: 0.1
  };

  function handleToggle() {
    isEnabled = !isEnabled;
    onToggle(isEnabled);
  }

  // Initialize with defaults when enabled
  $: if (config) {
    if (config.count === undefined) config.count = defaults.count;
    if (config.radius === undefined) config.radius = defaults.radius;
    if (config.minBrightness === undefined) config.minBrightness = defaults.minBrightness;
    if (config.maxBrightness === undefined) config.maxBrightness = defaults.maxBrightness;
    if (config.pointSize === undefined) config.pointSize = defaults.pointSize;
  }
</script>

<Section title="Starfield Configuration">
  <div class="toggle-field">
    <label>
      <input type="checkbox" checked={isEnabled} on:change={handleToggle} />
      Custom Starfield Settings
    </label>
    <p class="hint">When disabled, uses default starfield settings.</p>
  </div>

  {#if isEnabled && config}
    <div class="field">
      <label for="count">Star Count</label>
      <input id="count" type="number" bind:value={config.count} step={100} min={100} max={10000} class="settings-input" />
      <span class="field-hint">Number of stars (100-10000)</span>
    </div>

    <div class="field">
      <label for="radius">Radius</label>
      <input id="radius" type="number" bind:value={config.radius} step={1000} min={1000} class="settings-input" />
      <span class="field-hint">Sphere radius containing stars</span>
    </div>

    <div class="field">
      <label for="minBrightness">Min Brightness</label>
      <input id="minBrightness" type="range" bind:value={config.minBrightness} step={0.01} min={0} max={1} class="slider" />
      <span class="field-value">{config.minBrightness?.toFixed(2)}</span>
    </div>

    <div class="field">
      <label for="maxBrightness">Max Brightness</label>
      <input id="maxBrightness" type="range" bind:value={config.maxBrightness} step={0.01} min={0} max={1} class="slider" />
      <span class="field-value">{config.maxBrightness?.toFixed(2)}</span>
    </div>

    <div class="field">
      <label for="pointSize">Point Size</label>
      <input id="pointSize" type="number" bind:value={config.pointSize} step={0.1} min={0.1} max={5} class="settings-input" />
      <span class="field-hint">Size of star points (0.1-5)</span>
    </div>
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

  .field input.settings-input {
    width: 100%;
  }

  .field-hint {
    display: block;
    font-size: 0.8rem;
    color: var(--color-text-secondary, #888);
    margin-top: 0.25rem;
  }

  .field-value {
    margin-left: 0.5rem;
    color: var(--color-primary, #4a9eff);
  }

  .slider {
    width: 100%;
    cursor: pointer;
  }

  .toggle-field {
    margin-bottom: 1.5rem;
  }

  .toggle-field label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--color-text-primary, #fff);
    font-weight: 500;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--color-text-secondary, #888);
    margin: 0.5rem 0 0 1.5rem;
  }
</style>
