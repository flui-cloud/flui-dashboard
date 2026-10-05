import { ActivatedRouteSnapshot } from '@angular/router';
import { pageWidth } from './page-width';

const chain = (...widths: (string | undefined)[]): ActivatedRouteSnapshot => {
  let child: unknown = null;
  for (const w of [...widths].reverse()) {
    child = { data: w ? { width: w } : {}, firstChild: child };
  }
  return child as ActivatedRouteSnapshot;
};

describe('pageWidth', () => {
  it('caps a page that names no width', () => {
    expect(pageWidth(chain(undefined, undefined), '/dashboard')).toBe('wide');
  });

  it('takes the width the deepest route names', () => {
    expect(pageWidth(chain('wide', undefined, 'narrow'), '/management/backup/policies/new')).toBe('narrow');
  });

  it('gives the consoles the whole width', () => {
    expect(pageWidth(chain(undefined), '/db-console/abc')).toBe('full');
  });
});
