import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DocViewer, type DocType, type RenderMeta, type RenderWarning, type ViewerHandle } from 'omni-doc-viewer/react'
import { useRef } from 'react'
import './styles.css'

// BASE_URL makes the samples resolve both locally and under a GitHub Pages subpath.
const base = import.meta.env.BASE_URL
const SAMPLES: Array<{ label: string; url: string; type?: DocType }> = [
  { label: 'PDF', url: `${base}samples/sample.pdf` },
  { label: 'PDF (password)', url: `${base}samples/sample-protected.pdf` },
  { label: 'Word', url: `${base}samples/sample.docx` },
  { label: 'Excel', url: `${base}samples/sample.xlsx` },
  { label: 'PowerPoint', url: `${base}samples/sample.pptx` },
  { label: 'Image', url: `${base}samples/sample.svg` },
  { label: 'Markdown', url: `${base}samples/sample.md` },
  { label: 'CSV', url: `${base}samples/sample.csv` },
  { label: 'JSON', url: `${base}samples/sample.json` },
  { label: 'Code', url: `${base}samples/sample.ts` },
  { label: 'HTML', url: `${base}samples/sample.html` },
  { label: 'Text', url: `${base}samples/sample.txt` },
  { label: 'Audio', url: `${base}samples/sample.wav` },
]

/**
 * The video sample is synthesized in the browser (canvas → MediaRecorder), so
 * no binary video needs to be shipped with the demo.
 */
async function makeVideoSample(seconds = 3): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')!
  const stream = canvas.captureStream(30)
  const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((r) => (rec.onstop = () => r()))
  rec.start(100)
  const t0 = performance.now()
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = (performance.now() - t0) / 1000
      ctx.fillStyle = `hsl(${(t * 60) % 360} 70% 45%)`
      ctx.fillRect(0, 0, 640, 360)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 44px system-ui, sans-serif'
      ctx.fillText('omni-doc-viewer', 40, 120)
      ctx.font = '24px system-ui, sans-serif'
      ctx.fillText(`generated in your browser · ${t.toFixed(1)}s`, 40, 170)
      ctx.beginPath()
      ctx.arc(320 + Math.cos(t * 3) * 120, 260 + Math.sin(t * 3) * 40, 24, 0, Math.PI * 2)
      ctx.fill()
      if (t < seconds) requestAnimationFrame(frame)
      else resolve()
    }
    frame()
  })
  rec.stop()
  await done
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  return new File(chunks, `generated.${ext}`, { type: mime || 'video/webm' })
}

function App() {
  const [source, setSource] = useState<File | string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [meta, setMeta] = useState<RenderMeta | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dark, setDark] = useState(false)
  const [thumbs, setThumbs] = useState(false)
  const [warnings, setWarnings] = useState<RenderWarning[]>([])
  const viewer = useRef<ViewerHandle>(null)
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
    setWarnings([])
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
          <span className="hero-tag reveal">[&nbsp;13&nbsp;formats&nbsp;/&nbsp;0&nbsp;servers&nbsp;]</span>
          <h1 className="display reveal">
            One viewer for
            <br />
            every document.
          </h1>
          <p className="lede reveal">
            PDF, Word, Excel, PowerPoint, images, Markdown, CSV, JSON, code, HTML, video and
            audio — rendered 100% in the browser. No server, no Office iframe, no public URL,
            no API keys.
          </p>

          <dl className="datasheet reveal">
            <div>
              <dt>Formats</dt>
              <dd>13</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>Client-side</dd>
            </div>
            <div>
              <dt>Search</dt>
              <dd>Built-in</dd>
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
                title="Page navigation: toolbar, jump, zoom, search, download, print"
              >
                Pages <span className="state">[ {paginated ? 'on' : 'off'} ]</span>
              </button>
              <button
                type="button"
                className={`ch-toggle${thumbs ? ' is-on' : ''}`}
                onClick={() => setThumbs((t) => !t)}
                title="Thumbnail sidebar (with Pages on)"
              >
                Thumbs <span className="state">[ {thumbs ? 'on' : 'off'} ]</span>
              </button>
              <button
                type="button"
                className={`ch-toggle${dark ? ' is-on' : ''}`}
                onClick={() => setDark((v) => !v)}
                title="Viewer theme"
              >
                Dark <span className="state">[ {dark ? 'on' : 'off'} ]</span>
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
              <button
                type="button"
                className={`chip${active === 'Video' ? ' is-active' : ''}`}
                onClick={async () => {
                  setActive('Video')
                  pick(await makeVideoSample(), 'Video')
                }}
                title="Synthesized in your browser with MediaRecorder"
              >
                <span className="s-num">{String(SAMPLES.length + 1).padStart(2, '0')}</span>
                <span className="s-name">Video</span>
              </button>
            </li>
            <li>
              <label className="chip chip-upload">
                <span className="s-num">+</span>
                <span className="s-name">Upload</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.pptx,.xls,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.txt,.md,.markdown,.csv,.tsv,.log,.json,.html,.htm,.js,.ts,.tsx,.py,.xml,.yaml,.yml,.css,.sql,.sh,.mp4,.webm,.mp3,.wav,.ogg,.m4a"
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
                ref={viewer}
                className="viewer"
                source={source}
                pagination={paginated}
                thumbnails={thumbs}
                theme={dark ? 'dark' : 'light'}
                onLoad={setMeta}
                onWarning={(w) => setWarnings((ws) => [...ws, w])}
                loading={(p) => (
                  <div className="empty">
                    <span className="empty-pulse" />
                    Rendering…{p?.total ? ` ${Math.round((p.loaded / p.total) * 100)}%` : ''}
                  </div>
                )}
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

        {warnings.length > 0 && (
          <ul className="warnings reveal" aria-label="Renderer warnings">
            {warnings.map((w, i) => (
              <li key={i}>
                <code>{w.code}</code> {w.message}
              </li>
            ))}
          </ul>
        )}

        <p className="note reveal">
          Turn <strong>Pages</strong> on for the full viewer — navigation, zoom, fit-width, search
          (<kbd>Ctrl</kbd>+<kbd>F</kbd>), thumbnails, rotation, download &amp; print. The password
          for the protected PDF sample is <code>secret</code>. The Video sample is synthesized in your
          browser. PowerPoint renders as a readable preview (text, shapes,
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
