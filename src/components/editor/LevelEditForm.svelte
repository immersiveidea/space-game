<script lang="ts">
  import { onMount } from 'svelte';
  import { Link, navigate } from 'svelte-routing';
  import { CloudLevelService, type CloudLevelEntry } from '../../services/cloudLevelService';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import FormGroup from '../shared/FormGroup.svelte';
  import Select from '../shared/Select.svelte';
  import Checkbox from '../shared/Checkbox.svelte';
  import NumberInput from '../shared/NumberInput.svelte';
  import InfoBox from '../shared/InfoBox.svelte';

  export let levelId: string = '';

  let isLoading = true;
  let isAuthorized = false;
  let isSaving = false;
  let level: CloudLevelEntry | null = null;
  let error = '';

  // Form state
  let name = '';
  let slug = '';
  let description = '';
  let difficulty = 'pilot';
  let estimatedTime = '';
  let tags = '';
  let sortOrder = 0;
  let defaultLocked = false;
  let levelType = 'private';
  let missionBriefText = '';

  // Message state
  let message = '';
  let messageType: 'success' | 'error' | 'warning' = 'success';
  let showMessage = false;

  const difficultyOptions = [
    { value: 'recruit', label: 'Recruit' },
    { value: 'pilot', label: 'Pilot' },
    { value: 'captain', label: 'Captain' },
    { value: 'commander', label: 'Commander' },
    { value: 'test', label: 'Test' }
  ];

  const levelTypeOptions = [
    { value: 'official', label: 'Official' },
    { value: 'private', label: 'Private' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' }
  ];

  onMount(async () => {
    await loadLevel();
  });

  async function loadLevel() {
    isLoading = true;
    error = '';

    try {
      const service = CloudLevelService.getInstance();
      const permissions = await service.getAdminPermissions();

      if (!permissions?.canManageOfficial) {
        isAuthorized = false;
        isLoading = false;
        return;
      }

      isAuthorized = true;
      level = await service.getLevelById(levelId);

      if (!level) {
        error = 'Level not found';
        isLoading = false;
        return;
      }

      // Populate form fields
      name = level.name;
      slug = level.slug || '';
      description = level.description || '';
      difficulty = level.difficulty || 'pilot';
      estimatedTime = level.estimatedTime || '';
      tags = level.tags?.join(', ') || '';
      sortOrder = level.sortOrder || 0;
      defaultLocked = level.defaultLocked || false;
      levelType = level.levelType || 'private';
      missionBriefText = level.missionBrief?.join('\n') || '';
    } catch (err) {
      error = 'Failed to load level';
      console.error('[LevelEditForm] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    if (!level) return;

    isSaving = true;
    showMessage = false;

    try {
      const service = CloudLevelService.getInstance();
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const missionBriefArray = missionBriefText.split('\n').filter(l => l.trim().length > 0);

      const updated = await service.updateLevelAsAdmin(level.id, {
        name,
        slug: slug || undefined,
        description: description || undefined,
        difficulty,
        estimatedTime: estimatedTime || undefined,
        tags: tagsArray,
        sortOrder,
        defaultLocked,
        levelType,
        missionBrief: missionBriefArray
      });

      if (updated) {
        level = updated;
        message = 'Level saved successfully!';
        messageType = 'success';
      } else {
        message = 'Failed to save level';
        messageType = 'error';
      }
    } catch (err) {
      message = 'Error saving level';
      messageType = 'error';
      console.error('[LevelEditForm] Save error:', err);
    } finally {
      isSaving = false;
      showMessage = true;
      setTimeout(() => { showMessage = false; }, 5000);
    }
  }

  function handleCancel() {
    navigate('/editor');
  }
</script>

<div class="editor-container">
  <Link to="/editor" class="back-link">← Back to Level List</Link>

  <h1>📝 Edit Level</h1>

  {#if isLoading}
    <Section title="Loading...">
      <p>Loading level data...</p>
    </Section>
  {:else if !isAuthorized}
    <Section title="🚫 Access Denied">
      <p>You do not have permission to edit levels.</p>
    </Section>
  {:else if error}
    <Section title="❌ Error">
      <p>{error}</p>
      <Button variant="secondary" on:click={() => navigate('/editor')}>Back to List</Button>
    </Section>
  {:else if level}
    <p class="subtitle">Editing: {level.name}</p>

    <div class="settings-grid">
      <Section title="Basic Info">
        <FormGroup label="Name" helpText="Display name for the level">
          <input type="text" class="settings-input" bind:value={name} />
        </FormGroup>

        <FormGroup label="Slug" helpText="URL-friendly identifier (optional)">
          <input type="text" class="settings-input" bind:value={slug} placeholder="e.g., mission-1" />
        </FormGroup>

        <FormGroup label="Description" helpText="Brief description of the level">
          <textarea class="settings-textarea" bind:value={description} rows="3"></textarea>
        </FormGroup>
      </Section>

      <Section title="Settings">
        <FormGroup label="Difficulty">
          <Select bind:value={difficulty} options={difficultyOptions} />
        </FormGroup>

        <FormGroup label="Level Type">
          <Select bind:value={levelType} options={levelTypeOptions} />
        </FormGroup>

        <FormGroup label="Sort Order" helpText="Order in level list (lower = first)">
          <NumberInput bind:value={sortOrder} min={0} max={1000} step={1} />
        </FormGroup>

        <FormGroup label="Estimated Time" helpText="e.g., '2-3 min'">
          <input type="text" class="settings-input" bind:value={estimatedTime} />
        </FormGroup>

        <FormGroup label="Locked by Default">
          <Checkbox bind:checked={defaultLocked} label="Require unlock" />
        </FormGroup>

        <FormGroup label="Tags" helpText="Comma-separated tags">
          <input type="text" class="settings-input" bind:value={tags} placeholder="action, hard" />
        </FormGroup>
      </Section>

      <Section title="Mission Brief" description="Text shown before level starts (one line per entry)">
        <textarea class="settings-textarea mission-brief" bind:value={missionBriefText} rows="6"
          placeholder="Welcome to your first mission...&#10;Navigate through the asteroid field..."></textarea>
      </Section>
    </div>

    <div class="button-group">
      <Button variant="primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '💾 Save Changes'}
      </Button>
      <Button variant="secondary" on:click={handleCancel} disabled={isSaving}>Cancel</Button>
    </div>

    <InfoBox {message} type={messageType} visible={showMessage} />
  {/if}
</div>

<style>
  .settings-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border, #333);
    border-radius: 4px;
    background-color: var(--color-bg-input, #1a1a2e);
    color: var(--color-text-primary, #fff);
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
  }

  .settings-textarea:focus {
    outline: none;
    border-color: var(--color-primary, #4a9eff);
  }

  .mission-brief {
    font-family: monospace;
  }
</style>
