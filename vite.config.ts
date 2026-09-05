import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const manifest = {
  manifest_version: 3,
  name: 'tuhclip',
  version: '0.1.0',
  minimum_chrome_version: '116',
  description: 'Local Google Meet caption transcripts in the Chrome side panel.',
  permissions: ['sidePanel'],
  host_permissions: ['https://meet.google.com/*'],
  background: { service_worker: 'assets/background.js', type: 'module' },
  action: { default_title: 'Open tuhclip' },
  side_panel: { default_path: 'sidepanel.html' },
  content_scripts: [{
    matches: ['https://meet.google.com/*'],
    js: ['assets/content.js'],
    run_at: 'document_idle',
  }],
  icons: { 128: 'paperclip.png' },
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'extension-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(manifest, null, 2),
        });
      },
    },
  ],
  publicDir: 'logo',
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'sidepanel.html'),
        background: resolve(root, 'src/background/serviceWorker.ts'),
        content: resolve(root, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
