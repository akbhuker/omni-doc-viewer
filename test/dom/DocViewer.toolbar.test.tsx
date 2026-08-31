import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 3 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { DocViewer } from '../../src/react/DocViewer'
import { RenderError } from '../../src/core/types'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

describe('<DocViewer> toolbar adapts to the document', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('hides page navigation, zoom, print and view-mode for a video', async () => {
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, type: 'video', meta: { type: 'video', pageCount: 1 }, pages: undefined, search: undefined }
    })
    render(<DocViewer source={bytes} type="video" pagination thumbnails />)
    await waitFor(() => expect((screen.getByLabelText('Download') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByLabelText('Page number')).toBeNull()
    expect(screen.queryByLabelText('Zoom in')).toBeNull()
    expect(screen.queryByLabelText('Print')).toBeNull()
    expect(screen.queryByLabelText('Thumbnails')).toBeNull()
    expect(screen.queryByLabelText('Search')).toBeNull()
    expect(screen.queryByText('Single page')).toBeNull()
    expect(screen.getByLabelText('Download')).toBeTruthy()
  })

  it('keeps the full toolbar for a multi-page document', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByLabelText('Page number')).toBeTruthy()
    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Print')).toBeTruthy()
  })
})

describe('<DocViewer> password prompt', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  /** Fake that behaves like an encrypted PDF: asks the provided callback until it gets "secret". */
  function encryptedImpl(attempts: string[]) {
    return async (options: any) => {
      const provider = options.pdf?.password
      if (typeof provider === 'string') {
        if (provider !== 'secret') throw new RenderError('incorrect', 'PDF_PASSWORD_REQUIRED', 'pdf', { reason: 'incorrect' })
        attempts.push(provider)
        return fake.impl.getMockImplementation()!(options)
      }
      if (typeof provider !== 'function') {
        throw new RenderError('This PDF is password-protected. Provide `pdf.password`.', 'PDF_PASSWORD_REQUIRED', 'pdf', { reason: 'need' })
      }
      let reason: 'need' | 'incorrect' = 'need'
      for (;;) {
        const pw = await provider(reason)
        if (pw == null) {
          throw new RenderError('cancelled', 'PDF_PASSWORD_REQUIRED', 'pdf', { reason: 'cancelled' })
        }
        attempts.push(pw)
        if (pw === 'secret') break
        reason = 'incorrect'
      }
      return fake.impl.getMockImplementation()!(options)
    }
  }

  it('asks the user for the password, reports a wrong attempt, and renders after the right one', async () => {
    const attempts: string[] = []
    fake.impl.mockImplementationOnce(encryptedImpl(attempts))
    render(<DocViewer source={bytes} type="pdf" pagination />)

    const input = (await screen.findByLabelText('Password')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(screen.getByText(/incorrect/i)).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByLabelText('Password').closest('form')!)
    await waitFor(() => expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false))
    expect(attempts).toEqual(['wrong', 'secret'])
    expect(screen.queryByLabelText('Password')).toBeNull()
  })

  it('shows the error state when the user cancels', async () => {
    fake.impl.mockImplementationOnce(encryptedImpl([]))
    const onError = vi.fn()
    render(<DocViewer source={bytes} type="pdf" pagination onError={onError} />)
    await screen.findByLabelText('Password')
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(onError).toHaveBeenCalledOnce()
    expect((onError.mock.calls[0]![0] as RenderError).code).toBe('PDF_PASSWORD_REQUIRED')
  })

  it('does not prompt when the app supplies pdf.password itself', async () => {
    const attempts: string[] = []
    fake.impl.mockImplementationOnce(encryptedImpl(attempts))
    render(<DocViewer source={bytes} type="pdf" pagination pdf={{ password: 'secret' }} />)
    await waitFor(() => expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByLabelText('Password')).toBeNull()
  })
})
