<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'danger' = 'primary';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const className = `btn-${variant}`;
</script>

<button
  class={className}
  {disabled}
  {type}
  on:click
>
  <slot />
</button>

<style>
  /* Inherits styles from global styles.css */
  /* btn-primary, btn-secondary, etc. are already defined */
</style>
