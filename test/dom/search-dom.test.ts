import { describe, it, expect, beforeEach } from 'vitest'
import { createDomSearchProvider } from '../../src/core/search/dom'

let root: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('article')
  root.innerHTML =
    '<section><h1>Report</h1><p>The quick <b>brown</b> fox.</p></section>' +
    '<section><p>A quick note about the fox.</p><script>quick()</script></section>'
  document.body.appendChild(root)
})

describe('createDomSearchProvider', () => {
  it('finds matches across inline elements and attributes them to pages', async () => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>('section'))
    const provider = createDomSearchProvider({ root, pages })
    const r = await provider.search('quick')
    expect(r.total).toBe(2)
    expect(r.matches.map((m) => m.page)).toEqual([1, 2])
    // "brown" sits inside <b>; a query spanning it still matches.
    expect((await provider.search('quick brown fox')).total).toBe(1)
    provider.clear()
  })

  it('ignores script/style content', async () => {
    const provider = createDomSearchProvider({ root })
    expect((await provider.search('quick()')).total).toBe(0)
  })

  it('highlights matches and the active one, and clear() restores the DOM exactly', async () => {
    const before = root.innerHTML
    const provider = createDomSearchProvider({ root })
    await provider.search('fox')
    const sel = await provider.select(1)
    expect(sel.page).toBe(1)
    expect(sel.element).toBeTruthy()
    // Either CSS highlights (no DOM change) or <mark> wrappers.
    const marks = root.querySelectorAll('mark.odv-hl')
    if (marks.length) {
      expect(marks).toHaveLength(2)
      expect(root.querySelectorAll('mark.odv-hl-active')).toHaveLength(1)
    }
    provider.clear()
    expect(root.querySelector('mark')).toBeNull()
    expect(root.innerHTML).toBe(before)
  })

  it('re-searching replaces the previous highlights instead of stacking them', async () => {
    const provider = createDomSearchProvider({ root })
    await provider.search('fox')
    await provider.search('quick')
    const marks = root.querySelectorAll('mark.odv-hl')
    if (marks.length) expect(Array.from(marks).every((m) => /quick/i.test(m.textContent ?? ''))).toBe(true)
    expect(root.textContent).toContain('The quick brown fox.')
    provider.clear()
  })
})
