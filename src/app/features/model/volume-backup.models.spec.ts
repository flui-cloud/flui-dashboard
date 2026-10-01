import {
  VolumeBackup,
  backupPathCrumbs,
  backupTriggerLabel,
  collapseSelection,
  joinBackupPath,
  offClusterBackups,
  parentBackupPath,
} from './volume-backup.models';

function backup(over: Partial<VolumeBackup>): VolumeBackup {
  return {
    id: 'b1',
    volumeName: 'data',
    engine: 'kopia',
    createdAt: '2026-10-01T02:00:00.000Z',
    kept: 'retention',
    logicalBytes: 1024,
    uploadedBytes: 10,
    stored: 'present',
    encrypted: true,
    restorable: true,
    browsable: true,
    reason: null,
    quiesce: null,
    snapshotId: 'k1',
    destinationId: 'd1',
    ...over,
  };
}

describe('volume backup models', () => {
  it('leaves clones on the cluster out of the off-cluster list', () => {
    const list = [
      backup({ id: 'a' }),
      backup({ id: 'b', engine: 'pvc-clone' }),
      backup({ id: 'c', engine: 'rclone' }),
    ];
    expect(offClusterBackups(list).map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('names a retention backup scheduled and a kept one manual', () => {
    expect(backupTriggerLabel(backup({ kept: 'retention' }))).toBe('Scheduled');
    expect(backupTriggerLabel(backup({ kept: 'until-deleted' }))).toBe(
      'Manual · kept',
    );
  });

  it('walks paths relative to the volume root', () => {
    expect(joinBackupPath('', 'db')).toBe('db');
    expect(joinBackupPath('db', 'app.sqlite')).toBe('db/app.sqlite');
    expect(parentBackupPath('db/x/y')).toBe('db/x');
    expect(parentBackupPath('db')).toBe('');
    expect(backupPathCrumbs('db/x')).toEqual([
      { label: 'db', path: 'db' },
      { label: 'x', path: 'db/x' },
    ]);
    expect(backupPathCrumbs('')).toEqual([]);
  });

  it('drops a selected path already inside a selected folder', () => {
    expect(
      collapseSelection(['uploads/a.png', 'uploads', 'db/app.sqlite', 'uploadsX']),
    ).toEqual(['db/app.sqlite', 'uploads', 'uploadsX']);
  });
});
