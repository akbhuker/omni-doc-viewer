import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../src/react/SearchBar'
import type { ViewerSearchState } from '../../src/core/viewer/types'

const base: ViewerSearchState = { query: '', status: 'idle', total: 0, current: 0 }

describe('<SearchBar>', () => {
  it('debounces typing into a single onQuery call', () => {
    vi.useFakeTimers()
    try {
      const onQuery = vi.fn()
      render(<SearchBar state={base} onQuery={onQuery} onNext={() => {}} onPrev={() => {}} onClose={() => {}} />)
      const input = screen.getByRole('searchbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'f' } })
      fireEvent.change(input, { target: { value: 'fo' } })
      fireEvent.change(input, { target: { value: 'fox' } })
      expect(onQuery).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(onQuery).toHaveBeenCalledTimes(1)
      expect(onQuery).toHaveBeenCalledWith('fox')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the match position and navigates with Enter / Shift+Enter / buttons', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    render(
      <SearchBar
        state={{ query: 'fox', status: 'done', total: 27, current: 3 }}
        onQuery={() => {}}
        onNext={onNext}
        onPrev={onPrev}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('3 / 27')).toBeTruthy()
    const input = screen.getByRole('searchbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNext).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onPrev).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Next match'))
    fireEvent.click(screen.getByLabelText('Previous match'))
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onPrev).toHaveBeenCalledTimes(2)
  })

  it('says when nothing matched and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <SearchBar
        state={{ query: 'zzz', status: 'done', total: 0, current: 0 }}
        onQuery={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('No matches')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
