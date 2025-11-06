# Blender Export Utility

Automated export of Blender `.blend` files to GLB format using Blender's command-line interface.

## Installation

First, install the required dependencies:

```bash
npm install
```

This will install `tsx` and `@types/node` which are needed to run the export scripts.

## Requirements

- **Blender**: Must be installed on your system
  - macOS: Install from [blender.org](https://www.blender.org/download/) (will be at `/Applications/Blender.app`)
  - Windows: Install to default location (`C:\Program Files\Blender Foundation\Blender\`)
  - Linux: Install via package manager (`sudo apt install blender`)

## Usage

### Basic Export

Export a single `.blend` file to `.glb`:

```bash
npm run export-blend -- public/ship1.blend public/ship1.glb
```

### Watch Mode

Automatically re-export when the `.blend` file changes:

```bash
npm run export-blend -- public/ship1.blend public/ship1.glb --watch
```

This is useful during development - save your Blender file and it will auto-export!

### Batch Export

Export all `.blend` files in a directory:

```bash
npm run export-blend -- public/ public/ --batch
```

This will:
- Find all `.blend` files in `public/`
- Export each to `.glb` with the same name
- Skip `.blend1` backup files

### Compression

Enable Draco mesh compression for smaller file sizes:

```bash
npm run export-blend -- public/ship1.blend public/ship1.glb --compress
```

### Advanced Options

```bash
# Don't apply modifiers during export
npm run export-blend -- input.blend output.glb --no-modifiers

# Combine options
npm run export-blend -- input.blend output.glb --watch --compress
```

## Programmatic Usage

You can also use the export functions directly in your TypeScript code:

```typescript
import { exportBlendToGLB, batchExportBlendToGLB, watchAndExport } from './src/utils/blenderExporter';

// Single export
async function exportMyModel() {
  const result = await exportBlendToGLB(
    './models/ship.blend',
    './public/ship.glb',
    {
      exportParams: {
        export_draco_mesh_compression_enable: true,
        export_apply_modifiers: true,
        export_animations: true
      }
    }
  );

  console.log(`Exported in ${result.duration}ms`);
}

// Batch export
async function exportAllModels() {
  const results = await batchExportBlendToGLB([
    ['./models/ship1.blend', './public/ship1.glb'],
    ['./models/ship2.blend', './public/ship2.glb'],
    ['./models/asteroid.blend', './public/asteroid.glb']
  ], {
    exportParams: {
      export_draco_mesh_compression_enable: true
    }
  });

  console.log(`Exported ${results.length} files`);
}

// Watch for changes
function watchMyModel() {
  const stopWatching = watchAndExport(
    './models/ship.blend',
    './public/ship.glb',
    {
      exportParams: {
        export_apply_modifiers: true
      }
    }
  );

  // Call stopWatching() when you want to stop
  setTimeout(() => {
    stopWatching();
  }, 60000); // Stop after 1 minute
}
```

## Export Parameters

The following glTF export parameters are supported:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `export_format` | `'GLB'` \| `'GLTF_SEPARATE'` \| `'GLTF_EMBEDDED'` | `'GLB'` | Output format |
| `export_draco_mesh_compression_enable` | `boolean` | `false` | Enable Draco compression |
| `export_apply_modifiers` | `boolean` | `true` | Apply modifiers before export |
| `export_yup` | `boolean` | `true` | Use Y-up coordinate system |
| `export_animations` | `boolean` | `true` | Export animations |
| `export_materials` | `'EXPORT'` \| `'PLACEHOLDER'` \| `'NONE'` | `'EXPORT'` | Material export mode |

See [Blender's glTF export documentation](https://docs.blender.org/api/current/bpy.ops.export_scene.html#bpy.ops.export_scene.gltf) for all available parameters.

## Troubleshooting

### "Blender executable not found"

**Solution**: Set a custom Blender path:

```typescript
await exportBlendToGLB('input.blend', 'output.glb', {
  blenderPath: '/custom/path/to/blender'
});
```

Or for the CLI, edit the `blenderExporter.ts` file to update `getDefaultBlenderPath()`.

### "Export timed out"

**Solution**: Increase the timeout (default is 60 seconds):

```typescript
await exportBlendToGLB('large-model.blend', 'output.glb', {
  timeout: 120000 // 2 minutes
});
```

### Output file not created

Check that:
1. The `.blend` file opens in Blender without errors
2. The output directory exists
3. You have write permissions to the output directory
4. Check the console for Blender error messages

## Example Workflow

Here's a typical development workflow:

```bash
# Terminal 1: Run the dev server
npm run build

# Terminal 2: Watch your ship model
npm run export-blend -- public/ship2.blend public/ship2.glb --watch --compress

# Now edit ship2.blend in Blender
# Every time you save, it will auto-export to ship2.glb
# Refresh your browser to see changes
```

## Integration with Build Process

You can add the batch export to your build process:

```json
{
  "scripts": {
    "prebuild": "npm run export-blend:batch -- public/ public/",
    "build": "tsc && vite build"
  }
}
```

Now all `.blend` files will be exported before every build!

## Performance Tips

1. **Use compression for production**: Add `--compress` flag to reduce file sizes by ~50-70%
2. **Batch exports are sequential**: Large batches may take time
3. **Watch mode debounces**: Changes are detected with 1-second delay to avoid excessive exports
4. **Optimize your models**: Lower poly counts export faster

## Current Project Models

Here are the `.blend` files currently in the project:

```bash
# Export all current models
npm run export-blend -- public/ship1.blend public/ship1.glb
npm run export-blend -- public/ship2.blend public/ship2.glb
npm run export-blend -- public/asteroid4.blend public/asteroid4.glb
npm run export-blend -- public/base.blend public/base.glb

# Or batch export all at once
npm run export-blend:batch -- public/ public/
```
