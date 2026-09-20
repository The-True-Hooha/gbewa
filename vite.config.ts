import { resolve } from 'path'
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'

import manifest from './src/manifest'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        // offscreen.html and welcome.html aren't referenced by any manifest
        // key, so crx() won't discover them on its own — add explicitly.
        input: {
          offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
          welcome: resolve(__dirname, 'welcome.html'),
        },
        output: {
          chunkFileNames: 'assets/chunk-[hash].js',
        },
      },
    },
    plugins: [crx({ manifest }), react()],
    legacy: {
      skipWebSocketTokenCheck: true,
    },
  }
})
