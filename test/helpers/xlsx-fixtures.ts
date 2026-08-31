import * as XLSX from '@e965/xlsx'

/** Build an .xlsx in memory from a description (runs in Node and browsers). */
export function makeWorkbook(sheets: Array<{
  name: string
  rows: unknown[][]
  hidden?: 0 | 1 | 2
  merges?: string[] // e.g. 'A1:C1'
  colWidths?: number[] // px
}>): Uint8Array {
  const wb = XLSX.utils.book_new()
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    if (s.merges) ws['!merges'] = s.merges.map((m) => XLSX.utils.decode_range(m))
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wpx) => ({ wpx }))
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  })
  wb.Workbook = wb.Workbook ?? {}
  wb.Workbook.Sheets = sheets.map((s) => ({ name: s.name, Hidden: s.hidden ?? 0 }))
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Uint8Array(out)
}
