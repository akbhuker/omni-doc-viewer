import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 2 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { DocViewer } from '../../src/react/DocViewer'
import { getInjectedCss, __resetStylesForTests } from '../../src/core/styles'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

describe('<DocViewer> theming', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('sets data-odv-theme on the root only when a theme is requested', async () => {
    const { container, rerender } = render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-odv-theme')).toBeNull()

    rerender(<DocViewer source={bytes} type="pdf" pagination theme="dark" />)
    expect(root.getAttribute('data-odv-theme')).toBe('dark')
    rerender(<DocViewer source={bytes} type="pdf" pagination theme="auto" />)
    expect(root.getAttribute('data-odv-theme')).toBe('auto')
  })

  it('injects the theme token stylesheet (light + dark values)', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination theme="dark" />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    const css = getInjectedCss()
    expect(css).toContain('--odv-toolbar-bg')
    expect(css).toMatch(/\[data-odv-theme=['"]dark['"]\]/)
    expect(css).toContain('prefers-color-scheme: dark')
  })

  it('passes a CSP nonce to every <style> it injects when constructable sheets are unavailable', async () => {
    const original = (globalThis as any).CSSStyleSheet
    ;(globalThis as any).CSSStyleSheet = undefined
    __resetStylesForTests()
    document.head.innerHTML = ''
    try {
      render(<DocViewer source={bytes} type="pdf" pagination styleNonce="n0nce" />)
      await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
      const styles = Array.from(document.querySelectorAll('style[id^="odv-"]'))
      expect(styles.length).toBeGreaterThan(0)
      expect(styles.every((s) => s.getAttribute('nonce') === 'n0nce')).toBe(true)
    } finally {
      ;(globalThis as any).CSSStyleSheet = original
      __resetStylesForTests()
    }
  })
})

describe('<DocViewer> toolbar customization', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('translates toolbar labels', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination labels={{ nextPage: 'Weiter', download: 'Herunterladen' }} />)
    await waitFor(() => expect(screen.getByLabelText('Weiter')).toBeTruthy())
    expect(screen.getByLabelText('Herunterladen')).toBeTruthy()
    expect(screen.getByLabelText('Previous page')).toBeTruthy() // untouched default
  })

  it('hides individual toolbar items', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination toolbarItems={{ print: false, zoom: false }} />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    expect(screen.queryByLabelText('Print')).toBeNull()
    expect(screen.queryByLabelText('Zoom in')).toBeNull()
    expect(screen.getByLabelText('Download')).toBeTruthy()
  })

  it('renders extra controls and lets a custom toolbar wrap the default one', async () => {
    render(
      <DocViewer
        source={bytes}
        type="pdf"
        pagination
        toolbarExtra={<button type="button">Share</button>}
        renderToolbar={(ctx) => (
          <div data-testid="custom-bar">
            <span data-testid="page-info">{ctx.state.page}/{ctx.state.pageCount}</span>
            {ctx.defaultToolbar}
          </div>
        )}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('custom-bar')).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('page-info').textContent).toBe('1/2'))
    expect(screen.getByText('Share')).toBeTruthy()
    expect(screen.getByRole('toolbar')).toBeTruthy()
  })

  it('shows a rotate button when the document supports rotation', async () => {
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, rotate: async () => {} }
    })
    render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect(screen.getByLabelText('Rotate')).toBeTruthy())
  })

  it('omits the rotate button when rotation is unsupported', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByLabelText('Rotate')).toBeNull()
  })
})
