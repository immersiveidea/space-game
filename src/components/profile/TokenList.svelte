<script lang="ts">
  import { onMount } from 'svelte';
  import { SupabaseService } from '../../services/supabaseService';
  import { authStore } from '../../stores/auth';
  import Button from '../shared/Button.svelte';

  export let onRevoke: () => void;

  interface Token {
    id: string;
    name: string;
    token_prefix: string;
    created_at: string;
    last_used_at: string | null;
    is_revoked: boolean;
  }

  let tokens: Token[] = [];
  let loading = true;
  let revoking: string | null = null;

  onMount(loadTokens);

  async function loadTokens() {
    loading = true;
    try {
      const client = await SupabaseService.getInstance().getAuthenticatedClient();
      if (!client) {
        await authStore.refresh();
        return;
      }

      const { data, error } = await client
        .from('user_tokens')
        .select('id, name, token_prefix, created_at, last_used_at, is_revoked')
        .eq('is_revoked', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      tokens = data || [];
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      loading = false;
    }
  }

  async function handleRevoke(tokenId: string) {
    if (!confirm('Revoke this token? The editor plugin will need a new token to authenticate.')) return;

    revoking = tokenId;
    try {
      const client = await SupabaseService.getInstance().getAuthenticatedClient();
      if (!client) throw new Error('Not authenticated');

      const { error } = await client.rpc('revoke_user_token', { p_token_id: tokenId });
      if (error) throw error;

      tokens = tokens.filter(t => t.id !== tokenId);
      onRevoke();
    } catch (err) {
      console.error('Failed to revoke token:', err);
    } finally {
      revoking = null;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  }
</script>

<div class="token-list">
  {#if loading}
    <p class="loading">Loading tokens...</p>
  {:else if tokens.length === 0}
    <p class="empty">No active tokens. Generate one to use with the editor plugin.</p>
  {:else}
    {#each tokens as token (token.id)}
      <div class="token-item">
        <div class="token-info">
          <span class="token-prefix">{token.token_prefix}...</span>
          <span class="token-meta">Created {formatDate(token.created_at)}</span>
          {#if token.last_used_at}
            <span class="token-meta">Last used {formatDate(token.last_used_at)}</span>
          {/if}
        </div>
        <Button variant="danger" on:click={() => handleRevoke(token.id)} disabled={revoking === token.id}>
          {revoking === token.id ? 'Revoking...' : 'Revoke'}
        </Button>
      </div>
    {/each}
  {/if}
</div>

<style>
  .token-list { margin-top: 1rem; }
  .token-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255,255,255,0.05);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .token-info { display: flex; flex-direction: column; gap: 0.25rem; }
  .token-prefix { font-family: monospace; font-size: 1rem; color: #4fc3f7; }
  .token-meta { font-size: 0.75rem; color: #888; }
  .loading, .empty { color: #888; font-style: italic; }
</style>
