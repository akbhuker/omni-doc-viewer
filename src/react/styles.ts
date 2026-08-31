import { useEffect } from 'react'
import { ensureStyles } from '../core/styles'
import { THEME_CSS } from '../core/theme'

export const TOOLBAR_CSS = `
.odv-pg-bar{display:flex;align-items:center;gap:4px;height:48px;flex:0 0 auto;padding:0 10px;
  background:var(--odv-toolbar-bg,#fff);border-bottom:1px solid var(--odv-border,#ececef);box-sizing:border-box;
  font:500 13px/1 var(--odv-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);color:var(--odv-toolbar-fg,#3a3a3c);
  -webkit-font-smoothing:antialiased;user-select:none}
.odv-pg-grp{display:flex;align-items:center;gap:2px}
.odv-pg-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
  padding:0;border:0;border-radius:8px;background:transparent;color:var(--odv-toolbar-fg,#48484a);cursor:pointer;
  transition:background .12s ease,color .12s ease}
.odv-pg-btn:hover:not(:disabled){background:var(--odv-toolbar-hover,#f1f1f3);color:var(--odv-fg,#1d1d1f)}
.odv-pg-btn:active:not(:disabled){background:var(--odv-toolbar-active,#e6e6ea)}
.odv-pg-btn:disabled{opacity:.3;cursor:default}
.odv-pg-btn svg{width:18px;height:18px;display:block}
.odv-pg-pages{display:inline-flex;align-items:center;gap:7px;padding:0 4px}
.odv-pg-input{width:42px;height:30px;text-align:center;border:1px solid var(--odv-input-border,#dcdce0);border-radius:7px;
  font:600 13px/1 inherit;color:var(--odv-fg,#1d1d1f);background:var(--odv-input-bg,#fff);outline:none;box-sizing:border-box;
  font-variant-numeric:tabular-nums;transition:border-color .12s,box-shadow .12s;-moz-appearance:textfield}
.odv-pg-input::-webkit-outer-spin-button,.odv-pg-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.odv-pg-input:focus{border-color:var(--odv-accent,#3b82f6);box-shadow:0 0 0 3px var(--odv-accent-ring,rgba(59,130,246,.18))}
.odv-pg-input:disabled{opacity:.5;background:var(--odv-surface-alt,#f5f5f7)}
.odv-pg-total{color:var(--odv-fg-muted,#9a9aa0);white-space:nowrap;font-weight:500}
.odv-pg-pct{min-width:54px;height:30px;padding:0 8px;border:0;border-radius:7px;background:transparent;
  color:var(--odv-toolbar-fg,#48484a);cursor:pointer;font:600 13px/1 inherit;font-variant-numeric:tabular-nums;
  transition:background .12s}
.odv-pg-pct:hover:not(:disabled){background:var(--odv-toolbar-hover,#f1f1f3);color:var(--odv-fg,#1d1d1f)}
.odv-pg-pct:disabled{opacity:.4;cursor:default}
.odv-pg-sep{width:1px;height:22px;background:var(--odv-border,#ececef);margin:0 6px;flex:0 0 auto}
.odv-pg-spacer{flex:1 1 auto}
.odv-pg-mode{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;
  border:1px solid var(--odv-input-border,#dcdce0);border-radius:9px;background:var(--odv-toolbar-bg,#fff);color:var(--odv-toolbar-fg,#3a3a3c);cursor:pointer;
  font:600 13px/1 inherit;white-space:nowrap;transition:background .12s,border-color .12s,box-shadow .12s}
.odv-pg-mode:hover:not(:disabled){background:var(--odv-toolbar-hover,#f7f7f9);border-color:var(--odv-input-border,#cdced3)}
.odv-pg-mode:active:not(:disabled){background:var(--odv-toolbar-active,#eeeef1)}
.odv-pg-mode:disabled{opacity:.4;cursor:default}
.odv-pg-mode svg{width:16px;height:16px;display:block;color:var(--odv-fg-muted,#6b6b70)}
.odv-pg-btn.is-active{background:var(--odv-accent-ring,#e8f0fe);color:var(--odv-accent,#1d4ed8)}
.odv-sb{display:flex;align-items:center;gap:4px;height:44px;flex:0 0 auto;padding:0 10px;
  background:var(--odv-surface-alt,#fafafb);border-bottom:1px solid var(--odv-border,#ececef);box-sizing:border-box;
  font:500 13px/1 var(--odv-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);color:var(--odv-toolbar-fg,#3a3a3c)}
.odv-sb-input{flex:1 1 auto;min-width:0;height:30px;padding:0 10px;border:1px solid var(--odv-input-border,#dcdce0);border-radius:7px;
  font:500 13px/1 inherit;color:var(--odv-fg,#1d1d1f);background:var(--odv-input-bg,#fff);outline:none;box-sizing:border-box;
  transition:border-color .12s,box-shadow .12s}
.odv-sb-input:focus{border-color:var(--odv-accent,#3b82f6);box-shadow:0 0 0 3px var(--odv-accent-ring,rgba(59,130,246,.18))}
.odv-sb-count{min-width:56px;text-align:center;color:var(--odv-fg-muted,#6b6b70);font-variant-numeric:tabular-nums;white-space:nowrap}
.odv-sb-count.is-empty{color:var(--odv-error,#b00020)}
.odv-pw{display:flex;flex-direction:column;gap:10px;max-width:360px;padding:20px 22px;border-radius:10px;
  background:var(--odv-toolbar-bg,#fff);border:1px solid var(--odv-border,#ececef);box-shadow:0 8px 24px rgba(0,0,0,.12);
  font:500 13px/1.4 var(--odv-font,system-ui,sans-serif);color:var(--odv-fg,#1d1d1f)}
.odv-pw-title{margin:0;font-weight:600}
.odv-pw-error{margin:0;color:var(--odv-error,#b00020)}
.odv-pw-row{display:flex;gap:6px}
.odv-pw-input{flex:1 1 auto;min-width:0;height:32px;padding:0 10px;border:1px solid var(--odv-input-border,#dcdce0);border-radius:7px;
  font:inherit;color:var(--odv-fg,#1d1d1f);background:var(--odv-input-bg,#fff);outline:none;box-sizing:border-box}
.odv-pw-input:focus{border-color:var(--odv-accent,#3b82f6);box-shadow:0 0 0 3px var(--odv-accent-ring,rgba(59,130,246,.18))}
.odv-pw-btn{height:32px;padding:0 12px;border:1px solid var(--odv-input-border,#dcdce0);border-radius:7px;cursor:pointer;
  background:var(--odv-toolbar-bg,#fff);color:var(--odv-fg,#1d1d1f);font:600 13px/1 inherit}
.odv-pw-primary{background:var(--odv-accent,#3b82f6);border-color:var(--odv-accent,#3b82f6);color:#fff}
.odv-pg-body{position:relative;display:flex;flex:1 1 auto;min-height:0}
.odv-pg-body>.odv-thumbs{flex:0 0 auto}
.odv-pg-body>.odv-pg-stage{flex:1 1 auto;min-width:0}
@container odvpg (max-width: 560px){
  .odv-pg-body>.odv-thumbs{position:absolute;left:0;top:0;bottom:0;z-index:4;
    box-shadow:0 0 0 1px var(--odv-border,#ececef),8px 0 24px rgba(0,0,0,.15)}
}
.odv-pg-stage{position:relative;overflow:auto;outline:none;display:flex;flex-direction:column;
  align-items:safe center;gap:14px;padding:18px;box-sizing:border-box;background:var(--odv-bg,#f4f4f6);
  scroll-behavior:smooth;overscroll-behavior:contain}
.odv-pg-stage>div{max-width:100%}
.odv-pg-stage .pptx-preview-slide-wrapper,.odv-pg-stage .odv-pdf-page,.odv-pg-stage section{
  box-shadow:var(--odv-page-shadow,0 1px 3px rgba(0,0,0,.12),0 6px 16px rgba(0,0,0,.06))!important}
.odv-pg-root{border:1px solid var(--odv-border,#e6e6e9);background:var(--odv-toolbar-bg,#fff);color:var(--odv-fg,#1d1d1f)}
.odv-loading{padding:16px;color:var(--odv-fg-muted,#666);font-family:var(--odv-font,system-ui,sans-serif)}
.odv-error{padding:16px;color:var(--odv-error,#b00020);font-family:var(--odv-font,system-ui,sans-serif);white-space:pre-wrap}

/* Adapt to the VIEWER's own width (container query), so it stays usable in a
   narrow column or on a phone. Progressively shed the least essential bits. */
@container odvpg (max-width: 560px){
  .odv-pg-modelabel{display:none}
  .odv-pg-mode{padding:0 9px;gap:0}
}
@container odvpg (max-width: 440px){
  .odv-pg-zoomgrp,.odv-pg-zoomsep{display:none}
  .odv-pg-stage{padding:10px;gap:10px}
}
@container odvpg (max-width: 340px){
  .odv-pg-bar{gap:2px;padding:0 6px}
  .odv-pg-mode{display:none}
}
/* Fallback for browsers without container queries: key off the viewport. */
@media (max-width: 560px){
  .odv-pg-modelabel{display:none}
}
`

/**
 * Inject the theme tokens + viewer stylesheet once per document. Always call
 * this hook unconditionally (hooks order!); `enabled` controls injection.
 */
export function useViewerStyles(enabled: boolean, nonce?: string): void {
  useEffect(() => {
    if (!enabled) return
    ensureStyles('odv-theme', THEME_CSS, { nonce })
    ensureStyles('odv-pg-styles', TOOLBAR_CSS, { nonce })
  }, [enabled, nonce])
}

/** @deprecated use {@link useViewerStyles} */
export const useToolbarStyles = useViewerStyles
