<script lang="ts">
  import { onMount } from 'svelte';
  import { Link } from 'svelte-routing';
  import { controllerMappingStore } from '../../stores/controllerMapping';
  import { ControllerMappingConfig } from '../../ship/input/controllerMapping';
  import Button from '../shared/Button.svelte';
  import Section from '../shared/Section.svelte';
  import FormGroup from '../shared/FormGroup.svelte';
  import Select from '../shared/Select.svelte';
  import Checkbox from '../shared/Checkbox.svelte';
  import InfoBox from '../shared/InfoBox.svelte';

  let message = '';
  let messageType: 'success' | 'error' | 'warning' = 'success';
  let showMessage = false;

  // Reload store from singleton on mount to ensure fresh data
  onMount(() => {
    const config = ControllerMappingConfig.getInstance();
    controllerMappingStore.set(config.getMapping());
  });

  // Get available options
  const stickActions = ControllerMappingConfig.getAvailableStickActions().map(action => ({
    value: action,
    label: ControllerMappingConfig.getStickActionLabel(action)
  }));

  const buttonActions = ControllerMappingConfig.getAvailableButtonActions().map(action => ({
    value: action,
    label: ControllerMappingConfig.getButtonActionLabel(action)
  }));

  function handleSave() {
    const warnings = controllerMappingStore.validate();

    if (warnings.length > 0) {
      message = 'Configuration saved with warnings:\n' + warnings.join('\n');
      messageType = 'warning';
    } else {
      message = 'Configuration saved successfully!';
      messageType = 'success';
    }

    controllerMappingStore.save();
    showMessage = true;
    setTimeout(() => { showMessage = false; }, 5000);
  }

  function handleReset() {
    if (confirm('Reset all controller mappings to default? This cannot be undone.')) {
      controllerMappingStore.reset();
      message = 'Reset to default configuration';
      messageType = 'success';
      showMessage = true;
      setTimeout(() => { showMessage = false; }, 5000);
    }
  }

  function handleTest() {
    const mapping = $controllerMappingStore;
    let preview = 'Current Controller Mapping:\n\n';
    preview += '📋 STICK MAPPINGS:\n';
    preview += `  Left Stick X: ${ControllerMappingConfig.getStickActionLabel(mapping.leftStickX)}`;
    preview += mapping.invertLeftStickX ? ' (Inverted)\n' : '\n';
    preview += `  Left Stick Y: ${ControllerMappingConfig.getStickActionLabel(mapping.leftStickY)}`;
    preview += mapping.invertLeftStickY ? ' (Inverted)\n' : '\n';
    preview += `  Right Stick X: ${ControllerMappingConfig.getStickActionLabel(mapping.rightStickX)}`;
    preview += mapping.invertRightStickX ? ' (Inverted)\n' : '\n';
    preview += `  Right Stick Y: ${ControllerMappingConfig.getStickActionLabel(mapping.rightStickY)}`;
    preview += mapping.invertRightStickY ? ' (Inverted)\n' : '\n';
    preview += '\n🎮 BUTTON MAPPINGS:\n';
    preview += `  Trigger: ${ControllerMappingConfig.getButtonActionLabel(mapping.trigger)}\n`;
    preview += `  A Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.aButton)}\n`;
    preview += `  B Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.bButton)}\n`;
    preview += `  X Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.xButton)}\n`;
    preview += `  Y Button: ${ControllerMappingConfig.getButtonActionLabel(mapping.yButton)}\n`;
    preview += `  Squeeze/Grip: ${ControllerMappingConfig.getButtonActionLabel(mapping.squeeze)}\n`;
    alert(preview);
  }
</script>

<div class="editor-container">
  <Link to="/" class="back-link">← Back to Game</Link>

  <h1>🎮 Controller Mapping</h1>
  <p class="subtitle">Customize VR controller button and stick mappings</p>

  <div class="settings-grid">
    <!-- Left Stick -->
    <Section title="🕹️ Left Stick" description="Configure what actions the left thumbstick controls.">
      <FormGroup label="Left Stick X-Axis (Left/Right)">
        <Select bind:value={$controllerMappingStore.leftStickX} options={stickActions} />
        <Checkbox bind:checked={$controllerMappingStore.invertLeftStickX} label="Invert this axis" />
      </FormGroup>

      <FormGroup label="Left Stick Y-Axis (Up/Down)">
        <Select bind:value={$controllerMappingStore.leftStickY} options={stickActions} />
        <Checkbox bind:checked={$controllerMappingStore.invertLeftStickY} label="Invert this axis" />
      </FormGroup>
    </Section>

    <!-- Right Stick -->
    <Section title="🕹️ Right Stick" description="Configure what actions the right thumbstick controls.">
      <FormGroup label="Right Stick X-Axis (Left/Right)">
        <Select bind:value={$controllerMappingStore.rightStickX} options={stickActions} />
        <Checkbox bind:checked={$controllerMappingStore.invertRightStickX} label="Invert this axis" />
      </FormGroup>

      <FormGroup label="Right Stick Y-Axis (Up/Down)">
        <Select bind:value={$controllerMappingStore.rightStickY} options={stickActions} />
        <Checkbox bind:checked={$controllerMappingStore.invertRightStickY} label="Invert this axis" />
      </FormGroup>
    </Section>

    <!-- Button Mappings -->
    <Section title="🔘 Button Mappings" description="Configure what actions each controller button performs.">
      <FormGroup label="Trigger (Index Finger)">
        <Select bind:value={$controllerMappingStore.trigger} options={buttonActions} />
      </FormGroup>

      <FormGroup label="A Button (Right Controller)">
        <Select bind:value={$controllerMappingStore.aButton} options={buttonActions} />
      </FormGroup>

      <FormGroup label="B Button (Right Controller)">
        <Select bind:value={$controllerMappingStore.bButton} options={buttonActions} />
      </FormGroup>

      <FormGroup label="X Button (Left Controller)">
        <Select bind:value={$controllerMappingStore.xButton} options={buttonActions} />
      </FormGroup>

      <FormGroup label="Y Button (Left Controller)">
        <Select bind:value={$controllerMappingStore.yButton} options={buttonActions} />
      </FormGroup>

      <FormGroup label="Squeeze/Grip Button">
        <Select bind:value={$controllerMappingStore.squeeze} options={buttonActions} />
      </FormGroup>
    </Section>

    <!-- Info Section -->
    <Section title="ℹ️ Action Guide">
      <div class="settings-info-content">
        <p><strong class="settings-label">Yaw:</strong> Turn left/right (rotate around vertical axis)</p>
        <p><strong class="settings-label">Pitch:</strong> Nose up/down (rotate around horizontal axis)</p>
        <p><strong class="settings-label">Roll:</strong> Barrel roll (rotate around forward axis)</p>
        <p><strong class="settings-label">Forward:</strong> Forward and backward thrust</p>
        <p><strong class="settings-label">None:</strong> No action assigned</p>
      </div>
    </Section>

    <!-- Storage Info -->
    <Section title="💾 Storage Info">
      <div class="settings-info-content">
        <p>Controller mappings are automatically saved to your browser's local storage and will persist between sessions.</p>
        <p class="settings-warning">
          ⚠️ Note: Changes will take effect when you start a new level. Restart the current level to see changes.
        </p>
      </div>
    </Section>
  </div>

  <div class="button-group">
    <Button variant="primary" on:click={handleSave}>💾 Save Mapping</Button>
    <Button variant="secondary" on:click={handleReset}>🔄 Reset to Default</Button>
    <Button variant="secondary" on:click={handleTest}>👁️ Preview Mapping</Button>
  </div>

  <InfoBox {message} type={messageType} visible={showMessage} />
</div>

<style>
  /* Inherits from global styles.css */
</style>
