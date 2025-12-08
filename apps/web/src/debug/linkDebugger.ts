// Dev helper: when you click a link, log computed color and the matching CSS rules (selector + stylesheet).
// Import this file in main.tsx during development to get quick diagnostics in the browser console.

export default function initLinkDebugger() {
  if (typeof window === 'undefined') return;
  try {
    document.addEventListener('click', (ev) => {
      const el = (ev.target as Element).closest ? (ev.target as Element).closest('a') : null;
      if (!el) return;
      try {
        const cs = window.getComputedStyle(el as Element);
        console.groupCollapsed('[link-debug] Link clicked — computed styles');
        console.log('href:', (el as HTMLAnchorElement).href);
        console.log('computed color:', cs.color);
        console.log('computed color (hex):', rgbToHex(cs.color));

        // iterate sheets and rules to find matching selectors
        const matches: Array<{ selector: string; href?: string | null }> = [];
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList | null = null;
          try {
            // accessing cssRules can throw for cross-origin stylesheets
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rules = (sheet as any).cssRules;
          } catch (e) {
            continue;
          }
          if (!rules) continue;
          for (const r of Array.from(rules)) {
            // only consider style rules
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((r as any).selectorText) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sel = (r as any).selectorText as string;
              try {
                if ((el as Element).matches(sel)) {
                  matches.push({ selector: sel, href: (sheet as CSSStyleSheet).href ?? null });
                }
              } catch (e) {
                // selector may be complex/unparsable for matches; ignore
              }
            }
          }
        }
        if (matches.length === 0) console.log('No matching style rules found (may be inline or from UA).');
        else console.table(matches.slice(0,50));
        console.groupEnd();
      } catch (e) {
        // swallow
      }
    }, true);
  } catch (e) {
    // ignore in prod
  }
}

function rgbToHex(rgb: string) {
  // rgb is like "rgb(12,34,56)" or "rgba(12,34,56,1)"
  try {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return rgb;
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return rgb; }
}
