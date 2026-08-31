import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/core/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  // Heavy engines stay external so the consumer's bundler code-splits them
  // (they are dynamically imported inside each renderer).
  external: [
    'react',
    'react-dom',
    'pdfjs-dist',
    'docx-preview',
    '@e965/xlsx',
    'pptx-preview',
  ],
})
