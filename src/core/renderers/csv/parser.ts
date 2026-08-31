export interface ParseOptions {
  /** Stop storing rows after this many (the total is still counted). */
  maxRows?: number
}

/** Parsed rows plus the total number of rows in the input (≥ rows.length). */
export interface ParsedRows {
  rows: string[][]
  total: number
}

/**
 * Parse delimited text (CSV/TSV/…) into rows. Handles quoted fields, escaped
 * quotes (`""`), and newlines inside quotes per RFC 4180. Empty lines are
 * skipped.
 */
export function parseDelimited(input: string, delimiter: string): string[][] {
  return parseRows(input, delimiter).rows
}

/**
 * Like {@link parseDelimited}, but with a row cap: rows beyond `maxRows` are
 * counted (`total`) but not kept.
 */
export function parseRows(input: string, delimiter: string, options: ParseOptions = {}): ParsedRows {
  const rows: string[][] = []
  const max = options.maxRows ?? Infinity
  let total = 0
  let row: string[] = []
  let field = ''
  let quoted = false
  let fieldStart = true // at the start of a field (a quote here opens quoting)

  const endRow = (): void => {
    if (row.length === 1 && row[0] === '') {
      row = []
      return // blank line
    }
    total++
    if (rows.length < max) rows.push(row)
    row = []
  }

  for (let i = 0; i < input.length; i++) {
    const c = input[i]!
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"' && fieldStart) {
      quoted = true
      fieldStart = false
    } else if (c === delimiter) {
      row.push(field)
      field = ''
      fieldStart = true
    } else if (c === '\n') {
      row.push(field)
      field = ''
      fieldStart = true
      endRow()
    } else if (c === '\r') {
      // swallow; the following \n closes the row
    } else {
      field += c
      fieldStart = false
    }
  }
  // Flush the final field/row unless the input ended on a clean newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    endRow()
  }
  return { rows, total }
}

const CANDIDATES = [',', '\t', ';', '|']

/**
 * Pick the delimiter that splits the first lines into a consistent number of
 * fields (> 1). Quote-aware, so `"a;b",c` is comma-separated, and European
 * files with decimal commas (`1,5;2,25`) come out as semicolon-separated.
 */
export function sniffDelimiter(text: string, sampleLines = 20): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, sampleLines).join('\n')
  if (!sample) return ','
  let best: { delimiter: string; variance: number; fields: number } | undefined
  for (const delimiter of CANDIDATES) {
    const rows = parseDelimited(sample, delimiter)
    if (rows.length === 0) continue
    const counts = rows.map((r) => r.length)
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    if (mean <= 1) continue
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
    if (!best || variance < best.variance || (variance === best.variance && mean > best.fields)) {
      best = { delimiter, variance, fields: mean }
    }
  }
  return best?.delimiter ?? ','
}
