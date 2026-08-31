import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { DocViewerLabels } from './labels'

export interface PasswordPromptProps {
  reason: 'need' | 'incorrect'
  labels: DocViewerLabels
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** Inline password form shown while an encrypted PDF waits for a password. */
export function PasswordPrompt({ reason, labels, onSubmit, onCancel }: PasswordPromptProps): ReactElement {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [reason])
  return (
    <form
      className="odv-pw"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
        setValue('')
      }}
    >
      <p className="odv-pw-title">{labels.passwordTitle}</p>
      {reason === 'incorrect' && (
        <p className="odv-pw-error" role="alert">
          {labels.passwordIncorrect}
        </p>
      )}
      <div className="odv-pw-row">
        <input
          ref={inputRef}
          type="password"
          className="odv-pw-input"
          aria-label={labels.passwordPlaceholder}
          placeholder={labels.passwordPlaceholder}
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="odv-pw-btn odv-pw-primary">
          {labels.passwordSubmit}
        </button>
        <button type="button" className="odv-pw-btn" onClick={onCancel}>
          {labels.passwordCancel}
        </button>
      </div>
    </form>
  )
}
