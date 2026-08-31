import { createViewer } from 'omni-doc-viewer'

// A tiny example rendered with line numbers.
const viewer = createViewer({ host: document.getElementById('host')!, pagination: true })
await viewer.load(file)
viewer.subscribe((state) => console.log(state.page, '/', state.pageCount))
