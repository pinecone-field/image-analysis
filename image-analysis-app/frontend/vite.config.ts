import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/images': 'http://localhost:8000',
      '/objects': 'http://localhost:8000',
    },
  },
});
