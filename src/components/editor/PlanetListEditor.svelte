<script lang="ts">
  import type { PlanetConfig } from '../../levels/config/levelConfig';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import Vector3Input from './Vector3Input.svelte';
  import NumberInput from '../shared/NumberInput.svelte';
  import FormGroup from '../shared/FormGroup.svelte';
  import Select from '../shared/Select.svelte';

  export let planets: PlanetConfig[] = [];

  const textureOptions = [
    { value: '', label: '(None)' },
    // Arid
    { value: '/assets/materials/planetTextures/Arid/Arid_01-512x512.png', label: 'Arid 01' },
    { value: '/assets/materials/planetTextures/Arid/Arid_02-512x512.png', label: 'Arid 02' },
    { value: '/assets/materials/planetTextures/Arid/Arid_03-512x512.png', label: 'Arid 03' },
    { value: '/assets/materials/planetTextures/Arid/Arid_04-512x512.png', label: 'Arid 04' },
    { value: '/assets/materials/planetTextures/Arid/Arid_05-512x512.png', label: 'Arid 05' },
    // Barren
    { value: '/assets/materials/planetTextures/Barren/Barren_01-512x512.png', label: 'Barren 01' },
    { value: '/assets/materials/planetTextures/Barren/Barren_02-512x512.png', label: 'Barren 02' },
    { value: '/assets/materials/planetTextures/Barren/Barren_03-512x512.png', label: 'Barren 03' },
    { value: '/assets/materials/planetTextures/Barren/Barren_04-512x512.png', label: 'Barren 04' },
    { value: '/assets/materials/planetTextures/Barren/Barren_05-512x512.png', label: 'Barren 05' },
    // Dusty
    { value: '/assets/materials/planetTextures/Dusty/Dusty_01-512x512.png', label: 'Dusty 01' },
    { value: '/assets/materials/planetTextures/Dusty/Dusty_02-512x512.png', label: 'Dusty 02' },
    { value: '/assets/materials/planetTextures/Dusty/Dusty_03-512x512.png', label: 'Dusty 03' },
    { value: '/assets/materials/planetTextures/Dusty/Dusty_04-512x512.png', label: 'Dusty 04' },
    { value: '/assets/materials/planetTextures/Dusty/Dusty_05-512x512.png', label: 'Dusty 05' },
    // Gaseous
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_01-512x512.png', label: 'Gaseous 01' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_02-512x512.png', label: 'Gaseous 02' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_03-512x512.png', label: 'Gaseous 03' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_04-512x512.png', label: 'Gaseous 04' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_05-512x512.png', label: 'Gaseous 05' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_06-512x512.png', label: 'Gaseous 06' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_07-512x512.png', label: 'Gaseous 07' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_08-512x512.png', label: 'Gaseous 08' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_09-512x512.png', label: 'Gaseous 09' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_10-512x512.png', label: 'Gaseous 10' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_11-512x512.png', label: 'Gaseous 11' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_12-512x512.png', label: 'Gaseous 12' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_13-512x512.png', label: 'Gaseous 13' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_14-512x512.png', label: 'Gaseous 14' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_15-512x512.png', label: 'Gaseous 15' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_16-512x512.png', label: 'Gaseous 16' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_17-512x512.png', label: 'Gaseous 17' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_18-512x512.png', label: 'Gaseous 18' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_19-512x512.png', label: 'Gaseous 19' },
    { value: '/assets/materials/planetTextures/Gaseous/Gaseous_20-512x512.png', label: 'Gaseous 20' },
    // Grassland
    { value: '/assets/materials/planetTextures/Grassland/Grassland_01-512x512.png', label: 'Grassland 01' },
    { value: '/assets/materials/planetTextures/Grassland/Grassland_02-512x512.png', label: 'Grassland 02' },
    { value: '/assets/materials/planetTextures/Grassland/Grassland_03-512x512.png', label: 'Grassland 03' },
    { value: '/assets/materials/planetTextures/Grassland/Grassland_04-512x512.png', label: 'Grassland 04' },
    { value: '/assets/materials/planetTextures/Grassland/Grassland_05-512x512.png', label: 'Grassland 05' },
    // Jungle
    { value: '/assets/materials/planetTextures/Jungle/Jungle_01-512x512.png', label: 'Jungle 01' },
    { value: '/assets/materials/planetTextures/Jungle/Jungle_02-512x512.png', label: 'Jungle 02' },
    { value: '/assets/materials/planetTextures/Jungle/Jungle_03-512x512.png', label: 'Jungle 03' },
    { value: '/assets/materials/planetTextures/Jungle/Jungle_04-512x512.png', label: 'Jungle 04' },
    { value: '/assets/materials/planetTextures/Jungle/Jungle_05-512x512.png', label: 'Jungle 05' },
    // Marshy
    { value: '/assets/materials/planetTextures/Marshy/Marshy_01-512x512.png', label: 'Marshy 01' },
    { value: '/assets/materials/planetTextures/Marshy/Marshy_02-512x512.png', label: 'Marshy 02' },
    { value: '/assets/materials/planetTextures/Marshy/Marshy_03-512x512.png', label: 'Marshy 03' },
    { value: '/assets/materials/planetTextures/Marshy/Marshy_04-512x512.png', label: 'Marshy 04' },
    { value: '/assets/materials/planetTextures/Marshy/Marshy_05-512x512.png', label: 'Marshy 05' },
    // Martian
    { value: '/assets/materials/planetTextures/Martian/Martian_01-512x512.png', label: 'Martian 01' },
    { value: '/assets/materials/planetTextures/Martian/Martian_02-512x512.png', label: 'Martian 02' },
    { value: '/assets/materials/planetTextures/Martian/Martian_03-512x512.png', label: 'Martian 03' },
    { value: '/assets/materials/planetTextures/Martian/Martian_04-512x512.png', label: 'Martian 04' },
    { value: '/assets/materials/planetTextures/Martian/Martian_05-512x512.png', label: 'Martian 05' },
    // Methane
    { value: '/assets/materials/planetTextures/Methane/Methane_01-512x512.png', label: 'Methane 01' },
    { value: '/assets/materials/planetTextures/Methane/Methane_02-512x512.png', label: 'Methane 02' },
    { value: '/assets/materials/planetTextures/Methane/Methane_03-512x512.png', label: 'Methane 03' },
    { value: '/assets/materials/planetTextures/Methane/Methane_04-512x512.png', label: 'Methane 04' },
    { value: '/assets/materials/planetTextures/Methane/Methane_05-512x512.png', label: 'Methane 05' },
    // Sandy
    { value: '/assets/materials/planetTextures/Sandy/Sandy_01-512x512.png', label: 'Sandy 01' },
    { value: '/assets/materials/planetTextures/Sandy/Sandy_02-512x512.png', label: 'Sandy 02' },
    { value: '/assets/materials/planetTextures/Sandy/Sandy_03-512x512.png', label: 'Sandy 03' },
    { value: '/assets/materials/planetTextures/Sandy/Sandy_04-512x512.png', label: 'Sandy 04' },
    { value: '/assets/materials/planetTextures/Sandy/Sandy_05-512x512.png', label: 'Sandy 05' },
    // Snowy
    { value: '/assets/materials/planetTextures/Snowy/Snowy_01-512x512.png', label: 'Snowy 01' },
    { value: '/assets/materials/planetTextures/Snowy/Snowy_02-512x512.png', label: 'Snowy 02' },
    { value: '/assets/materials/planetTextures/Snowy/Snowy_03-512x512.png', label: 'Snowy 03' },
    { value: '/assets/materials/planetTextures/Snowy/Snowy_04-512x512.png', label: 'Snowy 04' },
    { value: '/assets/materials/planetTextures/Snowy/Snowy_05-512x512.png', label: 'Snowy 05' },
    // Tundra
    { value: '/assets/materials/planetTextures/Tundra/Tundra_01-512x512.png', label: 'Tundra 01' },
    { value: '/assets/materials/planetTextures/Tundra/Tundra_02-512x512.png', label: 'Tundra 02' },
    { value: '/assets/materials/planetTextures/Tundra/Tundra_03-512x512.png', label: 'Tundra 03' },
    { value: '/assets/materials/planetTextures/Tundra/Tundra_04-512x512.png', label: 'Tundra 04' },
    { value: '/assets/materials/planetTextures/Tundra/Tundral-EQUIRECTANGULAR-5-512x512.png', label: 'Tundra 05' }
  ];

  let editingIndex: number | null = null;
  let editingPlanet: PlanetConfig | null = null;

  function handleAdd() {
    const newPlanet: PlanetConfig = {
      name: `Planet ${planets.length + 1}`,
      position: [0, 0, 500],
      diameter: 100
    };
    planets = [...planets, newPlanet];
    editingIndex = planets.length - 1;
    editingPlanet = { ...newPlanet };
  }

  function handleEdit(index: number) {
    editingIndex = index;
    editingPlanet = { ...planets[index] };
  }

  function handleSave() {
    if (editingIndex !== null && editingPlanet) {
      planets[editingIndex] = editingPlanet;
      planets = planets; // trigger reactivity
    }
    editingIndex = null;
    editingPlanet = null;
  }

  function handleCancel() {
    editingIndex = null;
    editingPlanet = null;
  }

  function handleDelete(index: number) {
    if (confirm('Delete this planet?')) {
      planets = planets.filter((_, i) => i !== index);
      if (editingIndex === index) {
        editingIndex = null;
        editingPlanet = null;
      }
    }
  }

  function formatPosition(pos: [number, number, number]): string {
    return `${pos[0]}, ${pos[1]}, ${pos[2]}`;
  }
</script>

<Section title="🪐 Planets ({planets.length})">
  <div class="planet-header">
    <Button variant="primary" on:click={handleAdd}>+ Add Planet</Button>
  </div>

  {#if editingPlanet !== null}
    <div class="edit-form">
      <h4>Edit Planet: {editingPlanet.name}</h4>
      <FormGroup label="Name">
        <input type="text" class="settings-input" bind:value={editingPlanet.name} />
      </FormGroup>
      <Vector3Input label="Position" bind:value={editingPlanet.position} step={50} />
      <FormGroup label="Diameter">
        <NumberInput bind:value={editingPlanet.diameter} min={10} max={10000} step={10} />
      </FormGroup>
      <FormGroup label="Texture">
        <Select bind:value={editingPlanet.texturePath} options={textureOptions} />
      </FormGroup>
      <div class="edit-actions">
        <Button variant="primary" on:click={handleSave}>Save</Button>
        <Button variant="secondary" on:click={handleCancel}>Cancel</Button>
      </div>
    </div>
  {/if}

  {#if planets.length === 0}
    <p class="empty-message">No planets configured.</p>
  {:else}
    <div class="planet-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Position</th>
            <th>Diameter</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each planets as planet, index}
            <tr class:editing={editingIndex === index}>
              <td>{planet.name}</td>
              <td>{formatPosition(planet.position)}</td>
              <td>{planet.diameter}</td>
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
  .planet-header {
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

  .planet-table {
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
