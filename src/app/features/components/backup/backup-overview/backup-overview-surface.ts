import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

// Same producer namespace as every other Flui producer (application-surface.ts).
const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'backup-overview';

export interface BackupOverviewSurfaceInput {
  destinationsCount: number;
  policiesCount: number;
  degradedPoliciesCount: number;
  restoreJobsCount: number;
  totalUsageText: string;
  clustersAvailable: number;
  hasLoadError: boolean;
}

export interface BackupOverviewSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function valueObservation(key: string, value: number, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function textObservation(key: string, value: string, source: ObservationSource): Observation {
  return { key, presentedAs: { text: value }, source };
}

function pageObservations(input: BackupOverviewSurfaceInput): Observation[] {
  return [
    valueObservation('flui.backup.destinations_count', input.destinationsCount, 'derived'),
    valueObservation('flui.backup.policies_count', input.policiesCount, 'derived'),
    input.degradedPoliciesCount > 0
      ? valueObservation('flui.backup.policies_degraded_count', input.degradedPoliciesCount, 'derived')
      : null,
    valueObservation('flui.backup.restore_jobs_count', input.restoreJobsCount, 'derived'),
    textObservation('flui.backup.total_usage', input.totalUsageText, 'derived'),
    valueObservation('flui.backup.clusters_available', input.clustersAvailable, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * The Backup landing page has no real entity or selection — it is a dashboard of counts
 * with cards that navigate to the actually-distinct routes (destinations/policies/jobs/
 * restore, each its own producer). Per spec §4/pattern 2, attention names only the page,
 * never an invented entity. `state.error` carries a failed load (view outcome), never a
 * domain value — see §4.3 and application-surface.ts's own note on the same rule.
 */
export function presentedContent(input: BackupOverviewSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Backup & Restore',
    observations: pageObservations(input),
    ...(input.hasLoadError ? { state: { error: true } } : {}),
  };

  return {
    scopes: [pageScope],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildBackupOverviewSurface(
  input: BackupOverviewSurfaceInput,
  context: BackupOverviewSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/backup/overview',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision hashes exactly what `presentedContent` produces — see application-surface.ts's
 * own note (§ "Errori già fatti", point 1) on why it must not hash the raw component input. */
export class BackupOverviewSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
