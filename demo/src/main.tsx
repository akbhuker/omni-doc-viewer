import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DocViewer, type DocType, type RenderMeta } from 'omni-doc-viewer/react'
import './styles.css'

// BASE_URL makes the samples resolve both locally and under a GitHub Pages subpath.
const base = import.meta.env.BASE_URL
const SAMPLES: Array<{ label: string; url: string; type?: DocType }> = [
  { label: 'PDF', url: `${base}samples/sample.pdf` },
  { label: 'Word', url: `${base}samples/sample.docx` },
  { label: 'Excel', url: `${base}samples/sample.xlsx` },
  { label: 'PowerPoint', url: `${base}samples/sample.pptx` },
  { label: 'Image', url: `${base}samples/sample.svg` },
  { label: 'Markdown', url: `${base}samples/sample.md` },
  { label: 'CSV', url: `${base}samples/sample.csv` },
]

function App() {
  const [source, setSource] = useState<File | string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [meta, setMeta] = useState<RenderMeta | null>(null)
  const [dragging, setDragging] = useState(false)
  // Persist the Pages toggle in the URL (?pages=on) so a refresh keeps it.
  const [paginated, setPaginated] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('pages') === 'on',
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    if (paginated) url.searchParams.set('pages', 'on')
    else url.searchParams.delete('pages')
    window.history.replaceState(null, '', url)
  }, [paginated])

  const pick = useCallback((src: File | string, label: string | null) => {
    setMeta(null)
    setActive(label)
    setSource(src)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) pick(file, null)
    },
    [pick],
  )

  return (
    <div className="page">
      <header className="masthead">
        <a
          className="mark"
          href="https://github.com/akbhuker/omni-doc-viewer"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="mark-sq" />
          omni-doc-viewer
        </a>
        <span className="mast-desc">Client-side document renderer</span>
        <nav className="mast-nav">
          <a href="https://www.npmjs.com/package/omni-doc-viewer" target="_blank" rel="noopener noreferrer">
            npm
          </a>
          <a href="https://github.com/akbhuker/omni-doc-viewer" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="wrap">
        <section className="hero">
          <span className="hero-tag reveal">[&nbsp;8&nbsp;formats&nbsp;/&nbsp;0&nbsp;servers&nbsp;]</span>
          <h1 className="display reveal">
            One viewer for
            <br />
            every document.
          </h1>
          <p className="lede reveal">
            PDF, Word, Excel, PowerPoint, images, Markdown and CSV — rendered 100% in the
            browser. No server, no Office iframe, no public URL, no API keys.
          </p>

          <dl className="datasheet reveal">
            <div>
              <dt>Formats</dt>
              <dd>08</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>Client-side</dd>
            </div>
            <div>
              <dt>PDF text</dt>
              <dd>Selectable</dd>
            </div>
            <div>
              <dt>Large files</dt>
              <dd>Virtualized</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>MIT</dd>
            </div>
          </dl>
        </section>

        <section className="console reveal">
          <div className="console-head">
            <span className="ch-title">
              <span className="ch-arrow">▸</span> Sample documents
            </span>
            <div className="ch-right">
              {meta && (
                <span className="meta-tag">
                  {meta.type.toUpperCase()}
                  {meta.pageCount != null && ` · ${meta.pageCount} ${pageWord(meta)}`}
                </span>
              )}
              <button
                type="button"
                className={`ch-toggle${paginated ? ' is-on' : ''}`}
                onClick={() => setPaginated((p) => !p)}
                title="Page navigation: toolbar, jump, zoom, download, print"
              >
                Pages <span className="state">[ {paginated ? 'on' : 'off'} ]</span>
              </button>
            </div>
          </div>

          <ol className="samples">
            {SAMPLES.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  className={`chip${active === s.label ? ' is-active' : ''}`}
                  onClick={() => pick(s.url, s.label)}
                >
                  <span className="s-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="s-name">{s.label}</span>
                </button>
              </li>
            ))}
            <li>
              <label className="chip chip-upload">
                <span className="s-num">+</span>
                <span className="s-name">Upload</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.pptx,.xls,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.txt,.md,.markdown,.csv,.tsv,.log"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pick(f, null)
                  }}
                />
              </label>
            </li>
          </ol>

          <div
            className={`stage${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {source ? (
              <DocViewer
                key={`${typeof source === 'string' ? source : source.name}-${paginated}`}
                className="viewer"
                source={source}
                pagination={paginated}
                onLoad={setMeta}
                loading={<div className="empty"><span className="empty-pulse" />Rendering…</div>}
              />
            ) : (
              <div className="empty">
                <div className="empty-frame" aria-hidden="true">
                  <span />
                </div>
                <div className="empty-line">Drop a file or select a sample</div>
                <div className="empty-sub">Nothing is uploaded — it renders in your browser.</div>
              </div>
            )}
          </div>
        </section>

        <p className="note reveal">
          Turn <strong>Pages</strong> on for the full viewer — navigation, zoom, fit-width,
          download &amp; print. PowerPoint renders as a readable preview (text, shapes,
          images incl. EMF/WMF), not pixel-perfect. Markdown is sanitized before rendering.
          Legacy binary <code>.doc</code> / <code>.ppt</code> aren&rsquo;t supported
          client-side.
        </p>
      </main>

      <footer className="footer wrap">
        <span className="footer-brand">
          <span className="mark-sq" />
          omni-doc-viewer
        </span>
        <span className="footer-meta">MIT · 100% client-side</span>
      </footer>
    </div>
  )
}

function pageWord(meta: RenderMeta): string {
  if (meta.type === 'pptx') return meta.pageCount === 1 ? 'slide' : 'slides'
  if (meta.type === 'xlsx') return meta.pageCount === 1 ? 'sheet' : 'sheets'
  return meta.pageCount === 1 ? 'page' : 'pages'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
