<script lang="ts">
  export let value: number = 0;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number = 1;
  export let disabled: boolean = false;
  export let id: string = '';
</script>

<input
  type="number"
  bind:value
  {min}
  {max}
  {step}
  {disabled}
  {id}
  on:input
  on:change
/>

<style>
  input[type="number"] {
    width: 100%;
    padding: var(--space-sm, 0.5rem);
    border: 1px solid var(--color-border, #ccc);
    border-radius: var(--border-radius-sm, 5px);
    font-size: var(--font-size-base, 1rem);
    background: var(--color-bg-secondary, #fff);
    color: var(--color-text, #000);
  }

  input[type="number"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
