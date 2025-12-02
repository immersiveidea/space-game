<script lang="ts">
  import type { StartBaseConfig } from '../../levels/config/levelConfig';
  import Vector3Input from './Vector3Input.svelte';
  import Section from '../shared/Section.svelte';
  import Checkbox from '../shared/Checkbox.svelte';

  export let config: StartBaseConfig | undefined;
  export let onToggle: (enabled: boolean) => void;

  let enabled = !!config;

  function handleToggle() {
    enabled = !enabled;
    onToggle(enabled);
  }

  // Ensure position exists
  $: if (config && !config.position) config.position = [0, 0, 0];
</script>

<Section title="🛬 Start Base Configuration">
  <div class="base-toggle">
    <Checkbox checked={enabled} label="Enable Start Base" on:change={handleToggle} />
  </div>

  {#if enabled && config}
    <Vector3Input label="Position" bind:value={config.position} step={10} />
  {:else}
    <p class="disabled-message">Start base is disabled for this level.</p>
  {/if}
</Section>

<style>
  .base-toggle {
    margin-bottom: 1rem;
  }

  .disabled-message {
    color: var(--color-text-secondary, #888);
    font-style: italic;
  }
</style>
