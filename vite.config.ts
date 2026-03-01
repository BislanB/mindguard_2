import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mindguard/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MindGuard',
        short_name: 'MindGuard',
        description: 'Mindfulness, daily reports & focus blocker',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/mindguard/',
        icons: [
          { src: '/mindguard/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/mindguard/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/mindguard/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/mindguard/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
