import {
  buildSurfaceList,
  compositeEntityRef,
  entityRef,
  instanceEntityRef,
  SURFACE_MAX_ROWS,
  textObservation,
  valueObservation,
} from './surface-kit';

describe('surface-kit', () => {
  it('builds a namespaced ref, percent-encoding the id', () => {
    expect(entityRef('vnet', 'abc-123')).toBe('flui://vnet/abc-123');
    expect(entityRef('vnet', 'a/b')).toBe('flui://vnet/a%2Fb');
  });

  it('composes a two-part id into one percent-encoded segment', () => {
    expect(compositeEntityRef('instance', 'hetzner', 'srv-1')).toBe('flui://instance/hetzner%3Asrv-1');
    expect(instanceEntityRef('hetzner', 'srv-1')).toBe(compositeEntityRef('instance', 'hetzner', 'srv-1'));
  });

  it('text/value observation helpers drop empty text but keep zero/false values', () => {
    expect(textObservation('flui.x.name', '', 'api')).toBeNull();
    expect(textObservation('flui.x.name', undefined, 'api')).toBeNull();
    expect(textObservation('flui.x.name', 'ok', 'api')).toEqual({
      key: 'flui.x.name',
      presentedAs: { text: 'ok' },
      source: 'api',
    });
    expect(valueObservation('flui.x.count', 0, 'derived')).toEqual({
      key: 'flui.x.count',
      presentedAs: { value: 0 },
      source: 'derived',
    });
  });

  it('builds one list scope plus one region scope per row, entities defaulting to related', () => {
    const { scopes, truncated } = buildSurfaceList({
      listId: 'thing-list',
      parentId: 'thing-page',
      label: 'Things',
      totalCount: 2,
      rows: [
        { id: 'thing-list:a', ref: 'flui://thing/a', label: 'A', observations: [valueObservation('flui.thing.n', 1, 'api')] },
        { id: 'thing-list:b', ref: 'flui://thing/b', label: 'B' },
      ],
    });

    expect(truncated).toBe(false);
    expect(scopes[0]).toEqual({
      id: 'thing-list',
      parentId: 'thing-page',
      kind: 'list',
      label: 'Things',
      completeness: { shown: 2, total: 2 },
    });
    expect(scopes[1]).toEqual({
      id: 'thing-list:a',
      parentId: 'thing-list',
      kind: 'region',
      label: 'A',
      entities: [{ ref: 'flui://thing/a', label: 'A', role: 'related' }],
      observations: [valueObservation('flui.thing.n', 1, 'api')],
    });
    expect(scopes[2].entities).toEqual([{ ref: 'flui://thing/b', label: 'B', role: 'related' }]);
  });

  it('honours an explicit selected role for real per-instance selection state', () => {
    const { scopes } = buildSurfaceList({
      listId: 'thing-list',
      parentId: 'thing-page',
      totalCount: 1,
      rows: [{ id: 'thing-list:a', ref: 'flui://thing/a', role: 'selected' }],
    });
    expect(scopes[1].entities![0].role).toBe('selected');
  });

  it('caps rows at SURFACE_MAX_ROWS and reports truncation on the list scope', () => {
    const rows = Array.from({ length: SURFACE_MAX_ROWS + 5 }, (_, i) => ({
      id: `thing-list:${i}`,
      ref: `flui://thing/${i}`,
    }));
    const { scopes, truncated } = buildSurfaceList({
      listId: 'thing-list',
      parentId: 'thing-page',
      totalCount: rows.length,
      rows,
    });
    expect(truncated).toBe(true);
    expect(scopes[0].completeness).toEqual({ shown: SURFACE_MAX_ROWS, total: rows.length, truncated: true });
    expect(scopes.length).toBe(SURFACE_MAX_ROWS + 1);
  });

  it('marks completeness.filtered when the caller says the rows are a filtered subset', () => {
    const { scopes } = buildSurfaceList({
      listId: 'thing-list',
      parentId: 'thing-page',
      totalCount: 10,
      filtered: true,
      rows: [{ id: 'thing-list:a', ref: 'flui://thing/a' }],
    });
    expect(scopes[0].completeness).toEqual({ shown: 1, total: 10, filtered: true });
  });
});
