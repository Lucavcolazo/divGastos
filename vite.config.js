import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build funciona en GitHub Pages, Vercel o abriendo dist/ desde cualquier carpeta
  base: './',
  build: {
    // three.js va en su propio chunk (~530 kB, ~130 kB gzip) y se carga después de la app
    chunkSizeWarningLimit: 600,
  },
});
