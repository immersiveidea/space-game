<script lang="ts">
  import NumberInput from './NumberInput.svelte';

  export let x: number = 0;
  export let y: number = 0;
  export let z: number = 0;
  export let step: number = 1;
  export let disabled: boolean = false;
</script>

<div class="vector-input">
  <div class="vector-field">
    <label>X</label>
    <NumberInput bind:value={x} {step} {disabled} on:change />
  </div>
  <div class="vector-field">
    <label>Y</label>
    <NumberInput bind:value={y} {step} {disabled} on:change />
  </div>
  <div class="vector-field">
    <label>Z</label>
    <NumberInput bind:value={z} {step} {disabled} on:change />
  </div>
</div>

<style>
  .vector-input {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm, 0.5rem);
  }

  .vector-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs, 0.25rem);
  }

  .vector-field label {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    color: var(--color-text-secondary, #666);
  }
</style>
