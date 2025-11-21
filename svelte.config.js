import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Preprocess TypeScript and other syntax
  preprocess: vitePreprocess(),

  compilerOptions: {
    // Enable HMR in development
    hmr: true,
  }
};
