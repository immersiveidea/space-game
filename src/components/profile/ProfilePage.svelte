<script lang="ts">
  import { Link } from 'svelte-routing';
  import { authStore } from '../../stores/auth';
  import { SupabaseService } from '../../services/supabaseService';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import InfoBox from '../shared/InfoBox.svelte';
  import TokenList from './TokenList.svelte';
  import NewTokenDisplay from './NewTokenDisplay.svelte';

  let message = '';
  let messageType: 'success' | 'error' | 'warning' = 'success';
  let showMessage = false;
  let newToken: string | null = null;
  let isGenerating = false;
  let refreshKey = 0;

  async function handleGenerateToken() {
    isGenerating = true;
    try {
      const client = await SupabaseService.getInstance().getAuthenticatedClient();
      if (!client) {
        // Session is stale - refresh auth store to show login button
        await authStore.refresh();
        showNotification('Session expired. Please sign in again.', 'warning');
        return;
      }

      const { data, error } = await client.rpc('create_user_token', { p_name: 'Editor Token' });
      if (error) throw error;

      newToken = data;
      refreshKey++; // Trigger token list refresh
      showNotification('Token generated! Copy it now - you won\'t see it again.', 'success');
    } catch (err) {
      showNotification(`Failed to generate token: ${(err as Error).message}`, 'error');
    } finally {
      isGenerating = false;
    }
  }

  function handleTokenRevoked() {
    refreshKey++;
    showNotification('Token revoked', 'success');
  }

  function handleClearNewToken() {
    newToken = null;
  }

  function showNotification(msg: string, type: 'success' | 'error' | 'warning') {
    message = msg;
    messageType = type;
    showMessage = true;
    setTimeout(() => { showMessage = false; }, 5000);
  }
</script>

<div class="editor-container">
  <Link to="/" class="back-link">← Back to Game</Link>

  <h1>Profile</h1>

  {#if !$authStore.isAuthenticated}
    <Section title="Sign In Required">
      <p>Please sign in to manage your profile and editor tokens.</p>
      <Button variant="primary" on:click={() => authStore.login()}>Sign In</Button>
    </Section>
  {:else}
    <p class="subtitle">Welcome, {$authStore.user?.name || $authStore.user?.email || 'Player'}</p>

    <div class="settings-grid">
      <Section title="Editor Tokens" description="Generate tokens to authenticate the BabylonJS Editor plugin.">
        {#if newToken}
          <NewTokenDisplay token={newToken} onClear={handleClearNewToken} />
        {/if}

        <div class="token-actions">
          <Button variant="primary" on:click={handleGenerateToken} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate New Token'}
          </Button>
        </div>

        {#key refreshKey}
          <TokenList onRevoke={handleTokenRevoked} />
        {/key}
      </Section>
    </div>
  {/if}

  <InfoBox {message} type={messageType} visible={showMessage} />
</div>

<style>
  .token-actions {
    margin-bottom: 1rem;
  }
</style>
