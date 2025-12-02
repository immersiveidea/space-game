<script lang="ts">
  import type { AsteroidConfig } from '../../levels/config/levelConfig';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import Vector3Input from './Vector3Input.svelte';
  import NumberInput from '../shared/NumberInput.svelte';
  import FormGroup from '../shared/FormGroup.svelte';

  export let asteroids: AsteroidConfig[] = [];

  let editingIndex: number | null = null;
  let editingAsteroid: AsteroidConfig | null = null;

  function handleAdd() {
    const newId = `ast_${Date.now()}`;
    const newAsteroid: AsteroidConfig = {
      id: newId,
      position: [0, 0, 100],
      scale: 10,
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0]
    };
    asteroids = [...asteroids, newAsteroid];
    editingIndex = asteroids.length - 1;
    editingAsteroid = { ...newAsteroid };
  }

  function handleEdit(index: number) {
    editingIndex = index;
    editingAsteroid = { ...asteroids[index] };
  }

  function handleSave() {
    if (editingIndex !== null && editingAsteroid) {
      asteroids[editingIndex] = editingAsteroid;
      asteroids = asteroids; // trigger reactivity
    }
    editingIndex = null;
    editingAsteroid = null;
  }

  function handleCancel() {
    editingIndex = null;
    editingAsteroid = null;
  }

  function handleDelete(index: number) {
    if (confirm('Delete this asteroid?')) {
      asteroids = asteroids.filter((_, i) => i !== index);
      if (editingIndex === index) {
        editingIndex = null;
        editingAsteroid = null;
      }
    }
  }

  function formatPosition(pos: [number, number, number]): string {
    return `${pos[0]}, ${pos[1]}, ${pos[2]}`;
  }
</script>

<Section title="☄️ Asteroids ({asteroids.length})">
  <div class="asteroid-header">
    <Button variant="primary" on:click={handleAdd}>+ Add Asteroid</Button>
  </div>

  {#if editingAsteroid !== null}
    <div class="edit-form">
      <h4>Edit Asteroid: {editingAsteroid.id}</h4>
      <FormGroup label="ID">
        <input type="text" class="settings-input" bind:value={editingAsteroid.id} />
      </FormGroup>
      <Vector3Input label="Position" bind:value={editingAsteroid.position} step={10} />
      <FormGroup label="Scale">
        <NumberInput bind:value={editingAsteroid.scale} min={1} max={100} step={1} />
      </FormGroup>
      <Vector3Input label="Linear Velocity" bind:value={editingAsteroid.linearVelocity} step={1} />
      <Vector3Input label="Angular Velocity" bind:value={editingAsteroid.angularVelocity} step={0.1} />
      <div class="edit-actions">
        <Button variant="primary" on:click={handleSave}>Save</Button>
        <Button variant="secondary" on:click={handleCancel}>Cancel</Button>
      </div>
    </div>
  {/if}

  {#if asteroids.length === 0}
    <p class="empty-message">No asteroids configured.</p>
  {:else}
    <div class="asteroid-table">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Position</th>
            <th>Scale</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each asteroids as asteroid, index}
            <tr class:editing={editingIndex === index}>
              <td>{asteroid.id}</td>
              <td>{formatPosition(asteroid.position)}</td>
              <td>{asteroid.scale}</td>
              <td class="actions">
                <Button variant="secondary" on:click={() => handleEdit(index)}>Edit</Button>
                <Button variant="danger" on:click={() => handleDelete(index)}>×</Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Section>

<style>
  .asteroid-header {
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

  .asteroid-table {
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

  .actions {
    display: flex;
    gap: 0.25rem;
  }

  .empty-message {
    color: var(--color-text-secondary, #888);
    font-style: italic;
  }
</style>
