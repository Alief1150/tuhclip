import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Standalone classic (IIFE) bundle for the manifest content script.
// Manifest-declared content scripts cannot load Vite/Rollup ESM chunks,
// so this build inlines every dependency into one file.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: {
        content: resolve(root, 'src/content/index.ts'),
      },
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'content.js',
      },
    },
  },
});
