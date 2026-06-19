import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
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
      entry: resolve(__dirname, 'src/background/background.ts'),
      name: 'OneClickAutofillBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
