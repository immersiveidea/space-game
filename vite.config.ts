import {defineConfig} from "vite";
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** @type {import('vite').UserConfig} */
export default defineConfig({
    plugins: [svelte()],
    test: {},
    define: {},
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'babylon': ['@babylonjs/core'],
                    'babylon-procedural': ['@babylonjs/procedural-textures'],
                    'babylon-inspector': ['@babylonjs/inspector'],
                }
            }
        }
    },
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: 'window',
            }
        },
        // Include BabylonJS modules - force pre-bundle to prevent dynamic import issues
        include: [
            '@babylonjs/core',
            '@babylonjs/loaders',
            '@babylonjs/havok',
            '@babylonjs/materials',
            '@babylonjs/procedural-textures',
            '@babylonjs/procedural-textures/fireProceduralTexture'
        ],
        // Prevent cache invalidation issues with CloudFlare proxy
        force: false,
        // Exclude patterns that trigger unnecessary re-optimization
        exclude: []
    },
    server: {
        port: 3000,
        allowedHosts: true
    },
    // appType: 'spa' is default - Vite automatically serves index.html for SPA routes
    preview: {
        port: 3000,
    },
    base: "/"

})