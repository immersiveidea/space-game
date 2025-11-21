<script lang="ts">
  export let value: string | number = '';
  export let options: Array<{value: string | number, label: string}> = [];
  export let disabled: boolean = false;
  export let id: string = '';
</script>

<select
  {id}
  bind:value
  {disabled}
  class="settings-select"
  on:change
>
  {#each options as option}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>

<style>
  /* Inherits from global styles.css */
  /* .settings-select class is already defined */
</style>
