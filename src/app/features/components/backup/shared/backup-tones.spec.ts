import { backupBadgeTone, backupHealthTone, runStoredTone } from './backup-tones';

describe('backup tones', () => {
  it('maps the health states to status tones', () => {
    expect(backupHealthTone('ok')).toBe('success');
    expect(backupHealthTone('running')).toBe('progress');
    expect(backupHealthTone('failed')).toBe('error');
    expect(backupHealthTone('missed')).toBe('warning');
    for (const s of ['paused', 'never_run', 'on_demand'] as const) {
      expect(backupHealthTone(s)).toBe('neutral');
    }
  });

  it('keeps an unknown run status neutral', () => {
    expect(backupBadgeTone('job', 'queued_again')).toBe('neutral');
  });

  it('marks a missing stored run as an error', () => {
    expect(runStoredTone('present')).toBe('success');
    expect(runStoredTone('missing')).toBe('error');
  });
});
