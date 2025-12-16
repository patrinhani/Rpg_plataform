// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'; // <--- Importe isto

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({ // <--- Adicione esta configuração
      png: { quality: 80 },
      jpeg: { quality: 75 },
      webp: { quality: 80, lossless: false },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
});