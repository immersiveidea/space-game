#!/usr/bin/env tsx

/**
 * CLI script to export Blender files to GLB format
 *
 * Usage:
 *   tsx scripts/exportBlend.ts <input.blend> <output.glb>
 *   npm run export-blend -- <input.blend> <output.glb>
 *
 * Examples:
 *   npm run export-blend -- public/ship1.blend public/ship1.glb
 *   npm run export-blend -- public/asteroid4.blend public/asteroid4.glb
 *
 * Options:
 *   --watch         Watch the input file and auto-export on changes
 *   --compress      Enable Draco mesh compression
 *   --no-modifiers  Don't apply modifiers
 *   --batch         Export all .blend files in a directory
 */

import { exportBlendToGLB, watchAndExport, batchExportBlendToGLB } from '../src/utils/blenderExporter.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';

interface CLIArgs {
    input?: string;
    output?: string;
    watch: boolean;
    compress: boolean;
    noModifiers: boolean;
    batch: boolean;
}

function parseArgs(): CLIArgs {
    const args: CLIArgs = {
        watch: false,
        compress: false,
        noModifiers: false,
        batch: false
    };

    const rawArgs = process.argv.slice(2);

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];

        if (arg === '--watch') {
            args.watch = true;
        } else if (arg === '--compress') {
            args.compress = true;
        } else if (arg === '--no-modifiers') {
            args.noModifiers = true;
        } else if (arg === '--batch') {
            args.batch = true;
        } else if (!args.input) {
            args.input = arg;
        } else if (!args.output) {
            args.output = arg;
        }
    }

    return args;
}

function printUsage() {
    console.log(`
Usage: npm run export-blend -- <input.blend> <output.glb> [options]

Options:
  --watch         Watch the input file and auto-export on changes
  --compress      Enable Draco mesh compression
  --no-modifiers  Don't apply modifiers during export
  --batch         Export all .blend files in input directory

Examples:
  npm run export-blend -- public/ship1.blend public/ship1.glb
  npm run export-blend -- public/ship1.blend public/ship1.glb --compress
  npm run export-blend -- public/ship1.blend public/ship1.glb --watch
  npm run export-blend -- public/ public/ --batch
    `);
}

async function main() {
    const args = parseArgs();

    if (!args.input) {
        console.error('Error: Input file or directory required\n');
        printUsage();
        process.exit(1);
    }

    // Build export options
    const options = {
        exportParams: {
            export_format: 'GLB' as const,
            export_draco_mesh_compression_enable: args.compress,
            export_apply_modifiers: !args.noModifiers,
            export_yup: true
        }
    };

    try {
        if (args.batch) {
            // Batch export mode
            await batchExportMode(args.input, args.output || args.input, options);
        } else if (args.watch) {
            // Watch mode
            if (!args.output) {
                console.error('Error: Output file required for watch mode\n');
                printUsage();
                process.exit(1);
            }
            await watchMode(args.input, args.output, options);
        } else {
            // Single export mode
            if (!args.output) {
                console.error('Error: Output file required\n');
                printUsage();
                process.exit(1);
            }
            await singleExportMode(args.input, args.output, options);
        }
    } catch (error) {
        console.error('Export failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

async function singleExportMode(input: string, output: string, options: any) {
    console.log(`Exporting ${input} to ${output}...`);
    const result = await exportBlendToGLB(input, output, options);

    if (result.success) {
        console.log(`✅ Successfully exported in ${result.duration}ms`);
        console.log(`   Output: ${result.outputPath}`);
    }
}

async function watchMode(input: string, output: string, options: any) {
    console.log(`👀 Watching ${input} for changes...`);
    console.log(`   Will export to ${output}`);
    console.log(`   Press Ctrl+C to stop\n`);

    // Do initial export
    try {
        await exportBlendToGLB(input, output, options);
        console.log('✅ Initial export complete\n');
    } catch (error) {
        console.error('❌ Initial export failed:', error);
    }

    // Start watching
    const stopWatching = watchAndExport(input, output, options);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n\nStopping watch mode...');
        stopWatching();
        process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
}

async function batchExportMode(inputDir: string, outputDir: string, options: any) {
    console.log(`📦 Batch exporting .blend files from ${inputDir}...`);

    // Find all .blend files in input directory
    const files = readdirSync(inputDir)
        .filter(f => f.endsWith('.blend') && !f.endsWith('.blend1'))
        .filter(f => {
            const fullPath = path.join(inputDir, f);
            return statSync(fullPath).isFile();
        });

    if (files.length === 0) {
        console.log('No .blend files found in directory');
        return;
    }

    console.log(`Found ${files.length} .blend file(s):`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');

    const exports: Array<[string, string]> = files.map(f => {
        const inputPath = path.join(inputDir, f);
        const outputPath = path.join(outputDir, f.replace('.blend', '.glb'));
        return [inputPath, outputPath];
    });

    const results = await batchExportBlendToGLB(exports, options, true); // Sequential

    // Print summary
    console.log('\n📊 Export Summary:');
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Successful: ${successful}/${results.length}`);

    results.forEach((result, i) => {
        const [input] = exports[i];
        const filename = path.basename(input);
        if (result.success) {
            console.log(`   ✓ ${filename} (${result.duration}ms)`);
        } else {
            console.log(`   ✗ ${filename} - FAILED`);
        }
    });
}

// Run the script
main();
