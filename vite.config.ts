import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync } from 'node:fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Disable minification to avoid variable name collisions in chunk inlining
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
        'page-script': resolve(__dirname, 'src/content/page-script.ts')
      },
      output: {
        entryFileNames: '[name].js',
        // Put shared chunks in the root (not a subdirectory) so content scripts can load them
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
      }
    }
  ]
});