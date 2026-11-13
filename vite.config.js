import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// O plugin PWA gera o "service worker": um arquivo que guarda o app no
// aparelho para ele abrir mesmo SEM internet.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Prova Izi',
        short_name: 'Prova Izi',
        description: 'Prova Izi — monte provas rápidas, com versão adaptada, mesmo sem internet.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
