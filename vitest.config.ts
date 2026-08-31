import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

/**
 * Three test projects:
 *  - unit:    pure functions, Node environment (detection, parsers, indexes)
 *  - dom:     renderers / viewer controller / React components in happy-dom
 *  - browser: real engines (pdf.js, docx-preview, SheetJS, pptx-preview) in
 *             headless Chromium. Run with `pnpm test:browser` after
 *             `pnpm exec playwright install chromium` and `pnpm samples`.
 *
 * `pnpm test` runs unit + dom only (see package.json), so contributors without
 * a browser download still get a fast, complete local loop.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['test/dom/**/*.test.{ts,tsx}'],
          setupFiles: ['test/setup.dom.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          testTimeout: 30_000,
          browser: {
            enabled: true,
            headless: true,
            // Failure screenshots are named after the test; keep them off so
            // long names (data: URLs) can't break the run.
            screenshotFailures: false,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
