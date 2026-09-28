import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import type { AppProtection } from '../../service/fleet.service';
import type { Application } from '../../model/application.models';
import {
  backupAlarms,
  componentCard,
  dbData,
  dbLastBackup,
  dbSubtitle,
  internalNote,
  recentEvents,
  roleOf,
  runningSummary,
  splitCards,
} from './app-recap-bundle';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const app = (id: string, over: Partial<Application> = {}): Application =>
  ({ id, name: id, kind: 'APPLICATION', status: 'running', exposure: 'public', labels: {}, ...over }) as Application;

const db = app('db', {
  kind: 'DATABASE',
  exposure: 'cluster',
  catalogVersion: '16',
  labels: { 'flui.cloud/composed-component': 'store', 'flui.cloud/db-engine': 'postgres' },
});

const volume = (used: number | null, capacity: number | null) =>
  ({ volume: { used_bytes: used, capacity_bytes: capacity, utilization_percent: 6 } }) as unknown as AppMetricsDto;

const protection = (over: Record<string, unknown>): AppProtection =>
  ({ applicationId: 'x', coverage: { holdsData: true, coverage: 'protected', lastSuccessAt: null, alarm: false, protectPath: null, ...over } }) as unknown as AppProtection;

describe('app recap bundle', () => {
  it('names a component by its bundle role, falling back to the app name', () => {
    expect(roleOf(db)).toBe('store');
    expect(roleOf(app('web'))).toBe('web');
  });

  it('builds a component card with a disk bar only when a volume is reported', () => {
    const card = componentCard(db, { ...volume(1, 5 * 1024 ** 3), status: { replicas_ready: 1, replicas_desired: 1 } } as AppMetricsDto, undefined, false);
    expect(card.badge).toBe('PostgreSQL · cluster');
    expect(card.meta).toBe('1 of 1 replica · volume 5.0 GB');
    expect(card.bars.map((b) => b.key)).toEqual(['CPU', 'MEM', 'DISK']);
    expect(card.backup).toBeNull();
    const web = componentCard(app('web'), undefined, undefined, true);
    expect(web.badge).toBe('primary · public');
    expect(web.meta).toBe('replicas not reported');
    expect(web.bars).toHaveSize(2);
  });

  it('puts the primary and public components in front, the rest behind, and notes cluster-only ones', () => {
    const cards = [app('web'), db].map((a) => componentCard(a, undefined, undefined, a.id === 'web'));
    const { front, back } = splitCards(cards, 'web');
    expect(front.map((c) => c.app.id)).toEqual(['web']);
    expect(back.map((c) => c.app.id)).toEqual(['db']);
    expect(internalNote(back)).toBe('store is reachable inside the cluster only.');
    expect(splitCards([cards[1]], undefined).front).toHaveSize(1);
    expect(runningSummary([app('web'), app('w2', { status: 'stopped' } as Partial<Application>)])).toBe('1 of 2 components running');
  });

  it('raises an alarm only when the rule alarms and offers a Protect path', () => {
    const alarms = backupAlarms(
      [db, app('web')],
      { db: protection({ alarm: true, protectPath: '/p?a=1' }), web: protection({ alarm: true }) },
      { db: volume(1, 5 * 1024 ** 3) },
    );
    expect(alarms).toHaveSize(1);
    expect(alarms[0].title).toBe('The database has no backup');
    expect(alarms[0].detail).toBe('store keeps data on a 5.0 GB volume and no recent backup protects it.');
  });

  it('merges audit answers newest first, prefixing the component when there are several', () => {
    const events = recentEvents(
      [app('web'), db],
      [
        { events: [{ id: 'a', eventType: 'created', createdAt: '2026-09-01T00:00:00Z' }] },
        [{ id: 'b', eventType: 'deploy', createdAt: '2026-09-02T00:00:00Z' }],
      ],
    );
    expect(events.map((e) => e.id)).toEqual(['b', 'a']);
    expect(events[1]).toEqual(jasmine.objectContaining({ text: 'web: Application created', tone: 'ok' }));
    expect(recentEvents([app('web')], [null])).toEqual([]);
  });

  it('describes the database block', () => {
    expect(dbSubtitle(db)).toBe('PostgreSQL 16 · cluster only');
    expect(dbData(volume(300 * 1024 ** 2, null))).toEqual({ value: '300 MB', label: 'Data' });
    expect(dbData(undefined)).toEqual({ value: '—', label: 'Data' });
    expect(dbLastBackup(undefined)).toEqual({ value: '—', tone: 'muted' });
    expect(dbLastBackup(protection({}))).toEqual({ value: 'None', tone: 'warn' });
    expect(dbLastBackup(protection({ lastSuccessAt: '2026-09-27T09:00:00Z' }), NOW)).toEqual({ value: '3h ago', tone: 'ok' });
  });
});
