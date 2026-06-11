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
    <>
      <header>
        <div className="wrap">
          <div className="kicker">omni-doc-viewer</div>
          <h1>One viewer for PDF, Word, Excel and PowerPoint</h1>
          <p className="lede">
            A drop-in document viewer that runs entirely in the browser. No server, no
            Microsoft Office iframe, no public-URL requirement, and no API keys.
          </p>
          <ul className="facts">
            <li>PDF, .docx, .xlsx / .xls, .pptx</li>
            <li>Works offline</li>
            <li>Per-format engines loaded on demand</li>
            <li>MIT licensed</li>
          </ul>
        </div>
      </header>

      <main className="wrap">
        <div className="toolbar">
          <span className="label">Try a sample</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`btn${active === s.label ? ' is-active' : ''}`}
              onClick={() => pick(s.url, s.label)}
            >
              {s.label}
            </button>
          ))}
          <label className="btn file">
            Choose file
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pick(f, null)
              }}
            />
          </label>
          <button
            type="button"
            className={`btn${paginated ? ' is-active' : ''}`}
            onClick={() => setPaginated((p) => !p)}
            title="Toggle the paginated viewer (toolbar, page jump, zoom, scroll)"
          >
            Pages: {paginated ? 'On' : 'Off'}
          </button>
          <span className="spacer" />
          {meta && (
            <span className="meta">
              <strong>{meta.type.toUpperCase()}</strong>
              {meta.pageCount != null && ` · ${meta.pageCount} ${pageWord(meta)}`}
            </span>
          )}
        </div>

        <div className="stage">
          <div
            className={`dropzone${dragging ? ' dragging' : ''}`}
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
                loading={<div className="empty"><div className="big">Loading</div></div>}
              />
            ) : (
              <div className="empty">
                <div className="big">Drag and drop a document</div>
                <div>or choose a sample above</div>
              </div>
            )}
          </div>
        </div>

        <p className="note">
          PowerPoint is rendered as a readable preview (text, lists, basic shapes, images),
          not a pixel-perfect render; animations, transitions, charts and SmartArt are out of
          scope. Legacy binary <code>.doc</code> and <code>.ppt</code> files are not supported
          client-side.
        </p>
      </main>

      <footer className="wrap">
        <span>omni-doc-viewer</span>
        <a href="https://www.npmjs.com/package/omni-doc-viewer" target="_blank" rel="noopener noreferrer">
          npm
        </a>
        <a href="https://github.com/akbhuker/omni-doc-viewer" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span className="spacer" />
        <span>MIT licensed</span>
      </footer>
    </>
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
