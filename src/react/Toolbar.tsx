import { useState, type ReactElement, type ReactNode } from 'react'
import { MAX_ZOOM, MIN_ZOOM } from '../core/viewer/constants'
import type { ViewMode } from '../core/viewer/types'
import { Icon, IconContinuous, IconSinglePage } from './icons'
import { DEFAULT_LABELS, type DocViewerLabels } from './labels'

export type { ViewMode }

/** Toolbar sections that can be switched off with the `toolbarItems` prop. */
export type ToolbarItem =
  | 'pages'
  | 'zoom'
  | 'fitWidth'
  | 'rotate'
  | 'search'
  | 'thumbnails'
  | 'download'
  | 'print'
  | 'viewMode'

export interface ToolbarProps {
  current: number
  total: number
  zoom: number
  viewMode: ViewMode
  disabled: boolean
  onPrev: () => void
  onNext: () => void
  onJump: (n: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onFitWidth: () => void
  onDownload: () => void
  onPrint: () => void
  onToggleMode: () => void
  /** Present when the document supports rotation. */
  onRotate?: () => void
  /** Present when the document supports search; toggles the find bar. */
  onSearch?: () => void
  searchOpen?: boolean
  /** Present when thumbnails are enabled; toggles the sidebar. */
  onThumbnails?: () => void
  thumbnailsOpen?: boolean
  labels?: Partial<DocViewerLabels>
  items?: Partial<Record<ToolbarItem, boolean>>
  /** Extra controls rendered in the actions group. */
  extra?: ReactNode
}

export function Toolbar({
  current,
  total,
  zoom,
  viewMode,
  disabled,
  onPrev,
  onNext,
  onJump,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitWidth,
  onDownload,
  onPrint,
  onToggleMode,
  onRotate,
  onSearch,
  searchOpen = false,
  onThumbnails,
  thumbnailsOpen = false,
  labels,
  items,
  extra,
}: ToolbarProps): ReactElement {
  const t = { ...DEFAULT_LABELS, ...labels }
  const show = (item: ToolbarItem) => items?.[item] !== false
  const [draft, setDraft] = useState(String(current))
  // Keep the input in sync as the page changes via scroll / buttons. This is
  // the "adjust state while rendering" pattern (no effect, no extra commit).
  const [syncedCurrent, setSyncedCurrent] = useState(current)
  if (syncedCurrent !== current) {
    setSyncedCurrent(current)
    setDraft(String(current))
  }

  const commit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n)) onJump(n)
    else setDraft(String(current))
  }

  return (
    <div className="odv-pg-bar" role="toolbar" aria-label={t.toolbar}>
      {show('pages') && (
        <div className="odv-pg-grp">
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onPrev}
            disabled={disabled || current <= 1}
            aria-label={t.previousPage}
            title={t.previousPage}
          >
            <Icon d="M15 18l-6-6 6-6" />
          </button>
          <span className="odv-pg-pages">
            <input
              className="odv-pg-input"
              aria-label={t.pageNumber}
              inputMode="numeric"
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={(e) => e.target.select()}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
            <span className="odv-pg-total">/ {total}</span>
          </span>
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onNext}
            disabled={disabled || current >= total}
            aria-label={t.nextPage}
            title={t.nextPage}
          >
            <Icon d="M9 18l6-6-6-6" />
          </button>
        </div>
      )}

      {show('thumbnails') && onThumbnails && (
        <button
          type="button"
          className={`odv-pg-btn${thumbnailsOpen ? ' is-active' : ''}`}
          onClick={onThumbnails}
          disabled={disabled}
          aria-label={t.thumbnails}
          aria-pressed={thumbnailsOpen}
          title={t.thumbnails}
        >
          <Icon d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z" />
        </button>
      )}
      {show('zoom') && <span className="odv-pg-sep odv-pg-zoomsep" />}

      {show('zoom') && (
        <div className="odv-pg-grp odv-pg-zoomgrp">
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onZoomOut}
            disabled={disabled || zoom <= MIN_ZOOM}
            aria-label={t.zoomOut}
            title={t.zoomOut}
          >
            <Icon d="M5 12h14" />
          </button>
          <button
            type="button"
            className="odv-pg-pct"
            onClick={onZoomReset}
            disabled={disabled}
            title={t.resetZoom}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onZoomIn}
            disabled={disabled || zoom >= MAX_ZOOM}
            aria-label={t.zoomIn}
            title={t.zoomIn}
          >
            <Icon d="M12 5v14M5 12h14" />
          </button>
          {show('fitWidth') && (
            <button
              type="button"
              className="odv-pg-btn"
              onClick={onFitWidth}
              disabled={disabled}
              aria-label={t.fitWidth}
              title={t.fitWidth}
            >
              <Icon d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3M8 12h8M8 12l2.5-2.5M8 12l2.5 2.5M16 12l-2.5-2.5M16 12l-2.5 2.5" />
            </button>
          )}
          {show('rotate') && onRotate && (
            <button
              type="button"
              className="odv-pg-btn"
              onClick={onRotate}
              disabled={disabled}
              aria-label={t.rotate}
              title={t.rotate}
            >
              <Icon d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
            </button>
          )}
        </div>
      )}

      <span className="odv-pg-spacer" />

      <div className="odv-pg-grp odv-pg-actions">
        {show('search') && onSearch && (
          <button
            type="button"
            className={`odv-pg-btn${searchOpen ? ' is-active' : ''}`}
            onClick={onSearch}
            disabled={disabled}
            aria-label={t.search}
            aria-pressed={searchOpen}
            title={`${t.search} (Ctrl+F)`}
          >
            <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35" />
          </button>
        )}
        {show('download') && (
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onDownload}
            disabled={disabled}
            aria-label={t.download}
            title={t.download}
          >
            <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </button>
        )}
        {show('print') && (
          <button
            type="button"
            className="odv-pg-btn"
            onClick={onPrint}
            disabled={disabled}
            aria-label={t.print}
            title={t.print}
          >
            <Icon d="M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M8 14h8v7H8z" />
          </button>
        )}
        {extra}
      </div>

      {show('viewMode') && (
        <button
          type="button"
          className="odv-pg-mode"
          onClick={onToggleMode}
          disabled={disabled}
          title={viewMode === 'paged' ? t.switchToContinuous : t.switchToSinglePage}
        >
          {viewMode === 'paged' ? (
            <>
              <IconSinglePage />
              <span className="odv-pg-modelabel">{t.singlePage}</span>
            </>
          ) : (
            <>
              <IconContinuous />
              <span className="odv-pg-modelabel">{t.continuous}</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
