<script lang="ts">
  export let label: string = '';
  export let helpText: string = '';
  export let error: string = '';
  export let htmlFor: string = '';
</script>

<div class="form-group">
  {#if label}
    <label for={htmlFor}>{label}</label>
  {/if}

  <slot />

  {#if helpText && !error}
    <div class="help-text">{helpText}</div>
  {/if}

  {#if error}
    <div class="error-text">{error}</div>
  {/if}
</div>

<style>
  /* Inherits from global styles.css */
  .error-text {
    color: var(--color-danger, #ff4444);
    font-size: var(--font-size-sm, 0.875rem);
    margin-top: var(--space-xs, 0.25rem);
  }
</style>
