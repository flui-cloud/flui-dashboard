import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ClusterScalingRow } from '../../model/scaling-section.models';
import { clusterEntityRef } from '../cluster/cluster-surface';
import { modeOf } from './overview-format';

/* Semantic Surface — the Scaling page (root, `/scaling`).
 *
 * Every row names a cluster; clicking "Manage" navigates to `/scaling/:groupId`,
 * clicking "Set up scaling" opens an inline panel on the SAME row rather than
 * navigating or selecting anything. Neither is a selection of the row, so this follows
 * the same list-page pattern as cluster-list-surface.ts: `attention` claims only the
 * page, every row entity is `related`. Each row's entity ref reuses
 * `clusterEntityRef` from cluster-surface.ts — the row names a cluster (see
 * ClusterScalingRow.clusterId/clusterName), not a separate "scaling row" thing, so it
 * keeps the same canonical ref the cluster list and cluster detail producers use. */

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'scaling-overview';
const LIST_ID = 'scaling-overview:rows';

export interface ScalingSurfaceInput {
  rows: ClusterScalingRow[];
  loading: boolean;
  // `absent`/`failed` mirror ScalingOverviewComponent's own `loaded()` split (see
  // section-reading.ts): a 404 (API build without scaling groups) is structurally
  // different from a generic load failure, so it gets its own errorCode. Neither ever
  // carries the raw backend message string here — that is `freeText` from a server,
  // which §7's redaction checklist singles out, and `errorCode` must be namespaced,
  // never prose (schema `scopeState.errorCode` description).
  absent: boolean;
  failed: boolean;
}

export interface ScalingSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function valueObservation(
  key: string,
  value: number | boolean,
  unit: string | undefined,
  source: ObservationSource,
): Observation {
  return { key, presentedAs: { value, ...(unit ? { unit } : {}) }, source };
}

function textObservation(key: string, value: string, source: ObservationSource): Observation {
  return { key, presentedAs: { text: value }, source };
}

/** The three "situation" tiles at the top of the page (overview-situation.component.ts),
 * recomputed here from the exact same `rows` array the row scopes below are built from —
 * one pass, one source, not a second signal that could drift from what is on screen. */
function situationObservations(rows: ClusterScalingRow[]): Observation[] {
  const needing = rows.filter((r) => r.needsPerson !== null).length;
  const alarms = rows.filter((r) => r.openAlarm !== null).length;
  const priced = rows.filter((r) => r.monthlyEur !== null);
  const tracked = priced.length ? priced.reduce((sum, r) => sum + (r.monthlyEur as number), 0) : null;

  return [
    valueObservation('flui.scaling.needs_person_count', needing, undefined, 'derived'),
    valueObservation('flui.scaling.open_alarms_count', alarms, undefined, 'derived'),
    tracked === null
      ? textObservation('flui.scaling.billed_monthly', 'no bill', 'derived')
      : valueObservation('flui.scaling.billed_monthly', Math.round(tracked * 100) / 100, 'EUR', 'derived'),
  ];
}

function rowObservations(row: ClusterScalingRow): Observation[] {
  const mode = modeOf(row.capability, row);
  const observations: Observation[] = [
    textObservation('flui.scaling.mode', mode.label, 'ui'),
    valueObservation('flui.scaling.nodes', row.nodes, undefined, 'api'),
    valueObservation('flui.scaling.has_group', row.groupId !== null, undefined, 'api'),
  ];
  if (row.bounds) {
    observations.push(
      textObservation('flui.scaling.bounds', `${row.bounds.min}·${row.bounds.desired}·${row.bounds.max}`, 'derived'),
    );
  }
  if (row.monthlyEur !== null) {
    observations.push(valueObservation('flui.scaling.monthly_eur', row.monthlyEur, 'EUR', 'api'));
  } else {
    observations.push(
      textObservation('flui.scaling.monthly_eur', row.capability.billing === 'none' ? 'no bill' : 'not priced', 'derived'),
    );
  }
  if (row.openAlarm) {
    observations.push({
      key: 'flui.scaling.alarm_open',
      presentedAs: { value: true },
      source: 'api',
      observedAt: row.openAlarm.since,
    });
  }
  // Only the FACT that a person is needed is presented, never `row.needsPerson`'s own
  // free text (backend-authored prose per row) — same redaction discipline as
  // application-surface.ts excluding app.reconciliationError.
  if (row.needsPerson !== null) {
    observations.push(valueObservation('flui.scaling.needs_person', true, undefined, 'api'));
  }
  return observations;
}

function rowScope(row: ClusterScalingRow): SemanticScopeSnapshot {
  return {
    id: `${LIST_ID}:${row.clusterId}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [{ ref: clusterEntityRef(row.clusterId), label: row.clusterName, role: 'related' }],
    observations: rowObservations(row),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope. Like
 * cluster-list-surface.ts, this never returns null: a list page is always describable,
 * even mid-load or with the API reporting it does not serve scaling groups at all — see
 * `scope.state` on the list scope for how each of those is carried honestly instead of
 * being invented as rows that do not exist.
 */
export function presentedContent(input: ScalingSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Scaling',
  };

  const rows = input.loading || input.absent || input.failed ? [] : input.rows;

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Clusters',
    observations: rows.length > 0 ? situationObservations(rows) : [],
    completeness: { shown: rows.length, total: rows.length },
    state: {
      loading: input.loading,
      ...(input.absent
        ? { error: true, errorCode: 'flui.scaling.unserved' }
        : input.failed
          ? { error: true }
          : {}),
      empty: !input.loading && rows.length === 0,
    },
  };

  const rowScopes = rows.map((row) => rowScope(row));

  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes: [pageScope, listScope, ...rowScopes], attention };
}

export function buildScalingSurface(
  input: ScalingSurfaceInput,
  context: ScalingSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'scaling-overview',
      route: 'scaling',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash discipline as every other producer in this repo. */
export class ScalingSurfaceRevision {
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
