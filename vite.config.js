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
        background_color: '#1f56d1',
        theme_color: '#1f56d1',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Versão nova entra na hora e apaga os arquivos guardados das versões antigas
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
