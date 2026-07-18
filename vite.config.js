import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
  const isVttBuild = mode === 'vtt';
  return {
    plugins: [react()],
    publicDir: isVttBuild ? false : 'public',
    build: {
      chunkSizeWarningLimit: 1000,
      outDir: isVttBuild ? 'dist-vtt' : 'dist',
      rollupOptions: {
        input: isVttBuild ? 'vtt.html' : 'index.html',
        output: {
          manualChunks: isVttBuild
            ? { vendor: ['react', 'react-dom'] }
            : {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            },
        },
      },
    },
  };
});
