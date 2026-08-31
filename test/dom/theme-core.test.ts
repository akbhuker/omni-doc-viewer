import { describe, it, expect } from 'vitest'
import { renderDocument } from '../../src/core/render'
import { THEME_CSS } from '../../src/core/theme'
import { getInjectedCss } from '../../src/core/styles'

describe('core theming', () => {
  it('renderDocument({ theme }) tags the container and injects the tokens', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const r = await renderDocument({ container, source: new File(['x'], 'a.txt'), theme: 'dark' })
    expect(container.getAttribute('data-odv-theme')).toBe('dark')
    expect(getInjectedCss()).toContain('--odv-toolbar-bg')
    r.destroy()
  })

  it('does not tag the container when no theme is given', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: new File(['x'], 'a.txt') })
    expect(container.getAttribute('data-odv-theme')).toBeNull()
    r.destroy()
  })

  it('defines every token for light and dark with zero-specificity selectors', () => {
    for (const token of ['--odv-bg', '--odv-fg', '--odv-toolbar-bg', '--odv-page-bg', '--odv-border', '--odv-accent']) {
      const occurrences = THEME_CSS.split(token).length - 1
      expect(occurrences, token).toBeGreaterThanOrEqual(3) // light, dark, auto(dark)
    }
    expect(THEME_CSS).toContain(':where(')
  })
})
