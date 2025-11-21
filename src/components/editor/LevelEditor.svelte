<script lang="ts">
  import { link } from 'svelte-spa-router';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';

  // This is a simplified stub - full implementation would be much larger
  // For now, just show a placeholder
</script>

<div class="editor-container">
  <a href="/" use:link class="back-link">← Back to Game</a>

  <h1>📝 Level Editor</h1>
  <p class="subtitle">Create and customize your own asteroid field levels</p>

  <Section title="🚧 Under Construction">
    <p>The level editor is being migrated to Svelte.</p>
    <p>This component will include:</p>
    <ul>
      <li>Difficulty presets</li>
      <li>Ship, base, and celestial object configuration</li>
      <li>Asteroid generation settings</li>
      <li>JSON editor</li>
      <li>Save/load functionality</li>
    </ul>
  </Section>

  <div class="button-group">
    <Button variant="secondary" on:click={() => history.back()}>← Back</Button>
  </div>
</div>

<style>
  ul {
    padding-left: var(--space-lg, 1.5rem);
    color: var(--color-text-secondary, #ccc);
  }

  li {
    margin: var(--space-xs, 0.25rem) 0;
  }
</style>
