import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ClusterInfo } from '../../model/cluster.models';

// Same app.id as every other producer in this repo (application-surface.ts) — one
// producer identity per repo, not one per page.
const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export interface ClusterSurfaceInput {
  cluster: ClusterInfo | null;
  activeTab: string | null;
  // Both gate real, visible differences on this exact shell page (which buttons in the
  // toolbar render at all, and — for a control cluster — their disabled state plus the
  // tooltip text that replaces "Stop cluster"/"Start cluster"/"Delete cluster"), unlike
  // cluster.status, which this page never renders as text (only the tab content does,
  // out of scope for this pass — see the tab scope below).
  readOnly: boolean;
  isControlCluster: boolean;
}

export interface ClusterSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

/** Shared with cluster-list-surface.ts and scaling-surface.ts so a cluster keeps one
 * canonical ref across every producer that mentions it (spec §12.1 item 2) — the same
 * discipline vops' surface-fleet.js documents for its own host ref. */
export function clusterEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://cluster/${id}`;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function boolObservation(key: string, value: boolean, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { value: true }, source } : null;
}

function titleCase(route: string): string {
  return route.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pageObservations(input: ClusterSurfaceInput): Observation[] {
  return [
    boolObservation('flui.cluster.read_only', input.readOnly, 'ui'),
    boolObservation('flui.cluster.control_cluster', input.isControlCluster, 'ui'),
  ].filter((observation): observation is Observation => observation !== null);
}

function tabScope(pageId: string, activeTab: string): SemanticScopeSnapshot {
  const observation = textObservation('flui.cluster.active_tab', activeTab, 'ui');
  return {
    id: `${pageId}:tab:${activeTab}`,
    parentId: pageId,
    kind: 'region',
    label: titleCase(activeTab),
    ...(observation ? { observations: [observation] } : {}),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope — split
 * out so the revision counter can hash exactly this, never the raw component input (see
 * § "Errori già fatti", point 1, in the playbook). Mirrors application-surface.ts: the
 * cluster being viewed is this page's one real, obvious focus, so attention always names
 * it with reason "route". Not all ~10 child tabs are modelled individually — one region
 * scope for whichever tab the router currently reports, exactly like the application
 * producer's own tabScope, which is the pass the playbook asks for here.
 */
export function presentedContent(input: ClusterSurfaceInput): PresentedContent | null {
  const cluster = input.cluster;
  if (!cluster?.id) return null;

  const pageId = `cluster-detail:${cluster.id}`;
  const ref = clusterEntityRef(cluster.id);
  const label = cluster.name ?? cluster.id;
  const entities: EntityReference[] = [{ ref, label, role: 'primary' }];

  // `state` describes the view, never the cluster's own domain health (§4.3) — this
  // shell page never renders cluster.status as text itself (only a child tab does, and
  // that is out of scope for this pass), so no status observation is invented here.
  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label,
    entities,
    observations: pageObservations(input),
  };

  const scopes: SemanticScopeSnapshot[] = input.activeTab
    ? [pageScope, tabScope(pageId, input.activeTab)]
    : [pageScope];

  const attention: AttentionTarget[] = [{ scopeId: pageId, entityRef: ref, reason: 'route' }];

  return { scopes, attention };
}

export function buildClusterSurface(
  input: ClusterSurfaceInput,
  context: ClusterSurfaceContext,
): SurfaceSnapshot | null {
  const cluster = input.cluster;
  const content = presentedContent(input);
  if (!cluster?.id || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'cluster-detail',
      route: `cluster/${cluster.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/**
 * Revision moves only when what would actually be PRESENTED moves (§7.1) — hashes the
 * built `presentedContent`, never the raw input, for the same reason
 * ApplicationSurfaceRevision does (§ "Errori già fatti", point 1).
 */
export class ClusterSurfaceRevision {
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
