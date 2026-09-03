import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupDestination } from '../../../model/backup.models';
import { costEstimateMonthlyEur, formatBytes, providerLabel } from '../../../model/backup.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export function destinationEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-destination/${id}`;
}

export interface DestinationDetailSurfaceInput {
  destination: BackupDestination | null;
}

export interface DestinationDetailSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(d: BackupDestination): Observation[] {
  const cost = costEstimateMonthlyEur(d.usageBytes, d.costPerGbMonthCents);
  return [
    textObservation('flui.backup.destination.provider', providerLabel(d.provider), 'derived'),
    textObservation('flui.backup.destination.health', d.healthStatus, 'api'),
    textObservation('flui.backup.destination.endpoint', d.endpoint, 'api'),
    textObservation('flui.backup.destination.region', d.region, 'api'),
    textObservation('flui.backup.destination.bucket', d.bucket, 'api'),
    textObservation('flui.backup.destination.path_prefix', d.pathPrefix, 'api'),
    textObservation('flui.backup.destination.encryption_mode', d.encryptionMode, 'api'),
    textObservation('flui.backup.destination.usage', formatBytes(d.usageBytes), 'derived'),
    cost != null ? textObservation('flui.backup.destination.estimated_cost_eur', cost.toFixed(2), 'derived') : null,
    textObservation('flui.backup.destination.last_health_check_at', d.lastHealthCheckAt, 'api'),
    // `lastHealthError` is shown on screen, but is raw backend/network free text — same
    // exclusion as application-surface.ts's `reconciliationError` (§ "Errori già fatti" is
    // silent on this specific field, but the redaction checklist of §7 is not: raw
    // error/stack-trace text never enters the snapshot). Only whether one exists is safe.
    d.lastHealthError ? valueObservation('flui.backup.destination.has_health_error', true, 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: DestinationDetailSurfaceInput): PresentedContent | null {
  const d = input.destination;
  if (!d) return null;

  const pageId = `backup-destination-detail:${d.id}`;
  const ref = destinationEntityRef(d.id);
  const entities: EntityReference[] = [{ ref, label: d.name, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: d.name,
    entities,
    observations: pageObservations(d),
  };

  return {
    scopes: [pageScope],
    attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
  };
}

export function buildDestinationDetailSurface(
  input: DestinationDetailSurfaceInput,
  context: DestinationDetailSurfaceContext,
): SurfaceSnapshot | null {
  const d = input.destination;
  const content = presentedContent(input);
  if (!d || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'backup-destination-detail',
      route: `management/backup/destinations/${d.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class DestinationDetailSurfaceRevision {
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
