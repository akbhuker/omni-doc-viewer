import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ensureStyles, getInjectedCss, setStyleNonce, __resetStylesForTests } from '../../src/core/styles'

/** Run with constructable stylesheets disabled (the <style> fallback path). */
function withoutConstructable(fn: () => void): void {
  const original = (globalThis as any).CSSStyleSheet
  ;(globalThis as any).CSSStyleSheet = undefined
  try {
    fn()
  } finally {
    ;(globalThis as any).CSSStyleSheet = original
  }
}

beforeEach(() => {
  __resetStylesForTests()
  document.head.innerHTML = ''
  setStyleNonce(undefined)
})

describe('ensureStyles', () => {
  it('injects a <style> once per id and records the CSS for print', () => {
    withoutConstructable(() => {
      ensureStyles('odv-test-a', '.a{color:red}')
      ensureStyles('odv-test-a', '.a{color:blue}') // ignored: already injected
      ensureStyles('odv-test-b', '.b{color:green}')
      const styles = document.head.querySelectorAll('style')
      expect(styles).toHaveLength(2)
      expect(styles[0]!.id).toBe('odv-test-a')
      expect(styles[0]!.textContent).toBe('.a{color:red}')
      expect(getInjectedCss()).toBe('.a{color:red}\n.b{color:green}')
    })
  })

  it('applies a nonce (per call or global) so strict CSP style-src allows the sheet', () => {
    withoutConstructable(() => {
      ensureStyles('odv-test-a', '.a{}', { nonce: 'abc' })
      expect(document.getElementById('odv-test-a')!.getAttribute('nonce')).toBe('abc')
      setStyleNonce('global')
      ensureStyles('odv-test-b', '.b{}')
      expect(document.getElementById('odv-test-b')!.getAttribute('nonce')).toBe('global')
    })
  })

  it('prefers constructable stylesheets when the platform supports them (no inline <style>, CSP-clean)', () => {
    const replaceSync = vi.fn()
    class FakeSheet {
      replaceSync(css: string) {
        replaceSync(css)
      }
    }
    const original = (globalThis as any).CSSStyleSheet
    ;(globalThis as any).CSSStyleSheet = FakeSheet
    const adopted: unknown[] = []
    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, get: () => adopted, set: (v) => adopted.splice(0, adopted.length, ...v) })
    try {
      ensureStyles('odv-test-c', '.c{color:pink}')
      expect(replaceSync).toHaveBeenCalledWith('.c{color:pink}')
      expect(adopted).toHaveLength(1)
      expect(document.getElementById('odv-test-c')).toBeNull()
      expect(getInjectedCss()).toBe('.c{color:pink}')
    } finally {
      ;(globalThis as any).CSSStyleSheet = original
      delete (document as any).adoptedStyleSheets
    }
  })
})
