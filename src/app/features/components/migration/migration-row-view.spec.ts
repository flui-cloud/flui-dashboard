import { formatWhen, shortId, sourceLabel, statusBadgeClass, statusLabel, typeLabel } from './migration-row-view';
import type { MigrationRow } from '../../service/migration.service';

describe('migration row view helpers', () => {
  it('labels the migration type and status for people', () => {
    expect(typeLabel('db')).toBe('Database');
    expect(statusLabel('db_replicating')).toBe('db replicating');
  });

  it('colours terminal, bridging and in-flight statuses differently', () => {
    expect(statusBadgeClass('COMPLETED')).toContain('emerald');
    expect(statusBadgeClass('bridging')).toContain('sky');
    expect(statusBadgeClass('failed_forward')).toContain('red');
    expect(statusBadgeClass('app_staging')).toContain('amber');
    expect(statusBadgeClass('unknown')).toBe('border-border bg-muted text-muted-foreground');
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
