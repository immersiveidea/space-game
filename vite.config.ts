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
                    'babylon': ['@babylonjs/core']
                }
            }
        }
    },
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: 'window',
            }
        }
    },
    server: {
        port: 3001,
    },
    preview: {
        port: 3001,
    },
    base: "/"

})