import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from https://<user>.github.io/purrfect-pitch/
  base: '/purrfect-pitch/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Purrfect Pitch — Tuner, Metronome & Sight Reading',
        short_name: 'Purrfect',
        description: 'Cute cat chromatic tuner with adjustable A4 reference, a metronome, and a mic-checked sight-reading trainer',
        theme_color: '#fff1dc',
        background_color: '#fff1dc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
