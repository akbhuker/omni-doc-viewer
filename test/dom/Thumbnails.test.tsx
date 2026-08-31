import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 3 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { DocViewer } from '../../src/react/DocViewer'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

describe('<DocViewer thumbnails>', () => {
  beforeEach(() => {
    fake.impl.mockClear()
  })

  it('offers a thumbnails toggle and shows the strip when enabled', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination thumbnails />)
    const toggle = await screen.findByLabelText('Thumbnails')
    expect(screen.queryByRole('complementary')).toBeNull()
    fireEvent.click(toggle)
    const aside = await screen.findByRole('complementary')
    await waitFor(() => expect(aside.querySelectorAll('button.odv-thumb')).toHaveLength(3))
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
  })

  it('can start open', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination thumbnails={{ defaultOpen: true, width: 90 }} />)
    await waitFor(() => expect(screen.getByRole('complementary')).toBeTruthy())
  })

  it('has no toggle when the prop is not set', async () => {
    render(<DocViewer source={bytes} type="pdf" pagination />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeTruthy())
    expect(screen.queryByLabelText('Thumbnails')).toBeNull()
  })
})
