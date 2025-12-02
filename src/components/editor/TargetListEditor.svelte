<script lang="ts">
  import type { TargetConfig } from '../../levels/config/levelConfig';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import Vector3Input from './Vector3Input.svelte';
  import FormGroup from '../shared/FormGroup.svelte';

  export let targets: TargetConfig[] = [];

  let editingIndex: number | null = null;
  let editingTarget: TargetConfig | null = null;

  function generateId(): string {
    return `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function handleAdd() {
    const newTarget: TargetConfig = {
      id: generateId(),
      name: `Target ${targets.length + 1}`,
      position: [0, 0, 0]
    };
    targets = [...targets, newTarget];
    editingIndex = targets.length - 1;
    editingTarget = { ...newTarget };
  }

  function handleEdit(index: number) {
    editingIndex = index;
    editingTarget = { ...targets[index] };
  }

  function handleSave() {
    if (editingIndex !== null && editingTarget) {
      targets[editingIndex] = editingTarget;
      targets = targets;
    }
    editingIndex = null;
    editingTarget = null;
  }

  function handleCancel() {
    editingIndex = null;
    editingTarget = null;
  }

  function handleDelete(index: number) {
    if (confirm('Delete this target? Asteroids referencing it will lose their target.')) {
      targets = targets.filter((_, i) => i !== index);
      if (editingIndex === index) {
        editingIndex = null;
        editingTarget = null;
      }
    }
  }

  function formatPosition(pos: [number, number, number]): string {
    return `${pos[0]}, ${pos[1]}, ${pos[2]}`;
  }
</script>

<Section title="Target Positions ({targets.length})">
  <p class="hint">Targets are positions that asteroids can orbit or move toward.</p>

  <div class="target-header">
    <Button variant="primary" on:click={handleAdd}>+ Add Target</Button>
  </div>

  {#if editingTarget !== null}
    <div class="edit-form">
      <h4>Edit Target: {editingTarget.name}</h4>
      <FormGroup label="ID (read-only)">
        <input type="text" class="settings-input" value={editingTarget.id} disabled />
      </FormGroup>
      <FormGroup label="Name">
        <input type="text" class="settings-input" bind:value={editingTarget.name} />
      </FormGroup>
      <Vector3Input label="Position" bind:value={editingTarget.position} step={50} />
      <div class="edit-actions">
        <Button variant="primary" on:click={handleSave}>Save</Button>
        <Button variant="secondary" on:click={handleCancel}>Cancel</Button>
      </div>
    </div>
  {/if}

  {#if targets.length === 0}
    <p class="empty-message">No targets configured. Add targets for asteroids to orbit or move toward.</p>
  {:else}
    <div class="target-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th>Position</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each targets as target, index}
            <tr class:editing={editingIndex === index}>
              <td>{target.name}</td>
              <td class="id-cell">{target.id}</td>
              <td>{formatPosition(target.position)}</td>
              <td class="actions">
                <Button variant="secondary" on:click={() => handleEdit(index)}>Edit</Button>
                <Button variant="danger" on:click={() => handleDelete(index)}>x</Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Section>

<style>
  .hint {
    font-size: 0.9rem;
    color: var(--color-text-secondary, #888);
    margin-bottom: 1rem;
  }

  .target-header {
    margin-bottom: 1rem;
  }

  .edit-form {
    background: var(--color-bg-secondary, #1a1a2e);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .edit-form h4 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary, #fff);
  }

  .edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .target-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #333);
  }

  th {
    background: var(--color-bg-secondary, #1a1a2e);
    font-weight: 600;
  }

  tr.editing {
    background: var(--color-bg-hover, #252540);
  }

  .id-cell {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--color-text-secondary, #888);
  }

  .actions {
    display: flex;
    gap: 0.25rem;
  }

  .empty-message {
    color: var(--color-text-secondary, #888);
    font-style: italic;
  }
</style>
