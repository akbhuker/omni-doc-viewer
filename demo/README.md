# omni-doc-viewer demo

A Vite + React playground for the package.

```bash
pnpm install
pnpm --filter omni-doc-viewer-demo dev
# or from the repo root: pnpm dev:demo
```

Then open the printed URL, drop a `.pdf`/`.docx`/`.xlsx`/`.pptx`, and confirm it
renders. Toggle **DevTools → Network → Offline** and reload to prove there is no
server/CDN dependency.

The sample files (`sample.pdf/.docx/.xlsx/.pptx`) in `demo/public/samples/` are
generated programmatically — regenerate them any time with:

```bash
pnpm samples   # runs scripts/make-samples.mjs from the repo root
```

Drop your own files onto the demo (or replace the ones in `samples/`) to test
real documents.
