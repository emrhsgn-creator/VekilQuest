import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' sayesinde uygulama hem kök dizinde hem de
// GitHub Pages alt yolunda (/<repo>/) sorunsuz çalışır.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
