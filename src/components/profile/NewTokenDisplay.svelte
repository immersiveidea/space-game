<script lang="ts">
  export let token: string;
  export let onClear: () => void;

  let copied = false;

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }
</script>

<div class="new-token-box">
  <div class="warning-header">
    <strong>Save this token now!</strong>
    <span>You won't be able to see it again.</span>
  </div>

  <div class="token-display">
    <code>{token}</code>
  </div>

  <div class="token-actions">
    <button class="copy-btn" on:click={copyToken}>
      {copied ? 'Copied!' : 'Copy to Clipboard'}
    </button>
    <button class="dismiss-btn" on:click={onClear}>I've saved it</button>
  </div>
</div>

<style>
  .new-token-box {
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid #4fc3f7;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .warning-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.75rem;
    color: #4fc3f7;
  }
  .warning-header span { font-size: 0.85rem; opacity: 0.8; }
  .token-display {
    background: #1a1a1a;
    padding: 0.75rem;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 0.75rem;
  }
  .token-display code {
    font-family: monospace;
    font-size: 0.9rem;
    word-break: break-all;
    color: #81c784;
  }
  .token-actions { display: flex; gap: 0.5rem; }
  .copy-btn, .dismiss-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .copy-btn { background: #4fc3f7; color: #000; }
  .dismiss-btn { background: #444; color: #fff; }
</style>
