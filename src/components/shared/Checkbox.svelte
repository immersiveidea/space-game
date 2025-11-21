<script lang="ts">
  export let checked: boolean = false;
  export let label: string = '';
  export let disabled: boolean = false;
  export let id: string = '';
</script>

<label class="checkbox-label">
  <input
    type="checkbox"
    bind:checked
    {disabled}
    {id}
    class="settings-checkbox"
    on:change
  />
  {#if label}
    <span>{label}</span>
  {/if}
  <slot />
</label>

<style>
  /* Inherits from global styles.css */
  /* .checkbox-label and .settings-checkbox are already defined */
</style>
