import { ActivatedRouteSnapshot } from '@angular/router';

/** How wide a routed page may grow, declared on its route as `data: { width }`. */
export type PageWidth = 'wide' | 'narrow' | 'full';

/** Editors over wide tables use the whole width whatever their route says. */
const FULL_WIDTH_PREFIXES = [
  '/db-console',
  '/kv-console',
  '/doc-console',
  '/object-store-console',
  '/search-console',
  '/messaging-console',
];

/** The width the deepest route that names one asks for; `wide` when none does. */
export function pageWidth(root: ActivatedRouteSnapshot | null, url: string): PageWidth {
  if (FULL_WIDTH_PREFIXES.some((p) => url.startsWith(p))) return 'full';
  let width: PageWidth = 'wide';
  for (let r = root; r; r = r.firstChild) {
    const declared = r.data?.['width'];
    if (declared === 'wide' || declared === 'narrow' || declared === 'full') width = declared;
  }
  return width;
}

export const PAGE_WIDTH_CLASS: Record<PageWidth, string> = {
  wide: 'max-w-screen-2xl',
  narrow: 'max-w-5xl',
  full: 'max-w-none',
};
