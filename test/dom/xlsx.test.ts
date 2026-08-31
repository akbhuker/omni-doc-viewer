import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderDocument } from '../../src/core/render'

const sample = new Uint8Array(readFileSync('demo/public/samples/sample.xlsx'))

describe('xlsx renderer (SheetJS via @e965/xlsx)', () => {
  it('renders every sheet as a tab and the first sheet as a table', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const result = await renderDocument({ container, source: sample, type: 'xlsx' })

    const tabs = container.querySelectorAll('[role="tab"]')
    expect(result.meta.pageCount).toBe(tabs.length)
    expect(tabs.length).toBeGreaterThan(0)
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelectorAll('td, th').length).toBeGreaterThan(0)
    result.destroy()
    expect(container.childElementCount).toBe(0)
  })
})
