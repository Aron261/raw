import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Keep large, rarely-changing vendor code in its own long-cached chunk
        // so app updates don't force users to re-download React/charts.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Raw',
        short_name: 'Raw',
        description: 'Gym workout logger',
        // El hueso del modo claro. Es el color del chrome del sistema y del
        // splash cuando la app está instalada: si se queda con el gris del
        // sistema anterior, la app instalada arranca con un marco que ya no
        // es de ningún sitio antes de pintar su propio fondo.
        theme_color: '#E7E7E4',
        background_color: '#E7E7E4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Los listeners de push viven en public/push-sw.js y se enganchan aquí.
        // La alternativa era pasarse a injectManifest y escribir el service
        // worker entero a mano, lo que obliga a hacerse cargo también de todo
        // el precacheo de abajo a cambio de nada.
        importScripts: ['/push-sw.js'],
        runtimeCaching: [
          {
            // Only cache PUBLIC storage assets (images, etc.). Authenticated
            // REST (/rest/v1) and auth (/auth/v1) responses are deliberately
            // NOT cached by the service worker: persisting per-user data there
            // risks serving stale writes or another user's data after logout on
            // a shared device. In-app freshness is handled by the SWR cache.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-public-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
})
