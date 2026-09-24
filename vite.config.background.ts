import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';

  return {
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
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
};
});
