import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ViewerSearchState } from '../core/viewer/types'
import { Icon } from './icons'

export interface SearchBarLabels {
  placeholder: string
  nextMatch: string
  previousMatch: string
  close: string
  noMatches: string
  matches: (current: number, total: number) => string
}

export const DEFAULT_SEARCH_LABELS: SearchBarLabels = {
  placeholder: 'Find in document',
  nextMatch: 'Next match',
  previousMatch: 'Previous match',
  close: 'Close search',
  noMatches: 'No matches',
  matches: (current, total) => `${current} / ${total}`,
}

export interface SearchBarProps {
  state: ViewerSearchState
  onQuery: (query: string) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  autoFocus?: boolean
  labels?: Partial<SearchBarLabels>
  /** Debounce for typing, in ms. Default 200. */
  debounceMs?: number
}

/** Find-in-document bar: debounced input, match counter, next/prev, close. */
export function SearchBar({
  state,
  onQuery,
  onNext,
  onPrev,
  onClose,
  autoFocus = true,
  labels,
  debounceMs = 200,
}: SearchBarProps): ReactElement {
  const t = { ...DEFAULT_SEARCH_LABELS, ...labels }
  const [draft, setDraft] = useState(state.query)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])
  useEffect(() => () => clearTimeout(timer.current), [])

  const schedule = (value: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onQuery(value), debounceMs)
  }

  const showCount = state.status === 'done' && state.query.trim() !== ''
  const count = showCount ? (state.total ? t.matches(state.current, state.total) : t.noMatches) : ''

  return (
    <div className="odv-sb" role="search">
      <input
        ref={inputRef}
        type="search"
        className="odv-sb-input"
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          schedule(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            clearTimeout(timer.current)
            if (draft !== state.query) onQuery(draft)
            else if (e.shiftKey) onPrev()
            else onNext()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      />
      <span className={`odv-sb-count${showCount && !state.total ? ' is-empty' : ''}`} aria-live="polite">
        {state.status === 'searching' ? '…' : count}
      </span>
      <button
        type="button"
        className="odv-pg-btn"
        onClick={onPrev}
        disabled={!state.total}
        aria-label={t.previousMatch}
        title={t.previousMatch}
      >
        <Icon d="M18 15l-6-6-6 6" />
      </button>
      <button
        type="button"
        className="odv-pg-btn"
        onClick={onNext}
        disabled={!state.total}
        aria-label={t.nextMatch}
        title={t.nextMatch}
      >
        <Icon d="M6 9l6 6 6-6" />
      </button>
      <button type="button" className="odv-pg-btn" onClick={onClose} aria-label={t.close} title={t.close}>
        <Icon d="M18 6L6 18M6 6l12 12" />
      </button>
    </div>
  )
}
