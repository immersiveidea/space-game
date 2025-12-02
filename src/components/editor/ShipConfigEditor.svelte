<script lang="ts">
  import type { ShipConfig } from '../../levels/config/levelConfig';
  import Vector3Input from './Vector3Input.svelte';
  import Section from '../shared/Section.svelte';

  export let config: ShipConfig;

  // Ensure arrays exist with defaults
  $: if (!config.position) config.position = [0, 0, 0];
  $: if (!config.linearVelocity) config.linearVelocity = [0, 0, 0];
  $: if (!config.angularVelocity) config.angularVelocity = [0, 0, 0];
</script>

<Section title="🚀 Ship Configuration">
  <Vector3Input label="Position" bind:value={config.position} step={10} />
  <Vector3Input label="Linear Velocity" bind:value={config.linearVelocity} step={1} />
  <Vector3Input label="Angular Velocity" bind:value={config.angularVelocity} step={0.1} />
</Section>
