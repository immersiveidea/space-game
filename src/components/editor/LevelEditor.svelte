<script lang="ts">
  import { onMount } from 'svelte';
  import { Link, navigate } from 'svelte-routing';
  import { CloudLevelService, type CloudLevelEntry } from '../../services/cloudLevelService';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';

  let isLoading = true;
  let isAuthorized = false;
  let levels: CloudLevelEntry[] = [];
  let error = '';

  onMount(async () => {
    await checkPermissionsAndLoad();
  });

  async function checkPermissionsAndLoad() {
    isLoading = true;
    error = '';

    try {
      const service = CloudLevelService.getInstance();
      const permissions = await service.getAdminPermissions();
      console.log('[LevelEditor] Admin permissions:', permissions);

      if (!permissions?.canManageOfficial) {
        console.log('[LevelEditor] Access denied - canManageOfficial:', permissions?.canManageOfficial);
        isAuthorized = false;
        isLoading = false;
        return;
      }

      isAuthorized = true;
      levels = await service.getAllLevelsForAdmin();
      console.log('[LevelEditor] Loaded levels:', levels.length);
    } catch (err) {
      error = 'Failed to load levels';
      console.error('[LevelEditor] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleEdit(levelId: string) {
    navigate(`/editor/${levelId}`);
  }

  function getLevelTypeLabel(levelType: string): string {
    const labels: Record<string, string> = {
      official: '🏆 Official',
      private: '🔒 Private',
      pending_review: '⏳ Pending',
      published: '🌐 Published',
      rejected: '❌ Rejected'
    };
    return labels[levelType] || levelType;
  }
</script>

<div class="editor-container">
  <Link to="/" class="back-link">← Back to Game</Link>

  <h1>📝 Level Editor</h1>
  <p class="subtitle">Manage and edit game levels (Superadmin Only)</p>

  {#if isLoading}
    <Section title="Loading...">
      <p>Checking permissions and loading levels...</p>
    </Section>
  {:else if !isAuthorized}
    <Section title="🚫 Access Denied">
      <p>You do not have permission to access the level editor.</p>
      <p>This feature requires superadmin (canManageOfficial) privileges.</p>
    </Section>
  {:else if error}
    <Section title="❌ Error">
      <p>{error}</p>
      <Button variant="secondary" on:click={checkPermissionsAndLoad}>Retry</Button>
    </Section>
  {:else}
    <Section title="All Levels ({levels.length})">
      {#if levels.length === 0}
        <p>No levels found.</p>
      {:else}
        <div class="level-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each levels as level}
                <tr>
                  <td class="level-name">{level.name}</td>
                  <td class="level-type">{getLevelTypeLabel(level.levelType)}</td>
                  <td class="level-difficulty">{level.difficulty}</td>
                  <td class="level-order">{level.sortOrder}</td>
                  <td class="level-actions">
                    <Button variant="primary" on:click={() => handleEdit(level.id)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Section>
  {/if}

  <div class="button-group">
    <Button variant="secondary" on:click={() => history.back()}>← Back</Button>
  </div>
</div>

<style>
  .level-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #333);
  }

  th {
    background-color: var(--color-bg-secondary, #1a1a2e);
    color: var(--color-text-primary, #fff);
    font-weight: 600;
  }

  tr:hover {
    background-color: var(--color-bg-hover, #252540);
  }

  .level-name {
    font-weight: 500;
  }

  .level-type {
    white-space: nowrap;
  }

  .level-difficulty {
    text-transform: capitalize;
  }

  .level-order {
    text-align: center;
  }

  .level-actions {
    text-align: right;
  }
</style>
