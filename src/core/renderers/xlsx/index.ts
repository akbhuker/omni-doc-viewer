import { type Renderer } from '../types'

export const render: Renderer = async ({ container, bytes }) => {
  const XLSX: any = await import('xlsx')
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetNames: string[] = wb.SheetNames

  const root = document.createElement('div')
  root.className = 'odv-xlsx'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.height = '100%'

  // --- Sheet tab bar ---
  const tabs = document.createElement('div')
  tabs.className = 'odv-xlsx-tabs'
  tabs.setAttribute('role', 'tablist')
  tabs.style.display = 'flex'
  tabs.style.flexWrap = 'wrap'
  tabs.style.gap = '2px'
  tabs.style.borderBottom = '1px solid #d0d0d0'
  tabs.style.padding = '4px 4px 0'
  tabs.style.flex = '0 0 auto'

  // --- Sheet content area ---
  const content = document.createElement('div')
  content.className = 'odv-xlsx-content'
  content.style.overflow = 'auto'
  content.style.flex = '1 1 auto'
  content.style.padding = '8px'

  const buttons: HTMLButtonElement[] = []

  function showSheet(index: number): void {
    const name = sheetNames[index]
    if (!name) return
    const ws = wb.Sheets[name]
    const html: string = XLSX.utils.sheet_to_html(ws, { id: `odv-sheet-${index}`, editable: false })
    content.innerHTML = html
    const table = content.querySelector('table') as HTMLElement | null
    if (table) {
      table.style.borderCollapse = 'collapse'
      table.querySelectorAll('td, th').forEach((cell) => {
        const el = cell as HTMLElement
        el.style.border = '1px solid #d8d8d8'
        el.style.padding = '2px 6px'
        el.style.whiteSpace = 'nowrap'
      })
    }
    buttons.forEach((b, i) => {
      const active = i === index
      b.setAttribute('aria-selected', String(active))
      b.style.background = active ? '#fff' : '#ececec'
      b.style.fontWeight = active ? '600' : '400'
      b.style.borderBottomColor = active ? '#fff' : '#d0d0d0'
    })
  }

  sheetNames.forEach((name, i) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.setAttribute('role', 'tab')
    btn.textContent = name
    btn.style.border = '1px solid #d0d0d0'
    btn.style.borderBottom = 'none'
    btn.style.borderRadius = '4px 4px 0 0'
    btn.style.padding = '4px 12px'
    btn.style.cursor = 'pointer'
    btn.style.background = '#ececec'
    btn.addEventListener('click', () => showSheet(i))
    buttons.push(btn)
    tabs.appendChild(btn)
  })

  root.appendChild(tabs)
  root.appendChild(content)
  container.appendChild(root)

  if (sheetNames.length > 0) showSheet(0)

  return {
    type: 'xlsx',
    meta: { type: 'xlsx', pageCount: sheetNames.length },
    destroy() {
      container.replaceChildren()
    },
  }
}
