import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ProviderDefinitionDto } from '../../../core/api';

// Same conventions as application-surface.ts (the first producer in this repo): one
// app.id for every producer here, and flui://<entity-type>/<entity-id> refs. The ref
// namespace/entity-type ('provider') is shared with provider-surface.ts (the detail
// page) on purpose — the same provider keeps one canonical ref across both pages.
const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const PAGE_ID = 'providers';
const LIST_ID = `${PAGE_ID}:list`;
// Matches SURFACE_MAX_ROWS in the vops fleet producer this pattern is taken from —
// a budget, not a real product limit, so the list scope reports the true total via
// `completeness` and never silently drops rows without saying so.
const MAX_ROWS = 60;

export interface ProviderListRow {
  /** The definition id ('hetzner', 'aws', …) — the same id the detail page's route uses. */
  providerId: string;
  displayName: string;
  /** 'not_configured' for a provider with no saved configuration yet. */
  status: string;
}

export interface ProvidersSurfaceInput {
  /** Exactly what the overview grid is showing right now — same filtered/derived array
   * providers-overview.component.ts computes for its own template, not a second pass
   * over the raw provider/configuration lists (§3.4, anti-drift). */
  filteredRows: ProviderListRow[];
  /** Unfiltered totals, so `completeness.total` describes the whole catalogue while the
   * rows shown reflect the active filters (mirrors the vops fleet `filtered` flag). */
  totalProvidersCount: number;
  searchTerm: string;
  statusFilter: string;
  credentialTypeFilter: string;
  isLoading: boolean;
  /** Set only while the configuration wizard is open for one provider — the page's one
   * real selection. Its own form fields (credential inputs) are never presented here:
   * see the redaction note on presentedContent below. */
  configuringProvider: ProviderDefinitionDto | null;
}

export interface ProvidersSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export function providerEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://provider/${id}`;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function listObservations(input: ProvidersSurfaceInput): Observation[] {
  return [
    valueObservation('flui.providers.shown_count', input.filteredRows.length, 'derived'),
    textObservation('flui.providers.search_term', input.searchTerm || null, 'ui'),
    textObservation('flui.providers.status_filter', input.statusFilter || null, 'ui'),
    textObservation('flui.providers.credential_type_filter', input.credentialTypeFilter || null, 'ui'),
  ].filter((observation): observation is Observation => observation !== null);
}

function isFiltered(input: ProvidersSurfaceInput): boolean {
  return !!(input.searchTerm || input.statusFilter || input.credentialTypeFilter);
}

function rowScope(row: ProviderListRow): SemanticScopeSnapshot {
  const ref = providerEntityRef(row.providerId);
  const entities: EntityReference[] = [{ ref, label: row.displayName, role: 'related' }];
  const observation = textObservation('flui.provider.status', row.status, 'api');
  return {
    id: `${LIST_ID}:${row.providerId}`,
    parentId: LIST_ID,
    kind: 'region',
    entities,
    ...(observation ? { observations: [observation] } : {}),
  };
}

// The provider being configured is the page's one real selection (§4 of the playbook):
// clicking "Configure" opens a wizard for that provider in place, it does not navigate
// away. Only the entity is named — never a field from the wizard's own credential form,
// which is a blank input for a NEW secret value, never a rendering of an existing one
// (verified in provider-configuration-wizard.component.ts: every credential field is a
// fresh, unpopulated `secret`-marked control).
function configureScope(provider: ProviderDefinitionDto): SemanticScopeSnapshot {
  const ref = providerEntityRef(provider.id);
  return {
    id: `${PAGE_ID}:configure:${provider.id}`,
    parentId: PAGE_ID,
    kind: 'selection',
    entities: [{ ref, label: provider.displayName, role: 'selected' }],
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything the page would express, without the revision/timestamp envelope — see
 * application-surface.ts for why this is split from buildProvidersSurface. This is a
 * list page with no per-row navigation (a click configures in place, it does not route
 * elsewhere) — see §4 of the playbook: every row is `related`, never `primary`, and
 * `attention` names no row entity UNLESS the configure wizard is open for one, which is
 * the page's one real, materialised selection (not an invented one).
 */
export function presentedContent(input: ProvidersSurfaceInput): PresentedContent {
  const rows = input.filteredRows.slice(0, MAX_ROWS);
  const truncated = input.filteredRows.length > rows.length;

  const pageScope: SemanticScopeSnapshot = { id: PAGE_ID, kind: 'page', label: 'Cloud Providers' };

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    observations: listObservations(input),
    completeness: {
      shown: rows.length,
      total: input.totalProvidersCount,
      ...(isFiltered(input) ? { filtered: true } : {}),
      ...(truncated ? { truncated: true } : {}),
    },
    state: { loading: input.isLoading, empty: rows.length === 0 },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, listScope, ...rows.map(rowScope)];
  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  if (input.configuringProvider) {
    const scope = configureScope(input.configuringProvider);
    scopes.push(scope);
    attention.unshift({ scopeId: scope.id, entityRef: providerEntityRef(input.configuringProvider.id), reason: 'selection' });
  }

  return { scopes, attention };
}

export function buildProvidersSurface(
  input: ProvidersSurfaceInput,
  context: ProvidersSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/providers',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as ApplicationSurfaceRevision — see application-surface.ts. */
export class ProvidersSurfaceRevision {
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
