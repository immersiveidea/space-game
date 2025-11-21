<script lang="ts">
  export let type: 'success' | 'warning' | 'error' | 'info' = 'info';
  export let message: string = '';
  export let visible: boolean = true;
</script>

{#if visible && message}
  <div class="settings-message {type}">
    {message}
  </div>
{/if}

<style>
  /* Inherits from global styles.css */
  .settings-message {
    padding: var(--space-md, 1rem);
    border-radius: var(--border-radius-md, 8px);
    margin-top: var(--space-md, 1rem);
  }

  .settings-message.success {
    background: rgba(76, 175, 80, 0.1);
    color: var(--color-success, #4caf50);
    border: 1px solid var(--color-success, #4caf50);
  }

  .settings-message.warning {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
    border: 1px solid #ff9800;
  }

  .settings-message.error {
    background: rgba(244, 67, 54, 0.1);
    color: var(--color-danger, #f44336);
    border: 1px solid var(--color-danger, #f44336);
  }

  .settings-message.info {
    background: rgba(33, 150, 243, 0.1);
    color: #2196f3;
    border: 1px solid #2196f3;
  }
</style>
