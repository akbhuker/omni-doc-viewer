import { ensureStyles } from '../../styles'

/**
 * pdf.js layer styles, trimmed from `pdfjs-dist/web/pdf_viewer.css` (v6) and
 * flattened (no CSS nesting) for broader browser support. Injected once so
 * consumers don't have to import a stylesheet from the package.
 *
 * v6 layers size themselves from CSS variables that the viewer normally sets
 * on `.pdfViewer .page`; we define the same variables on `.odv-pdf-page` and
 * keep `--scale-factor` in sync with the rendered width.
 */
export const PDF_LAYER_CSS = `
.odv-pdf-page{--scale-factor:1;--user-unit:1;--total-scale-factor:calc(var(--scale-factor) * var(--user-unit));
  --scale-round-x:1px;--scale-round-y:1px}
.textLayer{color-scheme:only light;position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;
  line-height:1;letter-spacing:normal;word-spacing:normal;-webkit-text-size-adjust:none;text-size-adjust:none;
  forced-color-adjust:none;transform-origin:0 0;caret-color:CanvasText;z-index:2;
  --min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv:calc(1 / var(--min-font-size))}
.textLayer.highlighting{touch-action:none}
.textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;
  transform-origin:0% 0%;-webkit-user-select:text;user-select:text}
.textLayer > :not(.markedContent),.textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;
  font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;
  transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.textLayer .markedContent{display:contents}
.textLayer span[role="img"]{-webkit-user-select:none;user-select:none;cursor:default}
.textLayer ::selection{background:var(--odv-selection,rgba(59,130,246,.3))}
.textLayer br::selection{background:transparent}
.textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;
  -webkit-user-select:none;user-select:none}
.textLayer.selecting .endOfContent{top:0}
.annotationLayer{color-scheme:only light;position:absolute;inset:0;pointer-events:none;transform-origin:0 0;z-index:3}
.annotationLayer section{position:absolute;text-align:initial;pointer-events:auto;box-sizing:border-box;transform-origin:0 0}
.annotationLayer .linkAnnotation>a{position:absolute;font-size:1em;top:0;left:0;width:100%;height:100%}
.annotationLayer .linkAnnotation:not(.hasBorder)>a:hover{opacity:.2;background-color:rgb(255 255 0);
  box-shadow:0 2px 10px rgb(255 255 0)}
.annotationLayer .linkAnnotation.hasBorder:hover{background-color:rgb(255 255 0 / .2)}
.annotationLayer .hasBorder{background-size:100% 100%}
`

export function injectPdfLayerStyles(): void {
  ensureStyles('odv-pdf-layer-styles', PDF_LAYER_CSS)
}
