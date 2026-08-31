import { ensureStyles } from './styles'

export type Theme = 'light' | 'dark' | 'auto'

/**
 * Design tokens. `:where()` keeps specificity at zero so any consumer rule
 * (`.my-viewer { --odv-bg: … }`) wins. Fallback values in the renderers equal
 * the light values, so unthemed output is unchanged.
 */
const LIGHT = `
  --odv-font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --odv-bg:#f4f4f6;
  --odv-fg:#1d1d1f;
  --odv-fg-muted:#9a9aa0;
  --odv-border:#ececef;
  --odv-toolbar-bg:#fff;
  --odv-toolbar-fg:#3a3a3c;
  --odv-toolbar-hover:#f1f1f3;
  --odv-toolbar-active:#e6e6ea;
  --odv-input-bg:#fff;
  --odv-input-border:#dcdce0;
  --odv-accent:#3b82f6;
  --odv-accent-ring:rgba(59,130,246,.18);
  --odv-page-bg:#fff;
  --odv-page-shadow:0 1px 3px rgba(0,0,0,.12),0 6px 16px rgba(0,0,0,.06);
  --odv-page-filter:none;
  --odv-highlight:rgba(255,213,0,.45);
  --odv-highlight-active:rgba(255,120,0,.65);
  --odv-selection:rgba(59,130,246,.3);
  --odv-surface:#fff;
  --odv-surface-alt:#f6f8fa;
  --odv-error:#b00020;
  --odv-radius:10px;
  color-scheme:light;`

const DARK = `
  --odv-bg:#151518;
  --odv-fg:#e6e6ea;
  --odv-fg-muted:#8a8a92;
  --odv-border:#2a2a30;
  --odv-toolbar-bg:#1e1e23;
  --odv-toolbar-fg:#d6d6db;
  --odv-toolbar-hover:#2c2c33;
  --odv-toolbar-active:#383840;
  --odv-input-bg:#26262c;
  --odv-input-border:#3a3a42;
  --odv-accent:#60a5fa;
  --odv-accent-ring:rgba(96,165,250,.25);
  --odv-page-bg:#fff;
  --odv-page-shadow:0 1px 3px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.45);
  --odv-page-filter:none;
  --odv-highlight:rgba(255,213,0,.5);
  --odv-highlight-active:rgba(255,140,0,.7);
  --odv-selection:rgba(96,165,250,.35);
  --odv-surface:#1e1e23;
  --odv-surface-alt:#26262c;
  --odv-error:#ff6b81;
  color-scheme:dark;`

export const THEME_CSS = `
:where(:root, [data-odv-theme='light']){${LIGHT}}
:where([data-odv-theme='dark']){${DARK}}
@media (prefers-color-scheme: dark){:where([data-odv-theme='auto']){${DARK}}}
[data-odv-theme] .odv-pdf-canvas,[data-odv-theme] .odv-image-img{filter:var(--odv-page-filter,none)}
`

/** Inject the tokens (once) and tag `el` with the requested theme. */
export function applyTheme(el: HTMLElement, theme: Theme | undefined): void {
  ensureStyles('odv-theme', THEME_CSS)
  if (theme) el.setAttribute('data-odv-theme', theme)
  else el.removeAttribute('data-odv-theme')
}
