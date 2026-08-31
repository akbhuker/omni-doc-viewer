/** Every user-visible string in the React viewer, for translation. */
export interface DocViewerLabels {
  toolbar: string
  previousPage: string
  nextPage: string
  pageNumber: string
  zoomIn: string
  zoomOut: string
  resetZoom: string
  fitWidth: string
  rotate: string
  thumbnails: string
  pageLabel: (page: number) => string
  search: string
  download: string
  print: string
  singlePage: string
  continuous: string
  switchToContinuous: string
  switchToSinglePage: string
  loading: string
  loadingProgress: (percent: number) => string
  error: (message: string) => string
  searchPlaceholder: string
  nextMatch: string
  previousMatch: string
  closeSearch: string
  noMatches: string
  matches: (current: number, total: number) => string
  passwordTitle: string
  passwordIncorrect: string
  passwordPlaceholder: string
  passwordSubmit: string
  passwordCancel: string
}

export const DEFAULT_LABELS: DocViewerLabels = {
  toolbar: 'Document navigation',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  pageNumber: 'Page number',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  fitWidth: 'Fit width',
  rotate: 'Rotate',
  thumbnails: 'Thumbnails',
  pageLabel: (page) => `Page ${page}`,
  search: 'Search',
  download: 'Download',
  print: 'Print',
  singlePage: 'Single page',
  continuous: 'Continuous',
  switchToContinuous: 'Switch to continuous scrolling',
  switchToSinglePage: 'Switch to single page',
  loading: 'Loading document…',
  loadingProgress: (pct) => `Loading document… ${pct}%`,
  error: (message) => `Could not display document: ${message}`,
  searchPlaceholder: 'Find in document',
  nextMatch: 'Next match',
  previousMatch: 'Previous match',
  closeSearch: 'Close search',
  noMatches: 'No matches',
  matches: (current, total) => `${current} / ${total}`,
  passwordTitle: 'This document is password-protected',
  passwordIncorrect: 'Incorrect password, please try again',
  passwordPlaceholder: 'Password',
  passwordSubmit: 'Open',
  passwordCancel: 'Cancel',
}
