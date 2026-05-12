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
      includeAssets: ['logo-icon-192.png', 'logo-icon-512.png', 'logo-maarif-hijau.png'],
      manifest: {
        name: 'SIMMACI - Absensi Sekolah',
        short_name: 'Absensi',
        description: 'Sistem Absensi Guru & Siswa LP Ma\'arif NU Cilacap',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/scan',
        icons: [
          {
            src: 'logo-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'logo-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Scanner Absensi',
            short_name: 'Scanner',
            description: 'Buka halaman scanner absensi',
            url: '/scan',
            icons: [{ src: 'logo-icon-192.png', sizes: '192x192' }],
          },
        ],
        categories: ['education', 'productivity'],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB
        clientsClaim: true,
        // skipWaiting intentionally omitted — with registerType: 'prompt', the new SW
        // must wait in the "installed" state until the user confirms the reload.
        // Setting skipWaiting: true here would activate the SW immediately, making
        // updateServiceWorker(true) a no-op and breaking the "Muat Ulang" button.
        navigateFallbackDenylist: [/^\/.*\.xlsx$/],
        runtimeCaching: [
          {
            // Cache public attendance API responses for offline resilience
            urlPattern: /\/api\/public\/attendance\/(schools|classes|subjects|schedules|students)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-attendance-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1 hour
              networkTimeoutSeconds: 5,
            },
          },
        ],
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
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-avatar',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'sonner',
            'cmdk',
            'lucide-react',
          ],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-docx': ['docxtemplater', 'pizzip', 'mammoth'],
          'vendor-qr': ['html5-qrcode', 'qrcode.react', 'react-qr-code'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-date': ['date-fns'],
          'vendor-excel': ['xlsx'],
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
