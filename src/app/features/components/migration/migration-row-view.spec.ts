import {
  durationOf,
  formatDuration,
  formatWhen,
  shortId,
  sourceLabel,
  statusLabel,
  statusText,
  statusTone,
  typeLabel,
} from './migration-row-view';
import type { MigrationRow } from '../../service/migration.service';

describe('migration row view helpers', () => {
  it('labels the migration type and status for people', () => {
    expect(typeLabel('db')).toBe('Database');
    expect(statusLabel('db_replicating')).toBe('db replicating');
  });

  it('maps terminal, failed and in-flight statuses to kit tones', () => {
    expect(statusTone('COMPLETED')).toBe('success');
    expect(statusTone('bridging')).toBe('progress');
    expect(statusTone('failed_forward')).toBe('error');
    expect(statusTone('app_staging')).toBe('progress');
    expect(statusTone('unknown')).toBe('neutral');
    expect(statusText('db_replicating')).toBe('DB replicating');
  });

  it('measures how long a migration ran, or has been running', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(192_000)).toBe('3m 12s');
    expect(formatDuration(3_720_000)).toBe('1h 02m');
    const row = {
      type: 'app',
      startedAt: '2026-01-01T10:00:00.000Z',
      finishedAt: '2026-01-01T10:05:00.000Z',
    } as MigrationRow;
    expect(durationOf(row)).toBe('5m 00s');
    expect(durationOf({ type: 'app', startedAt: null } as unknown as MigrationRow)).toBe('—');
  });

  it('shortens ids and shows a dash when there is none', () => {
    expect(shortId('abcdef1234567890')).toBe('abcdef12');
    expect(shortId(null)).toBe('—');
    expect(sourceLabel({ type: 'full', appId: '0123456789' } as MigrationRow)).toBe('01234567');
    expect(sourceLabel({ type: 'db', srcAppId: null } as unknown as MigrationRow)).toBe('—');
  });

  it('keeps an unreadable time as given and a missing one as a dash', () => {
    expect(formatWhen(undefined)).toBe('—');
    expect(formatWhen('not a date')).toBe('not a date');
  });
});
