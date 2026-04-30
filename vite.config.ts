import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        clientsClaim: true,
        // skipWaiting intentionally omitted — with registerType: 'prompt', the new SW
        // must wait in the "installed" state until the user confirms the reload.
        // Setting skipWaiting: true here would activate the SW immediately, making
        // updateServiceWorker(true) a no-op and breaking the "Muat Ulang" button.
        navigateFallbackDenylist: [/^\/.*\.xlsx$/]
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
        warn(warning);
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
  server: {
    proxy: {
      '^/TEMPLATE_IMPORT_DATA_.*\\.xlsx$': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
});
