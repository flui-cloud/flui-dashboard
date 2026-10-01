import { backupJobOutcome } from './backup-job-outcome';

describe('backupJobOutcome', () => {
  it('is null while the run is still going', () => {
    for (const status of ['pending', 'running', 'uploading', 'replicating'] as const) {
      expect(backupJobOutcome({ status })).toBeNull();
    }
  });

  it('calls a completed run complete, saying when no new full backup was needed', () => {
    expect(backupJobOutcome({ status: 'completed' })).toEqual({ status: 'completed', partial: false, detail: undefined });
    expect(backupJobOutcome({ status: 'completed', metadata: { baseSkipped: true } })?.detail).toContain('no new one was needed');
  });

  it('says when a run had nothing to copy', () => {
    expect(
      backupJobOutcome({ status: 'completed', errorMessage: undefined, metadata: { volumesCopied: [] } } as never)?.detail,
    ).toContain('Nothing to copy');
  });

  it('names the volumes a partial run left out', () => {
    expect(
      backupJobOutcome({
        status: 'partially_completed',
        metadata: {
          volumesFailed: [{ volume: 'uploads', reason: 'timeout' }],
          volumesNeedingDecision: [{ volume: 'data', reason: 'live database' }],
        },
      }),
    ).toEqual({ status: 'completed', partial: true, detail: 'Left out: uploads, data.' });
  });

  it('gives the reason a run failed or was cancelled', () => {
    expect(backupJobOutcome({ status: 'failed', errorMessage: 'bucket refused the upload' })).toEqual({
      status: 'failed',
      partial: false,
      detail: 'bucket refused the upload',
    });
    expect(backupJobOutcome({ status: 'cancelled' })?.detail).toBe('The backup was cancelled.');
  });
});
