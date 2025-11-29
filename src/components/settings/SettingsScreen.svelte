<script lang="ts">
  import { onMount } from 'svelte';
  import { Link } from 'svelte-routing';
  import { gameConfigStore } from '../../stores/gameConfig';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import FormGroup from '../shared/FormGroup.svelte';
  import Checkbox from '../shared/Checkbox.svelte';
  import NumberInput from '../shared/NumberInput.svelte';
  import InfoBox from '../shared/InfoBox.svelte';
  import log from '../../core/logger';

  let message = '';
  let messageType: 'success' | 'error' | 'warning' = 'success';
  let showMessage = false;

  // Reload config from localStorage on mount to ensure fresh data
  onMount(() => {
    const stored = localStorage.getItem('game-config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        gameConfigStore.set(config);
      } catch (error) {
        log.warn('[SettingsScreen] Failed to reload config:', error);
      }
    }
  });

  function handleSave() {
    gameConfigStore.save();
    message = 'Settings saved successfully! Changes will take effect when you start a new level.';
    messageType = 'success';
    showMessage = true;
    setTimeout(() => { showMessage = false; }, 5000);
  }

  function handleReset() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      gameConfigStore.reset();
      message = 'Settings reset to defaults';
      messageType = 'success';
      showMessage = true;
      setTimeout(() => { showMessage = false; }, 5000);
    }
  }
</script>

<div class="editor-container">
  <Link to="/" class="back-link">← Back to Game</Link>

  <h1>⚙️ Game Settings</h1>
  <p class="subtitle">Configure graphics quality and physics settings</p>

  <div class="settings-grid">
    <!-- Physics Settings -->
    <Section title="⚛️ Physics" description="Disabling physics can significantly improve performance but will prevent gameplay.">
      <FormGroup
        label="Enable Physics"
        helpText="Required for collisions, shooting, and asteroid movement. Disabling this will prevent gameplay but may help with debugging or viewing the scene."
      >
        <Checkbox bind:checked={$gameConfigStore.physicsEnabled} label="Enable Physics" />
      </FormGroup>
    </Section>

    <!-- Debug Settings -->
    <Section title="🐛 Developer" description="Enable debug logging to console for troubleshooting and development.">
      <FormGroup
        label="Enable Debug Logging"
        helpText="When enabled, debug messages will be shown in the browser console. Useful for development and troubleshooting issues."
      >
        <Checkbox bind:checked={$gameConfigStore.debugEnabled} label="Enable Debug Logging" />
      </FormGroup>
    </Section>

    <!-- Ship Physics Settings -->
    <Section title="🚀 Ship Physics" description="Advanced tuning parameters for ship movement and handling. Adjust these to customize how the ship responds to controls.">
      <FormGroup
        label="Max Linear Velocity"
        helpText="Maximum forward/backward speed of the ship. Higher values allow faster movement."
      >
        <NumberInput
          bind:value={$gameConfigStore.shipPhysics.maxLinearVelocity}
          min={50}
          max={1000}
          step={10}
        />
      </FormGroup>

      <FormGroup
        label="Max Angular Velocity"
        helpText="Maximum rotation speed of the ship. Higher values allow faster turning."
      >
        <NumberInput
          bind:value={$gameConfigStore.shipPhysics.maxAngularVelocity}
          min={0.5}
          max={5.0}
          step={0.1}
        />
      </FormGroup>

      <FormGroup
        label="Linear Force Multiplier"
        helpText="Acceleration power for forward/backward thrust. Higher values = faster acceleration."
      >
        <NumberInput
          bind:value={$gameConfigStore.shipPhysics.linearForceMultiplier}
          min={100}
          max={3000}
          step={50}
        />
      </FormGroup>

      <FormGroup
        label="Angular Force Multiplier"
        helpText="Torque power for rotation. Higher values = faster rotational acceleration."
      >
        <NumberInput
          bind:value={$gameConfigStore.shipPhysics.angularForceMultiplier}
          min={5}
          max={50}
          step={1}
        />
      </FormGroup>
    </Section>

    <!-- Storage Info -->
    <Section title="💾 Storage Info">
      <div class="settings-info-content">
        <p>Settings are automatically saved to your browser's local storage and will persist between sessions.</p>
        <p class="settings-warning">
          ⚠️ Note: Changes will take effect when you start a new level. Restart the current level to see changes.
        </p>
      </div>
    </Section>
  </div>

  <div class="button-group">
    <Button variant="primary" on:click={handleSave}>💾 Save Settings</Button>
    <Button variant="secondary" on:click={handleReset}>🔄 Reset to Defaults</Button>
  </div>

  <InfoBox {message} type={messageType} visible={showMessage} />
</div>

<style>
  /* Inherits from global styles.css */
</style>
