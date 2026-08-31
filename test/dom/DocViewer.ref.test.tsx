import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 3 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { DocViewer, type ViewerHandle } from '../../src/react/DocViewer'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

describe('<DocViewer ref>', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('exposes an imperative handle: navigation, zoom, state', async () => {
    const ref = createRef<ViewerHandle>()
    const onPageChange = vi.fn()
    render(<DocViewer ref={ref} source={bytes} type="pdf" pagination onPageChange={onPageChange} />)
    await waitFor(() => expect(ref.current?.getState().status).toBe('loaded'))

    expect(ref.current!.getPageCount()).toBe(3)
    act(() => ref.current!.goToPage(2))
    expect(ref.current!.getPage()).toBe(2)
    expect(onPageChange).toHaveBeenLastCalledWith(2, 3)
    expect((screen.getByLabelText('Page number') as HTMLInputElement).value).toBe('2')

    act(() => ref.current!.zoomIn())
    expect(ref.current!.getState().zoom).toBe(1.2)
    expect(screen.getByTitle('Reset zoom').textContent).toBe('120%')

    act(() => ref.current!.setViewMode('continuous'))
    expect(ref.current!.getState().viewMode).toBe('continuous')
  })

  it('is safe to call before the document has loaded', () => {
    const ref = createRef<ViewerHandle>()
    fake.impl.mockImplementationOnce(() => new Promise(() => {}))
    render(<DocViewer ref={ref} source={bytes} type="pdf" pagination />)
    expect(() => {
      ref.current!.goToPage(2)
      ref.current!.zoomIn()
      ref.current!.fitWidth()
    }).not.toThrow()
    expect(ref.current!.getPage()).toBe(1)
    expect(ref.current!.getState().status).toBe('loading')
  })

  it('lets consumers subscribe to state changes', async () => {
    const ref = createRef<ViewerHandle>()
    render(<DocViewer ref={ref} source={bytes} type="pdf" pagination />)
    await waitFor(() => expect(ref.current?.getState().status).toBe('loaded'))
    const listener = vi.fn()
    const unsubscribe = ref.current!.subscribe(listener)
    act(() => ref.current!.goToPage(3))
    expect(listener).toHaveBeenCalled()
    expect(listener.mock.calls.at(-1)![0].page).toBe(3)
    unsubscribe()
  })
})
