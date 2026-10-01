import { appOptions, chosenFirst, matchesApp } from './policy-app-picker.component';

describe('policy app picker', () => {
  it('lists live applications by name, leaving out platform components and the ones being removed', () => {
    expect(
      appOptions([
        { id: '2', name: 'web', slug: 'web', status: 'running', kind: 'APPLICATION' },
        { id: '1', name: 'Orders DB', slug: 'pg-orders', status: 'stopped', kind: 'DATABASE' },
        { id: '3', name: 'old', slug: 'old', status: 'deleting', kind: 'APPLICATION' },
        { id: '4', name: 'Flui API', slug: 'flui-api', status: 'running', kind: 'SYSTEM' },
      ] as never),
    ).toEqual([
      { id: '1', name: 'Orders DB', slug: 'pg-orders', database: true },
      { id: '2', name: 'web', slug: 'web', database: false },
    ]);
  });

  it('puts the chosen application first', () => {
    const a = { id: 'a', name: 'a', slug: 'a', database: false };
    const b = { id: 'b', name: 'b', slug: 'b', database: false };
    expect(chosenFirst([a, b], ['b']).map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('finds an application by its name or its slug', () => {
    const app = { id: '1', name: 'Orders DB', slug: 'pg-orders', database: true };
    expect(matchesApp(app, 'orders')).toBeTrue();
    expect(matchesApp(app, 'PG-')).toBeTrue();
    expect(matchesApp(app, '')).toBeTrue();
    expect(matchesApp(app, 'redis')).toBeFalse();
  });
});
