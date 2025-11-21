<script lang="ts">
  export let progress: number = 0; // 0-100
  export let visible: boolean = false;
</script>

{#if visible}
  <div class="progress-bar-container">
    <div class="progress-bar-track">
      <div class="progress-fill" style="width: {progress}%;"></div>
    </div>
  </div>
{/if}

<style>
  /* Inherits from global styles.css */
  /* .progress-bar-* classes already defined */
</style>
