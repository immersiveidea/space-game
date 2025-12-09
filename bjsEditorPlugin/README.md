# Space Game BabylonJS Editor Plugin

Export BabylonJS Editor scenes to Space Game LevelConfig format.

## Installation

1. Build the plugin:
   ```bash
   cd bjsEditorPlugin
   npm install
   npm run build
   ```

2. Install in BabylonJS Editor:
   - Open BabylonJS Editor
   - Edit → Preferences → Plugins
   - Click "Add" and select this folder
   - Apply and restart Editor

## Usage

1. Create a workspace in BabylonJS Editor
2. Copy the script components from `editorScripts/` to your workspace's `src/scenes/` folder
3. Place meshes in your scene and attach the appropriate scripts:
   - `AsteroidComponent` - for asteroids
   - `ShipComponent` - for player spawn point
   - `SunComponent` - for the sun
   - `PlanetComponent` - for planets
   - `TargetComponent` - for orbit/movement targets
4. Configure properties in the Inspector panel
5. Space Game → Export Level Config...

## Script Components

The `editorScripts/` folder contains TypeScript components to use in your Editor workspace.
These expose game-specific properties (velocities, targets, etc.) in the Inspector.

## Plugin Menu

- **Export Level Config...** - Downloads level.json file
- **Export to Clipboard** - Copies JSON to clipboard

## Development

```bash
npm run watch  # Watch mode for development
npm run build  # Production build
```

Debug in Editor: CTRL+ALT+i to open DevTools, F5 to reload plugin.
