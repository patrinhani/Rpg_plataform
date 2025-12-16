import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Aumenta o limite de aviso de tamanho de arquivo para 1MB (padrão é 500kb)
    // Isso evita avisos no terminal, já que estamos separando os chunks propositalmente
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      output: {
        manualChunks: {
          // Cria um arquivo separado apenas para o React e Rotas (cache longo)
          vendor: ['react', 'react-dom', 'react-router-dom'],
          
          // Cria um arquivo separado para o Firebase (que é pesado)
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
})