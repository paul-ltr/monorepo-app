import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pilotage — Console opérateur',
        short_name: 'Pilotage',
        description: 'Console opérateur ERP pour laveries en libre-service',
        lang: 'fr',
        theme_color: '#0E1A2E',
        background_color: '#F4F6F8',
        display: 'standalone',
        icons: [],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/] },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@pilotage/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@pilotage/api-client': resolve(__dirname, '../../packages/api-client/src/index.ts'),
    },
  },
  server: { port: 5173, host: true, strictPort: true },
});
