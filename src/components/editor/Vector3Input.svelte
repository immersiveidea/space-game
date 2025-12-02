<script lang="ts">
  export let label: string = '';
  export let value: [number, number, number] = [0, 0, 0];
  export let step: number = 1;

  // Ensure value is always a valid array
  $: if (!value || value.length !== 3) {
    value = [0, 0, 0];
  }
</script>

<div class="vector3-input">
  {#if label}
    <label class="vector3-label">{label}</label>
  {/if}
  <div class="vector3-fields">
    <div class="vector3-field">
      <span class="axis-label">X</span>
      <input type="number" bind:value={value[0]} {step} class="settings-input" />
    </div>
    <div class="vector3-field">
      <span class="axis-label">Y</span>
      <input type="number" bind:value={value[1]} {step} class="settings-input" />
    </div>
    <div class="vector3-field">
      <span class="axis-label">Z</span>
      <input type="number" bind:value={value[2]} {step} class="settings-input" />
    </div>
  </div>
</div>

<style>
  .vector3-input {
    margin-bottom: 1rem;
  }

  .vector3-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary, #fff);
  }

  .vector3-fields {
    display: flex;
    gap: 0.5rem;
  }

  .vector3-field {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .axis-label {
    font-size: 0.8rem;
    color: var(--color-text-secondary, #aaa);
    min-width: 1rem;
  }

  .vector3-field input {
    width: 100%;
  }
</style>
