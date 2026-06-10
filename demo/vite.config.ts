import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Alias the package to its source so the demo runs without a prior build
// (`pnpm --filter demo dev` works straight away). Dynamic imports inside the
// renderers still code-split exactly as they will for real consumers.
export default defineConfig({
  // Relative base so the build works whether it's served from the domain root
  // (custom domain / user page) or a GitHub Pages project subpath
  // (https://USER.github.io/REPO/). Override with VITE_BASE if you prefer.
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  resolve: {
    alias: {
      'omni-doc-viewer/react': fileURLToPath(
        new URL('../src/react/index.ts', import.meta.url),
      ),
      'omni-doc-viewer': fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
    },
  },
})
