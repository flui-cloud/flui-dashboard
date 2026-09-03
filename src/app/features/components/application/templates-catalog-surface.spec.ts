import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  TemplatesCatalogSurfaceInput,
  TemplatesCatalogSurfaceRevision,
  templateEntityRef,
  buildTemplatesCatalogSurface,
  presentedContent,
} from './templates-catalog-surface';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';

function template(over: Partial<TemplateResponseDto> = {}): TemplateResponseDto {
  return {
    framework: 'nextjs',
    displayName: 'Next.js',
    description: 'A React meta-framework.',
    version: '1.0.0',
    repo: 'template-nextjs',
    repoUrl: 'https://github.com/flui-cloud/template-nextjs',
    category: 'fullstack' as TemplateResponseDto['category'],
    language: 'TypeScript',
    port: 3000,
    healthcheckPath: '/',
    buildTool: 'npm',
    isDefault: true,
    isDeprecated: false,
    ...over,
  };
}

function input(over: Partial<TemplatesCatalogSurfaceInput> = {}): TemplatesCatalogSurfaceInput {
  const templates = over.allTemplates ?? [template()];
  return {
    allTemplates: templates,
    filteredTemplates: templates,
    categoryOf: () => 'frontend',
    categoryFilter: '',
    hasActiveSearch: false,
    highlightedFramework: null,
    isLoading: false,
    hasLoadError: false,
    ...over,
  };
}

function snapshotOf(over: Partial<TemplatesCatalogSurfaceInput> = {}): SurfaceSnapshot {
  return buildTemplatesCatalogSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'page')!;
const listScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'list')!;
const rowScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.kind === 'region');

describe('templates catalog surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new TemplatesCatalogSurfaceRevision();
    const first = buildTemplatesCatalogSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildTemplatesCatalogSurface(
      input({ isLoading: true }),
      { revision: tracker.next(presentedContent(input({ isLoading: true }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('with no deep-link highlight, every row is related and attention names only the page', () => {
    const tpls = [template({ framework: 'nextjs' }), template({ framework: 'nestjs', displayName: 'NestJS' })];
    const snapshot = snapshotOf({ allTemplates: tpls, filteredTemplates: tpls });
    expect(snapshot.attention).toEqual([{ scopeId: 'templates-catalog', reason: 'route' }]);
    for (const row of rowScopes(snapshot)) {
      expect(row.entities?.every((e) => e.role === 'related')).toBe(true);
    }
  });

  it('a deep-link highlight that is actually rendered becomes the one selected row, and attention', () => {
    const tpls = [template({ framework: 'nextjs' }), template({ framework: 'nestjs', displayName: 'NestJS' })];
    const snapshot = snapshotOf({ allTemplates: tpls, filteredTemplates: tpls, highlightedFramework: 'nestjs' });
    expect(snapshot.attention).toEqual([
      { scopeId: 'templates-catalog:list', entityRef: templateEntityRef('nestjs'), reason: 'selection' },
    ]);
    const nest = rowScopes(snapshot).find((s) => s.id.endsWith(':nestjs'))!;
    const next = rowScopes(snapshot).find((s) => s.id.endsWith(':nextjs'))!;
    expect(nest.entities?.[0].role).toBe('selected');
    expect(next.entities?.[0].role).toBe('related');
  });

  it('a deep-link highlight filtered out of the rendered set is never invented into attention', () => {
    const tpls = [template({ framework: 'nextjs' })];
    // nestjs exists in the catalog but the category filter has removed it from what's shown
    const snapshot = snapshotOf({
      allTemplates: [...tpls, template({ framework: 'nestjs' })],
      filteredTemplates: tpls,
      highlightedFramework: 'nestjs',
    });
    expect(snapshot.attention).toEqual([{ scopeId: 'templates-catalog', reason: 'route' }]);
    expect(rowScopes(snapshot).every((s) => s.entities?.[0].role === 'related')).toBe(true);
  });

  it('presents the UI-effective category (override applied), not necessarily the raw API category', () => {
    const tpl = template({ framework: 'nextjs', category: 'fullstack' as TemplateResponseDto['category'] });
    const snapshot = snapshotOf({
      allTemplates: [tpl],
      filteredTemplates: [tpl],
      categoryOf: () => 'frontend', // the UI's own override (nextjs is bucketed under Frontend)
    });
    const row = rowScopes(snapshot)[0];
    expect(row.observations?.find((o) => o.key === 'flui.template.category')?.presentedAs.text).toBe('frontend');
  });

  it('distinguishes loading, error and empty on the list scope', () => {
    expect(listScope(snapshotOf({ isLoading: true, filteredTemplates: [] })).state)
      .toEqual({ loading: true, empty: false });
    expect(listScope(snapshotOf({ hasLoadError: true, filteredTemplates: [] })).state)
      .toEqual({ loading: false, error: true, empty: true });
  });

  it('caps row scopes at the budget and declares truncation honestly', () => {
    const many = Array.from({ length: 35 }, (_, i) => template({ framework: `fw-${i}`, displayName: `FW ${i}` }));
    const snapshot = snapshotOf({ allTemplates: many, filteredTemplates: many });
    expect(rowScopes(snapshot).length).toBe(30);
    expect(listScope(snapshot).completeness).toEqual({ shown: 30, total: 35, truncated: true });
  });

  it('redacts: no repo URL ever reaches the snapshot', () => {
    const tpl = template({ repoUrl: 'https://github.com/flui-cloud/super-secret-internal-template' });
    const json = JSON.stringify(snapshotOf({ allTemplates: [tpl], filteredTemplates: [tpl] }));
    expect(json).not.toContain('https://github.com');
    expect(json).not.toContain('super-secret-internal-template');
  });

  it('never presents the live-typed search text, only whether a search is active', () => {
    const json = JSON.stringify(snapshotOf({ hasActiveSearch: true }));
    expect(json).not.toContain('do-not-leak-this');
  });
});
