import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node20',
    sourcemap: true,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js'
    },
    rollupOptions: {
      external: ['vscode', /^node:.*/]
    }
  },
  test: {
    include: ['src/test/**/*.test.ts'],
    exclude: ['dist/**', 'out/**', 'node_modules/**']
  }
});
