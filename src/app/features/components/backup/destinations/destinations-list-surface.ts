import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupDestination } from '../../../model/backup.models';
import { formatBytes, providerLabel } from '../../../model/backup.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'backup-destinations';
const LIST_ID = 'backup-destinations:list';
const MAX_ROWS = 50;

export function destinationEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-destination/${id}`;
}

export interface DestinationsListSurfaceInput {
  destinations: BackupDestination[];
  loading: boolean;
  hasLoadError: boolean;
}

export interface DestinationsListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function rowObservations(d: BackupDestination): Observation[] {
  return [
    textObservation('flui.backup.destination.provider', providerLabel(d.provider), 'derived'),
    textObservation('flui.backup.destination.region', d.region, 'api'),
    textObservation('flui.backup.destination.bucket', d.bucket, 'api'),
    textObservation('flui.backup.destination.health', d.healthStatus, 'api'),
    textObservation('flui.backup.destination.usage', formatBytes(d.usageBytes), 'derived'),
  ].filter((observation): observation is Observation => observation !== null);
}

/** One region-scope per row, owned by the list scope — the same shape as vops's
 * `surfaceListOf` (page → list → one scope per row), which this repo has no shared
 * helper for yet, so it is written out per producer per the playbook's one-file-per-page
 * rule. Rows never claim `role: 'primary'`: clicking a row navigates to its own detail
 * route (destination-detail-surface.ts), it does not select in place. */
function rowScope(d: BackupDestination): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: destinationEntityRef(d.id), label: d.name, role: 'related' };
  return {
    id: `${LIST_ID}:${d.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(d),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: DestinationsListSurfaceInput): PresentedContent {
  const all = input.destinations;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Backup destinations',
    ...(input.hasLoadError ? { state: { error: true } } : {}),
  };

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    completeness: {
      shown: rows.length,
      total: all.length,
      ...(all.length > rows.length ? { truncated: true } : {}),
    },
    state: { loading: input.loading, empty: rows.length === 0 },
  };

  return {
    scopes: [pageScope, listScope, ...rows.map(rowScope)],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildDestinationsListSurface(
  input: DestinationsListSurfaceInput,
  context: DestinationsListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/backup/destinations',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class DestinationsListSurfaceRevision {
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
