import {defineConfig} from "vite";

/** @type {import('vite').UserConfig} */
export default defineConfig({
    test: {},
    define: {},
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'babylon': ['@babylonjs/core'],
                    'babylon-procedural': ['@babylonjs/procedural-textures']
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
    preview: {
        port: 3000,
    },
    base: "/"

})