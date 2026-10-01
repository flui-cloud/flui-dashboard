import { needsYouAppRow } from './needs-you-apps';
import type { NeedsYouApp } from '../../service/fleet.service';

const base: NeedsYouApp = {
  applicationId: 'a-1',
  name: 'Orders DB',
  slug: 'pg-orders',
  kind: 'DATABASE',
  clusterId: 'c-1',
  clusterName: 'wc-1',
  reason: 'no_policy',
  lastSuccessAt: null,
  protect: { label: 'Protect', path: '/management/backup/policies/new?applicationId=a-1' },
  open: { label: 'Open application', path: '/apps/applications/a-1' },
  backups: { label: 'Open backups', path: '/apps/applications/a-1/snapshots' },
};

describe('needsYouAppRow', () => {
  it('names the app with its slug and cluster, links to it and offers to protect it', () => {
    expect(needsYouAppRow(base)).toEqual({
      id: 'a-1',
      name: 'Orders DB',
      secondary: 'pg-orders · wc-1',
      why: 'No policy covers it.',
      appPath: '/apps/applications/a-1',
      backupsPath: '/apps/applications/a-1/snapshots',
      protectPath: '/management/backup/policies/new?applicationId=a-1',
    });
  });

  it('says why protecting its cluster has not covered it, and offers no policy that would not help', () => {
    const row = needsYouAppRow({
      ...base,
      pendingReason: 'the database is not running yet',
      protect: null,
    });
    expect(row.why).toBe('The database is not running yet.');
    expect(row.protectPath).toBeNull();
  });

  it('leaves the slug out when it is the name, and still links an app the API gave no path for', () => {
    const row = needsYouAppRow({ ...base, name: 'pg', slug: 'pg', open: undefined, backups: undefined, reason: 'unknown' });
    expect(row.secondary).toBe('wc-1');
    expect(row.why).toBeNull();
    expect(row.appPath).toBe('/apps/applications/a-1');
    expect(row.backupsPath).toBe('/apps/applications/a-1/snapshots');
  });
});
