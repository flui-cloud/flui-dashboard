import { convertToParamMap } from '@angular/router';
import { CatalogResponseDto } from '../../../core/api/model/models';
import { catalogQueryFor } from '../application/add-workload-menu.component';
import { catalogScopeOf, catalogSectionOf, inCatalogScope } from './catalog-scope';

const entry = (appKind: string, appType: string) => ({ appKind, appType }) as unknown as CatalogResponseDto;

describe('catalog scope', () => {
  it('reads the list the Add menu sends, and the older kind parameter', () => {
    expect(catalogScopeOf(convertToParamMap(catalogQueryFor('data')))).toBe('data');
    expect(catalogScopeOf(convertToParamMap(catalogQueryFor(null)))).toBeNull();
    expect(catalogScopeOf(convertToParamMap({ appKind: 'DATABASE' }))).toBe('data');
    expect(catalogScopeOf(convertToParamMap({ appKind: 'TOOL' }))).toBe('applications');
  });

  it('counts databases and every building block as data, tools as applications', () => {
    expect(catalogSectionOf(entry('DATABASE', 'building-block'))).toBe('data');
    expect(catalogSectionOf(entry('APPLICATION', 'building-block'))).toBe('data');
    expect(catalogSectionOf(entry('APPLICATION', 'composed'))).toBe('applications');
    expect(inCatalogScope(entry('TOOL', 'standalone'), 'applications')).toBeTrue();
    expect(inCatalogScope(entry('APPLICATION', 'building-block'), 'applications')).toBeFalse();
    expect(inCatalogScope(entry('SYSTEM', 'standalone'), 'data')).toBeFalse();
  });
});
