import type { ReactElement } from 'react'

/** A 24×24 stroked-path icon used by the toolbar buttons. */
export function Icon({ d }: { d: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export function IconSinglePage(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="2" />
    </svg>
  )
}

export function IconContinuous(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="4" width="14" height="6.5" rx="1.5" />
      <rect x="5" y="13.5" width="14" height="6.5" rx="1.5" />
    </svg>
  )
}
