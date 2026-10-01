import {
  formatDuration,
  formatRelativeTime,
  formatUtcDateTime,
  healthNeedsAttention,
  runEncryptionMarker,
  runTriggerLabel,
  sortByAttention,
  sortRunsNewestFirst,
} from './backup-activity';
import {
  backupHealthBadge,
  runStatusBadge,
  runStoredBadge,
} from './backup-badges';
import { BackupHealthState, BackupRun } from './backup-run.models';

const NOW = Date.parse('2026-09-30T12:00:00.000Z');

function run(over: Partial<BackupRun>): BackupRun {
  return {
    jobId: 'j',
    trigger: 'scheduled',
    status: 'completed',
    startedAt: null,
    finishedAt: null,
    durationSeconds: null,
    sizeBytes: null,
    encrypted: null,
    expiresAt: null,
    stored: 'present',
    errorMessage: null,
    ...over,
  };
}

describe('backup activity formatting', () => {
  it('says how far away a time is, in both directions', () => {
    expect(formatRelativeTime('2026-09-30T23:00:00.000Z', NOW)).toBe('in 11 h');
    expect(formatRelativeTime('2026-09-30T11:15:00.000Z', NOW)).toBe('45 min ago');
    expect(formatRelativeTime('2026-09-30T11:59:40.000Z', NOW)).toBe('just now');
    expect(formatRelativeTime('2026-09-30T12:00:20.000Z', NOW)).toBe('in under a minute');
    expect(formatRelativeTime('2026-09-29T12:00:00.000Z', NOW)).toBe('1 day ago');
    expect(formatRelativeTime('2026-10-03T12:00:00.000Z', NOW)).toBe('in 3 days');
  });

  it('shows a dash for a missing or unreadable time', () => {
    expect(formatRelativeTime(null, NOW)).toBe('—');
    expect(formatRelativeTime('not a date', NOW)).toBe('—');
    expect(formatUtcDateTime(null)).toBe('');
  });

  it('writes the UTC time without seconds', () => {
    expect(formatUtcDateTime('2026-09-30T02:05:09.000Z')).toBe('2026-09-30 02:05 UTC');
  });

  it('formats durations compactly', () => {
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(192)).toBe('3 min 12 s');
    expect(formatDuration(180)).toBe('3 min');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });

  it('names each trigger and keeps an unknown one readable', () => {
    expect(runTriggerLabel('scheduled')).toBe('Scheduled');
    expect(runTriggerLabel('manual')).toBe('Manual');
    expect(runTriggerLabel('platform_update')).toBe('Before update');
    expect(runTriggerLabel('some_new_trigger')).toBe('Some new trigger');
    expect(runTriggerLabel(null)).toBe('—');
  });

  it('marks encryption as locked, open or unknown', () => {
    expect(runEncryptionMarker(true)).toEqual({ icon: 'lucideLock', label: 'Encrypted' });
    expect(runEncryptionMarker(false)).toEqual({ icon: 'lucideLockOpen', label: 'Not encrypted' });
    expect(runEncryptionMarker(null)).toEqual({ icon: null, label: 'Encryption unknown' });
  });
});

describe('backup health', () => {
  it('treats only missed and failed as needing attention', () => {
    const states: BackupHealthState[] = ['ok', 'running', 'failed', 'missed', 'paused', 'never_run', 'on_demand'];
    expect(states.filter(healthNeedsAttention)).toEqual(['failed', 'missed']);
    expect(healthNeedsAttention(null)).toBe(false);
  });

  it('colours the states: ok green, running blue, failed red, missed an alarm, the rest neutral', () => {
    expect(backupHealthBadge('ok').classes).toContain('green');
    expect(backupHealthBadge('running').classes).toContain('blue');
    expect(backupHealthBadge('failed').classes).toContain('red');
    expect(backupHealthBadge('missed').classes).toContain('amber');
    expect(backupHealthBadge('missed').classes).toContain('font-semibold');
    for (const s of ['paused', 'never_run', 'on_demand'] as BackupHealthState[]) {
      expect(backupHealthBadge(s).classes).toContain('gray');
    }
    expect(backupHealthBadge('never_run').label).toBe('Never run');
    expect(backupHealthBadge('on_demand').label).toBe('On demand');
    expect(backupHealthBadge('something' as BackupHealthState).label).toBe('Unknown');
  });

  it('puts missed and failed rows first and keeps the rest in their order', () => {
    const rows = [
      { id: 'a', s: 'ok' },
      { id: 'b', s: 'missed' },
      { id: 'c', s: undefined },
      { id: 'd', s: 'failed' },
      { id: 'e', s: 'paused' },
    ] as { id: string; s: BackupHealthState | undefined }[];
    expect(sortByAttention(rows, (r) => r.s).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });
});

describe('backup runs', () => {
  it('orders runs newest first, falling back to the finish time', () => {
    const runs = [
      run({ jobId: 'old', startedAt: '2026-09-28T02:00:00.000Z' }),
      run({ jobId: 'new', startedAt: '2026-09-30T02:00:00.000Z' }),
      run({ jobId: 'mid', finishedAt: '2026-09-29T02:00:00.000Z' }),
    ];
    expect(sortRunsNewestFirst(runs).map((r) => r.jobId)).toEqual(['new', 'mid', 'old']);
  });

  it('keeps an unknown run status readable and neutral', () => {
    expect(runStatusBadge('completed').label).toBe('Completed');
    expect(runStatusBadge('queued_again')).toEqual(jasmine.objectContaining({ label: 'Queued again' }));
    expect(runStatusBadge('queued_again').classes).toContain('gray');
  });

  it('labels where a run is stored', () => {
    expect(runStoredBadge('present').label).toBe('Stored');
    expect(runStoredBadge('expired').label).toBe('Expired');
    expect(runStoredBadge('missing').classes).toContain('red');
    expect(runStoredBadge('unknown').label).toBe('Unknown');
  });
});
