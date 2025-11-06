import { spawn } from 'child_process';
import { platform } from 'os';
import { existsSync, watch } from 'fs';
import path from 'path';

/**
 * Configuration options for Blender export
 */
export interface BlenderExportOptions {
    /**
     * Custom path to Blender executable (optional)
     * If not provided, will use default paths for the current platform
     */
    blenderPath?: string;

    /**
     * Additional glTF export parameters
     * See: https://docs.blender.org/api/current/bpy.ops.export_scene.html#bpy.ops.export_scene.gltf
     */
    exportParams?: {
        export_format?: 'GLB' | 'GLTF_SEPARATE' | 'GLTF_EMBEDDED';
        export_draco_mesh_compression_enable?: boolean;
        export_texture_dir?: string;
        export_apply_modifiers?: boolean;
        export_yup?: boolean;
        export_animations?: boolean;
        export_materials?: 'EXPORT' | 'PLACEHOLDER' | 'NONE';
        [key: string]: any;
    };

    /**
     * Timeout in milliseconds (default: 60000 = 1 minute)
     */
    timeout?: number;
}

/**
 * Result of a Blender export operation
 */
export interface BlenderExportResult {
    success: boolean;
    outputPath: string;
    stdout: string;
    stderr: string;
    duration: number; // milliseconds
}

/**
 * Get the default Blender executable path for the current platform
 */
function getDefaultBlenderPath(): string {
    const os = platform();

    switch (os) {
        case 'darwin': // macOS
            return '/Applications/Blender.app/Contents/MacOS/Blender';
        case 'win32': // Windows
            // Try common installation paths
            const windowsPaths = [
                'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
            ];
            for (const p of windowsPaths) {
                if (existsSync(p)) return p;
            }
            return 'blender'; // Fall back to PATH
        case 'linux':
            return 'blender'; // Assume it's in PATH
        default:
            return 'blender';
    }
}

/**
 * Build the Python expression for glTF export
 */
function buildPythonExpr(outputPath: string, options?: BlenderExportOptions['exportParams']): string {
    const params: string[] = [`filepath='${outputPath.replace(/\\/g, '/')}'`];

    if (options) {
        for (const [key, value] of Object.entries(options)) {
            if (typeof value === 'boolean') {
                params.push(`${key}=${value ? 'True' : 'False'}`);
            } else if (typeof value === 'string') {
                params.push(`${key}='${value}'`);
            } else if (typeof value === 'number') {
                params.push(`${key}=${value}`);
            }
        }
    }

    return `import bpy; bpy.ops.export_scene.gltf(${params.join(', ')})`;
}

/**
 * Export a Blender file to GLB format using Blender's command-line interface
 *
 * @param blendFilePath - Path to the input .blend file
 * @param outputPath - Path for the output .glb file
 * @param options - Optional configuration for the export
 * @returns Promise that resolves with export result
 *
 * @example
 * ```typescript
 * // Basic usage
 * await exportBlendToGLB('./models/ship.blend', './public/ship.glb');
 *
 * // With options
 * await exportBlendToGLB('./models/asteroid.blend', './public/asteroid.glb', {
 *   exportParams: {
 *     export_draco_mesh_compression_enable: true,
 *     export_apply_modifiers: true
 *   }
 * });
 *
 * // With custom Blender path
 * await exportBlendToGLB('./model.blend', './output.glb', {
 *   blenderPath: '/custom/path/to/blender'
 * });
 * ```
 */
export async function exportBlendToGLB(
    blendFilePath: string,
    outputPath: string,
    options?: BlenderExportOptions
): Promise<BlenderExportResult> {
    const startTime = Date.now();

    // Validate input file exists
    if (!existsSync(blendFilePath)) {
        throw new Error(`Input blend file not found: ${blendFilePath}`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!existsSync(outputDir)) {
        throw new Error(`Output directory does not exist: ${outputDir}`);
    }

    // Get Blender executable path
    const blenderPath = options?.blenderPath || getDefaultBlenderPath();

    // Verify Blender exists
    if (blenderPath !== 'blender' && !existsSync(blenderPath)) {
        throw new Error(`Blender executable not found at: ${blenderPath}`);
    }

    // Build Python expression
    const pythonExpr = buildPythonExpr(outputPath, options?.exportParams);

    // Build command arguments
    const args = [
        '-b',              // Background mode (no UI)
        blendFilePath,     // Input file
        '--python-expr',   // Execute Python expression
        pythonExpr         // The export command
    ];

    console.log(`[BlenderExporter] Running: ${blenderPath} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const process = spawn(blenderPath, args, {
            shell: false,
            windowsHide: true
        });

        // Set timeout
        const timeout = options?.timeout || 60000;
        const timeoutId = setTimeout(() => {
            process.kill();
            reject(new Error(`Blender export timed out after ${timeout}ms`));
        }, timeout);

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to spawn Blender process: ${error.message}`));
        });

        process.on('close', (code) => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            if (code === 0) {
                // Check if output file was created
                if (existsSync(outputPath)) {
                    console.log(`[BlenderExporter] Successfully exported to ${outputPath} in ${duration}ms`);
                    resolve({
                        success: true,
                        outputPath,
                        stdout,
                        stderr,
                        duration
                    });
                } else {
                    reject(new Error(`Blender exited successfully but output file was not created: ${outputPath}`));
                }
            } else {
                const error = new Error(
                    `Blender export failed with exit code ${code}\n` +
                    `STDERR: ${stderr}\n` +
                    `STDOUT: ${stdout}`
                );
                reject(error);
            }
        });
    });
}

/**
 * Batch export multiple Blender files to GLB
 *
 * @param exports - Array of [inputPath, outputPath] tuples
 * @param options - Optional configuration for all exports
 * @param sequential - If true, run exports one at a time (default: false for parallel)
 * @returns Promise that resolves with array of results
 *
 * @example
 * ```typescript
 * const results = await batchExportBlendToGLB([
 *   ['./ship1.blend', './public/ship1.glb'],
 *   ['./ship2.blend', './public/ship2.glb'],
 *   ['./asteroid.blend', './public/asteroid.glb']
 * ], {
 *   exportParams: { export_draco_mesh_compression_enable: true }
 * });
 * ```
 */
export async function batchExportBlendToGLB(
    exports: Array<[string, string]>,
    options?: BlenderExportOptions,
    sequential: boolean = false
): Promise<BlenderExportResult[]> {
    if (sequential) {
        const results: BlenderExportResult[] = [];
        for (const [input, output] of exports) {
            const result = await exportBlendToGLB(input, output, options);
            results.push(result);
        }
        return results;
    } else {
        return Promise.all(
            exports.map(([input, output]) => exportBlendToGLB(input, output, options))
        );
    }
}

/**
 * Watch a Blender file and auto-export on changes
 * (Requires fs.watch - Node.js only, not for browser)
 *
 * @param blendFilePath - Path to watch
 * @param outputPath - Output GLB path
 * @param options - Export options
 * @returns Function to stop watching
 */
export function watchAndExport(
    blendFilePath: string,
    outputPath: string,
    options?: BlenderExportOptions
): () => void {
    console.log(`[BlenderExporter] Watching ${blendFilePath} for changes...`);

    let debounceTimer: NodeJS.Timeout | null = null;

    const watcher = watch(blendFilePath, (eventType: string) => {
        if (eventType === 'change') {
            // Debounce: wait 1 second after last change
            if (debounceTimer) clearTimeout(debounceTimer);

            debounceTimer = setTimeout(async () => {
                console.log(`[BlenderExporter] Detected change in ${blendFilePath}, exporting...`);
                try {
                    await exportBlendToGLB(blendFilePath, outputPath, options);
                } catch (error) {
                    console.error(`[BlenderExporter] Export failed:`, error);
                }
            }, 1000);
        }
    });

    // Return cleanup function
    return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        watcher.close();
        console.log(`[BlenderExporter] Stopped watching ${blendFilePath}`);
    };
}
