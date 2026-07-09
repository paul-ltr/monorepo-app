import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // amazon-cognito-identity-js references `global` in the browser.
  define: { global: 'globalThis' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LavoPilot — Console opérateur',
        short_name: 'LavoPilot',
        description: 'Console opérateur ERP pour laveries en libre-service',
        lang: 'fr',
        theme_color: '#0E1A2E',
        background_color: '#F4F6F8',
        display: 'standalone',
        icons: [
          { src: '/icon-256.png', sizes: '256x256', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
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
  server: { port: Number(process.env.PORT) || 5173, host: true, strictPort: false },
});
