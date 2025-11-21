<script lang="ts">
  export let title: string = '';
  export let description: string = '';
  export let icon: string = '';
</script>

<div class="section">
  {#if title}
    <h2>{icon}{title}</h2>
  {/if}

  {#if description}
    <p class="settings-description">{description}</p>
  {/if}

  <slot />
</div>

<style>
  /* Inherits from global styles.css */
  /* .section class is already defined */
</style>
