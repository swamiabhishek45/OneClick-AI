import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    lib: {
      entry: resolve(__dirname, 'src/content/content.tsx'),
      name: 'OneClickAutofillContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
