import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

/* Semantic Surface — the Home / Dashboard page.
 *
 * A cross-cutting summary (clusters, providers, applications, backend health, recent
 * activity) with no single obvious focus the way Application Detail or Cluster Detail
 * have one: nothing here is "the thing the user is looking at", it is several small
 * counts about the whole installation. So — same pattern as vops' surface-fleet.js for
 * its own page-without-selection case — `attention` claims only the page itself, no
 * entity, and the page carries the counts as observations. Recent-activity rows are
 * deliberately NOT modelled as entities here: dashboard-activity.component.ts's own
 * local `ActivityItem` type carries no cluster id (only name/status/time/provider), so
 * producing a `flui://cluster/<id>` ref for each row would mean re-deriving cluster
 * identity through a second lookup the template itself doesn't do — see the report for
 * why this was left out rather than silently worked around. */

const SURFACE_APP_ID = 'flui-dashboard';
const PAGE_ID = 'dashboard';

export type BackendHealth = 'online' | 'offline' | 'checking';

export interface DashboardSurfaceInput {
  loading: boolean;
  backendHealth: BackendHealth;
  activeOperations: number;
  providersConnected: number;
  clustersTotal: number;
  clustersActive: number;
  clustersUnhealthy: number;
  clusterNodesTotal: number;
  appsTotal: number;
  appsRunning: number;
  appsFailed: number;
  appsDatabases: number;
  appsApplications: number;
  appsTools: number;
}

export interface DashboardSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string, source: ObservationSource): Observation {
  return { key, presentedAs: { text: value }, source };
}

function valueObservation(key: string, value: number, source: ObservationSource): Observation | null {
  return value > 0 ? { key, presentedAs: { value }, source } : null;
}

function pageObservations(input: DashboardSurfaceInput): Observation[] {
  // `backendHealth` is presented as literal text in the pulse bar ("Online"/"API
  // Offline") — 'checking' is the brief pre-load state and is never actually settled by
  // the time this page stops loading, so it is excluded rather than presented as a fact.
  return [
    input.backendHealth !== 'checking' ? textObservation('flui.dashboard.backend_health', input.backendHealth, 'api') : null,
    valueObservation('flui.dashboard.active_operations', input.activeOperations, 'derived'),
    valueObservation('flui.dashboard.providers_connected', input.providersConnected, 'derived'),
    valueObservation('flui.dashboard.clusters_total', input.clustersTotal, 'derived'),
    valueObservation('flui.dashboard.clusters_active', input.clustersActive, 'derived'),
    valueObservation('flui.dashboard.clusters_unhealthy', input.clustersUnhealthy, 'derived'),
    valueObservation('flui.dashboard.cluster_nodes_total', input.clusterNodesTotal, 'derived'),
    valueObservation('flui.dashboard.apps_total', input.appsTotal, 'derived'),
    valueObservation('flui.dashboard.apps_running', input.appsRunning, 'derived'),
    valueObservation('flui.dashboard.apps_failed', input.appsFailed, 'derived'),
    valueObservation('flui.dashboard.apps_databases', input.appsDatabases, 'derived'),
    valueObservation('flui.dashboard.apps_applications', input.appsApplications, 'derived'),
    valueObservation('flui.dashboard.apps_tools', input.appsTools, 'derived'),
  ].filter((observation): observation is Observation => observation !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope. Like
 * the list-page producers (cluster-list-surface.ts) and unlike the entity-detail ones,
 * this never returns null: the page itself, with nothing resolved yet, is still real,
 * describable content — the skeleton state is honestly carried as `state.loading` on
 * the page scope, with no counts presented (the skeleton shows no real numbers either),
 * rather than the whole snapshot vanishing.
 */
export function presentedContent(input: DashboardSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Home',
    observations: input.loading ? [] : pageObservations(input),
    state: { loading: input.loading },
  };

  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes: [pageScope], attention };
}

export function buildDashboardSurface(
  input: DashboardSurfaceInput,
  context: DashboardSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'dashboard',
      route: 'dashboard',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash discipline as every other producer in this repo (§ "Errori già
 * fatti", point 1): hashes what presentedContent() built, never the raw input. */
export class DashboardSurfaceRevision {
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
