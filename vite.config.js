import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// O plugin PWA gera o "service worker": um arquivo que guarda o app no
// aparelho para ele abrir mesmo SEM internet.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apta-marca.svg', 'apta-marca-escuro.svg'],
      manifest: {
        name: 'Apta · provas prontas para toda a turma',
        short_name: 'Apta',
        description: 'Apta: prova, versão adaptada e gabarito prontos para imprimir, mesmo sem internet.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#FAF8F3',
        theme_color: '#FAF8F3',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
