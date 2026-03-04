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
        // Shaders must be explicitly included to avoid dynamic import failures through CloudFlare proxy
        include: [
            '@babylonjs/core',
            // Core shaders (WebGL)
            '@babylonjs/core/Shaders/default.vertex',
            '@babylonjs/core/Shaders/default.fragment',
            '@babylonjs/core/Shaders/rgbdDecode.fragment',
            '@babylonjs/core/Shaders/procedural.vertex',
            // PBR shaders (WebGL)
            '@babylonjs/core/Shaders/pbr.vertex',
            '@babylonjs/core/Shaders/pbr.fragment',
            '@babylonjs/core/Shaders/pbrDebug.fragment',
            // Particle shaders (WebGL)
            '@babylonjs/core/Shaders/particles.vertex',
            '@babylonjs/core/Shaders/particles.fragment',
            '@babylonjs/core/Shaders/gpuRenderParticles.vertex',
            '@babylonjs/core/Shaders/gpuRenderParticles.fragment',
            // Other common shaders (WebGL)
            '@babylonjs/core/Shaders/standard.fragment',
            '@babylonjs/core/Shaders/postprocess.vertex',
            '@babylonjs/core/Shaders/pass.fragment',
            '@babylonjs/core/Shaders/shadowMap.vertex',
            '@babylonjs/core/Shaders/shadowMap.fragment',
            '@babylonjs/core/Shaders/depth.vertex',
            '@babylonjs/core/Shaders/depth.fragment',
            // WGSL shaders (WebGPU equivalents)
            '@babylonjs/core/ShadersWGSL/default.vertex',
            '@babylonjs/core/ShadersWGSL/default.fragment',
            '@babylonjs/core/ShadersWGSL/rgbdDecode.fragment',
            '@babylonjs/core/ShadersWGSL/procedural.vertex',
            '@babylonjs/core/ShadersWGSL/pbr.vertex',
            '@babylonjs/core/ShadersWGSL/pbr.fragment',
            '@babylonjs/core/ShadersWGSL/particles.vertex',
            '@babylonjs/core/ShadersWGSL/particles.fragment',
            '@babylonjs/core/ShadersWGSL/postprocess.vertex',
            '@babylonjs/core/ShadersWGSL/pass.fragment',
            '@babylonjs/core/ShadersWGSL/shadowMap.vertex',
            '@babylonjs/core/ShadersWGSL/shadowMap.fragment',
            '@babylonjs/core/ShadersWGSL/depth.vertex',
            '@babylonjs/core/ShadersWGSL/depth.fragment',
            '@babylonjs/loaders',
            '@babylonjs/havok',
            '@babylonjs/materials',
            '@babylonjs/procedural-textures'
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