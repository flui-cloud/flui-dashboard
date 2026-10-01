import type { NeedsYouApp } from '../../service/fleet.service';
import { unprotectedWhy } from '../application/app-recap-view';

export interface NeedsYouAppRow {
  id: string;
  name: string;
  secondary: string;
  why: string | null;
  appPath: string;
  backupsPath: string;
  protectPath: string | null;
}

/** One unprotected app: who it is, where it runs, why, and what would help. */
export function needsYouAppRow(app: NeedsYouApp): NeedsYouAppRow {
  const secondary = [app.slug && app.slug !== app.name ? app.slug : null, app.clusterName]
    .filter((part): part is string => !!part)
    .join(' · ');
  return {
    id: app.applicationId,
    name: app.name,
    secondary,
    why: unprotectedWhy(app.pendingReason, app.reason),
    appPath: app.open?.path ?? `/apps/applications/${app.applicationId}`,
    backupsPath: app.backups?.path ?? `/apps/applications/${app.applicationId}/snapshots`,
    protectPath: app.protect?.path ?? null,
  };
}
