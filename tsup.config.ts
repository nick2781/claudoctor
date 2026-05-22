import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  minify: false,
  sourcemap: false,
  shims: true,
  banner: { js: '#!/usr/bin/env node' },
});
