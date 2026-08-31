import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 3 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { DocViewer } from '../../src/react/DocViewer'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF

describe('<DocViewer> lifecycle', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    fake.impl.mockClear()
    fake.destroy.mockClear()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('can turn pagination on after mounting without a hooks-order error', async () => {
    const { rerender } = render(<DocViewer source={bytes} type="pdf" />)
    await waitFor(() => expect(fake.impl).toHaveBeenCalledTimes(1))

    rerender(<DocViewer source={bytes} type="pdf" pagination />)

    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    const hookErrors = errorSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('hooks'),
    )
    expect(hookErrors).toHaveLength(0)
  })

  it('does not re-render the document when only callback identity changes', async () => {
    const { rerender } = render(
      <DocViewer source={bytes} type="pdf" onLoad={() => {}} pdf={{ scale: 1.5 }} />,
    )
    await waitFor(() => expect(fake.impl).toHaveBeenCalledTimes(1))

    rerender(<DocViewer source={bytes} type="pdf" onLoad={() => {}} pdf={{ scale: 1.5 }} />)
    rerender(<DocViewer source={bytes} type="pdf" onError={() => {}} pdf={{ scale: 1.5 }} />)

    // Same tuning values (new object identity) must not trigger a reload.
    expect(fake.impl).toHaveBeenCalledTimes(1)
  })

  it('re-renders the document when a tuning value such as pdf.textLayer changes', async () => {
    const { rerender } = render(<DocViewer source={bytes} type="pdf" pdf={{ textLayer: true }} />)
    await waitFor(() => expect(fake.impl).toHaveBeenCalledTimes(1))

    rerender(<DocViewer source={bytes} type="pdf" pdf={{ textLayer: false }} />)

    await waitFor(() => expect(fake.impl).toHaveBeenCalledTimes(2))
  })

  it('calls the latest onLoad callback with the render meta', async () => {
    const first = vi.fn()
    const second = vi.fn()
    // A parent that re-renders with a fresh callback before the load resolves.
    const { rerender } = render(<DocViewer source={bytes} type="pdf" onLoad={first} />)
    rerender(<DocViewer source={bytes} type="pdf" onLoad={second} />)

    await waitFor(() => expect(second).toHaveBeenCalledWith({ type: 'pdf', pageCount: 3 }))
    expect(first).not.toHaveBeenCalled()
  })
})

describe('<DocViewer> pagination toolbar', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('keeps the page input in sync when navigating with the buttons', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination />)
    const input = (await screen.findByLabelText('Page number')) as HTMLInputElement
    await waitFor(() => expect(input.disabled).toBe(false))

    fireEvent.click(screen.getByLabelText('Next page'))

    await waitFor(() => expect(input.value).toBe('2'))
    fireEvent.click(screen.getByLabelText('Previous page'))
    await waitFor(() => expect(input.value).toBe('1'))
  })

  it('downloads the rendered bytes as a same-origin blob even for a cross-origin URL source', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
    const clicks: string[] = []
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push(`${this.getAttribute('download')}|${this.href}`)
      })

    render(
      <DocViewer source="https://cdn.example.com/files/report.pdf?sig=abc" pagination />,
    )
    const button = await screen.findByLabelText('Download')
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(button)

    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(clicks[0]).toMatch(/^report\.pdf\|blob:/)
    expect(createObjectURL).toHaveBeenCalled()
    clickSpy.mockRestore()
    createObjectURL.mockRestore()
  })
})

describe('<DocViewer> loading & fetching', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('forwards fetchOptions to renderDocument', async () => {
    const fetchOptions = { headers: { Authorization: 'Bearer x' } }
    render(<DocViewer source="https://x.test/a.pdf" fetchOptions={fetchOptions} />)
    await waitFor(() => expect(fake.impl).toHaveBeenCalledTimes(1))
    expect(fake.impl.mock.calls[0]![0].fetchOptions).toBe(fetchOptions)
  })

  it('renders download progress through the loading render-prop and onProgress', async () => {
    const onProgress = vi.fn()
    // Make the fake report progress before resolving.
    fake.impl.mockImplementationOnce(async (options) => {
      options.onProgress?.(50, 200)
      await new Promise((r) => setTimeout(r, 30))
      options.onProgress?.(200, 200)
      return { type: 'pdf', meta: { type: 'pdf', pageCount: 1 }, pages: [], destroy: () => {} }
    })

    render(
      <DocViewer
        source="https://x.test/a.pdf"
        onProgress={onProgress}
        loading={(p) => <span data-testid="pct">{p?.total ? Math.round((p.loaded / p.total) * 100) : 0}%</span>}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('pct').textContent).toBe('25%'))
    await waitFor(() => expect(onProgress).toHaveBeenCalledWith(200, 200))
  })
})

describe('<DocViewer> search integration', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('shows a search button only when the document supports search, and searches through the controller', async () => {
    const provider = {
      search: vi.fn(async (q: string) => ({ query: q, total: 1, matches: [{ page: 2, locator: 0 }] })),
      select: vi.fn(async () => ({ page: 2 })),
      clear: vi.fn(),
    }
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, search: provider }
    })
    render(<DocViewer source={bytes} type="pdf" pagination />)
    const button = await screen.findByLabelText('Search')
    fireEvent.click(button)
    const input = (await screen.findByRole('searchbox')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'fox' } })
    await waitFor(() => expect(provider.search.mock.calls[0]?.[0]).toBe('fox'))
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeTruthy())
    // Selecting the match navigated to its page.
    await waitFor(() => expect((screen.getByLabelText('Page number') as HTMLInputElement).value).toBe('2'))
  })

  it('hides the search button when the renderer has no search provider', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    await waitFor(() => expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByLabelText('Search')).toBeNull()
  })
})
