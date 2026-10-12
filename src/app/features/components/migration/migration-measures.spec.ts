import { kindLabel, measuresLine, nextStepsOf, poolerLine } from './migration-measures';
import type { MigrationRow } from '../../service/migration.service';

const row = (type: MigrationRow['type'], extra: Record<string, unknown> = {}): MigrationRow =>
  ({
    type,
    id: 'm1',
    srcAppId: 'a1',
    appId: 'a1',
    dbAppId: 'd1',
    srcClusterId: 'c1',
    targetClusterId: 'c2',
    cutoverMode: 'manual',
    status: 'completed',
    ...extra,
  }) as unknown as MigrationRow;

describe('migration measures on the migrations list', () => {
  it('shows whether a database or full migration copies logically or physically', () => {
    expect(kindLabel(row('full', { kind: 'physical' }))).toBe('physical');
    expect(kindLabel(row('db', { kind: 'logical' }))).toBe('logical');
    expect(kindLabel(row('db'))).toBeNull();
    expect(kindLabel(row('app'))).toBeNull();
  });

  it('puts the write pause, what ended it, and the interruption on one line', () => {
    expect(
      measuresLine(row('full', { writePauseMs: 6512, writePauseEndedBy: 'bridge', interruptionMs: 42000 })),
    ).toBe('Writes paused 6.5 s (until the bridge) · app stopped 42.0 s');
    expect(measuresLine(row('full', { writePauseMs: 12000, writePauseEndedBy: 'dns' }))).toBe(
      'Writes paused 12.0 s (until DNS moved)',
    );
    expect(measuresLine(row('full', { writePauseMs: 2400, writePauseEndedBy: 'promote' }))).toBe(
      'Writes paused 2.4 s (until the destination was promoted)',
    );
    expect(measuresLine(row('db', { writePauseMs: 2500 }))).toBe('Writes paused 2.5 s');
    expect(measuresLine(row('app', { interruptionMs: 3000 }))).toBe('app stopped 3.0 s');
  });

  it('tells a database row the WAL cap Flui put on the source', () => {
    expect(measuresLine(row('db', { sourceWalCap: { value: '2048MB', note: null } }))).toBe(
      'source WAL capped at 2048MB',
    );
  });

  it('shows nothing the API did not measure', () => {
    expect(measuresLine(row('full', { writePauseMs: null, interruptionMs: null }))).toBeNull();
    expect(measuresLine(row('db'))).toBeNull();
  });

  it("lists the API's next steps for database and full rows only", () => {
    const steps = [{ key: 'protect-database', text: 'Protect the new database with a backup policy.' }];
    expect(nextStepsOf(row('full', { nextSteps: steps }))).toEqual(steps);
    expect(nextStepsOf(row('db'))).toEqual([]);
    expect(nextStepsOf(row('app', { nextSteps: steps }))).toEqual([]);
  });

  it('says when writes waited in the poolers, and who was cut at the deadline', () => {
    expect(measuresLine(row('full', { writePauseMs: 8200, writePauseEndedBy: 'resume' }))).toBe(
      'Writes paused 8.2 s (waiting in the poolers, none failed)',
    );
    const pooler = (extra: Record<string, unknown>) => ({
      paused: false,
      pausedAt: 't0',
      resumedAt: 't1',
      deadlineMs: 5000,
      cut: [],
      ...extra,
    });
    expect(poolerLine(row('full', { pooler: pooler({ paused: true, resumedAt: null }) }))).toBe(
      'Poolers holding writes',
    );
    expect(poolerLine(row('full', { pooler: pooler({}) }))).toBeNull();
    expect(
      poolerLine(
        row('db', {
          pooler: pooler({
            cut: [
              { clientApp: 'worker - 10.42.0.9:5512', heldMs: 7000 },
              { clientApp: null, heldMs: null },
              { clientApp: 'api', heldMs: 6000 },
            ],
          }),
        }),
      ),
    ).toBe('Cut at the 5.0 s deadline: worker - 10.42.0.9:5512, a client and 1 more');
    expect(poolerLine(row('app'))).toBeNull();
  });
});
