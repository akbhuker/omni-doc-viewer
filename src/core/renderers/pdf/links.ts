/**
 * The small subset of pdf.js's `PDFLinkService` that `AnnotationLayer` calls
 * for link annotations. Implemented locally so we don't ship
 * `pdfjs-dist/web/pdf_viewer.mjs` (the whole viewer) just for links.
 */
export interface LinkServiceOptions {
  pdf: any
  pageCount: number
  getPage: () => number
  navigate: (page: number) => void
  externalLinkTarget: '_blank' | '_self'
}

const noop = () => {}

export function createLinkService(opts: LinkServiceOptions) {
  const { pdf } = opts

  async function pageNumberFor(dest: unknown): Promise<number | undefined> {
    let explicit: any = dest
    if (typeof dest === 'string') explicit = await pdf.getDestination(dest)
    if (!Array.isArray(explicit) || explicit.length === 0) return undefined
    const ref = explicit[0]
    if (typeof ref === 'number') return ref + 1
    if (ref && typeof ref === 'object') {
      try {
        return (await pdf.getPageIndex(ref)) + 1
      } catch {
        return undefined
      }
    }
    return undefined
  }

  return {
    eventBus: { dispatch: noop, on: noop, off: noop, _on: noop, _off: noop },
    externalLinkEnabled: true,
    externalLinkRel: 'noopener noreferrer nofollow',
    isInPresentationMode: false,
    get pagesCount() {
      return opts.pageCount
    },
    get page() {
      return opts.getPage()
    },
    set page(_n: number) {},
    rotation: 0,

    getDestinationHash(dest: unknown): string {
      if (typeof dest === 'string') return `#${encodeURIComponent(dest)}`
      return `#${encodeURIComponent(JSON.stringify(dest ?? ''))}`
    },
    getAnchorUrl(hash: string): string {
      return hash || '#'
    },
    addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow?: boolean): void {
      link.href = url
      link.target = newWindow || opts.externalLinkTarget === '_blank' ? '_blank' : '_self'
      link.rel = 'noopener noreferrer nofollow'
    },
    async goToDestination(dest: unknown): Promise<void> {
      const page = await pageNumberFor(dest)
      if (page) opts.navigate(page)
    },
    goToPage(n: number | string): void {
      const page = Number(n)
      if (Number.isFinite(page)) opts.navigate(page)
    },
    executeNamedAction(action: string): void {
      const current = opts.getPage()
      switch (action) {
        case 'NextPage':
          opts.navigate(Math.min(current + 1, opts.pageCount))
          break
        case 'PrevPage':
          opts.navigate(Math.max(current - 1, 1))
          break
        case 'FirstPage':
          opts.navigate(1)
          break
        case 'LastPage':
          opts.navigate(opts.pageCount)
          break
        default:
          break
      }
    },
    executeSetOCGState: noop,
    setHash: noop,
  }
}
