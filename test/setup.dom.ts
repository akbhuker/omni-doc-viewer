/**
 * Shared setup for the `dom` test project (happy-dom).
 *
 * happy-dom lacks a few browser APIs the library feature-detects. We install
 * minimal, controllable stand-ins so tests can drive virtualization and
 * resize behaviour deterministically.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

type IOCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void

/** Records observers so a test can fire intersection entries by hand. */
export const intersectionObservers: FakeIntersectionObserver[] = []

export class FakeIntersectionObserver {
  readonly targets = new Set<Element>()
  constructor(
    public readonly callback: IOCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    intersectionObservers.push(this)
  }
  observe(el: Element): void {
    this.targets.add(el)
  }
  unobserve(el: Element): void {
    this.targets.delete(el)
  }
  disconnect(): void {
    this.targets.clear()
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  /** Test helper: report `el` as intersecting (or not). */
  trigger(el: Element, isIntersecting: boolean, ratio = isIntersecting ? 1 : 0): void {
    this.callback(
      [
        {
          target: el,
          isIntersecting,
          intersectionRatio: ratio,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    )
  }
}

export class FakeResizeObserver {
  readonly targets = new Set<Element>()
  constructor(public readonly callback: ResizeObserverCallback) {}
  observe(el: Element): void {
    this.targets.add(el)
  }
  unobserve(el: Element): void {
    this.targets.delete(el)
  }
  disconnect(): void {
    this.targets.clear()
  }
}

// Always use the controllable fakes (happy-dom ships inert observers of its own).
;(globalThis as any).IntersectionObserver = FakeIntersectionObserver
;(globalThis as any).ResizeObserver = FakeResizeObserver

// happy-dom's canvas has no 2d context; pdf.js and thumbnails need one.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = function () {
    return null
  } as any
}

// URL.createObjectURL / revokeObjectURL are missing in happy-dom.
if (typeof URL !== 'undefined' && typeof (URL as any).createObjectURL !== 'function') {
  let n = 0
  ;(URL as any).createObjectURL = () => `blob:mock/${++n}`
  ;(URL as any).revokeObjectURL = () => {}
}
