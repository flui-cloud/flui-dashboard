import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  clusterEntityRef,
  scopeIdPart,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from './application-surface';

const PAGE_ID = 'build-queue';
const QUEUE_ID = `${PAGE_ID}:queue`;
const JOBS_ID = `${PAGE_ID}:tasks`;
const PODS_ID = `${PAGE_ID}:workers`;
const CLEANUP_ID = `${PAGE_ID}:cleanup`;

export interface BuildQueueRow {
  buildId: string;
  applicationId: string;
  appSlug: string | null;
  branch: string;
  commitShortSha: string | null;
  ageMinutes: number;
  status: string;
}

export interface BuildTaskRow {
  /** What the table prints in the first column when it has one. */
  buildId: string | null;
  appSlug: string | null;
  purpose: string | null;
  status: string;
  ageMinutes: number;
  cpuRequest: string;
  memoryRequest: string;
}

export interface BuildWorkerRow {
  buildId: string | null;
  appSlug: string | null;
  phase: string;
  ageMinutes: number;
  containerCount: number;
}

export interface BuildNamespaceSurfaceInput {
  clusterCount: number;
  /** The cluster picked in the select — this page is about one cluster at a time. */
  selectedClusterId: string | null;
  selectedClusterName?: string;
  isLoadingClusters: boolean;
  isLoadingResources: boolean;
  /** `error()` — the red banner. The sentence stays out. */
  hasError: boolean;
  /** `refusal()` — the build queue belongs to the instance, so a guest is refused by design.
   * Not an error: see presentedContent. */
  refused: boolean;
  resources: {
    queued: BuildQueueRow[];
    tasks: BuildTaskRow[];
    workers: BuildWorkerRow[];
    totalCpuRequestMillicores: number;
    totalMemoryRequestMiB: number;
  } | null;
  cleanup: {
    open: boolean;
    olderThanMinutes: number;
    running: boolean;
    /** The preview lists Kubernetes object names; only how many travel. */
    previewTaskCount: number | null;
    previewWorkerCount: number | null;
  };
}

export interface BuildNamespaceSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

function keep(observations: (Observation | null)[]): Observation[] {
  return observations.filter((o): o is Observation => o !== null);
}

function queueRow(row: BuildQueueRow): SurfaceListRow {
  return {
    id: `${QUEUE_ID}:${scopeIdPart(row.buildId)}`,
    // The build is queued FOR an application, and the application is the entity a tool can
    // act on — there is no Flui tool that addresses a queue entry by its own id.
    ref: applicationEntityRef(row.applicationId),
    label: row.appSlug ?? row.buildId,
    observations: keep([
      textObservation('flui.build.status', row.status, 'api'),
      textObservation('flui.build.branch', row.branch, 'api'),
      textObservation('flui.build.commit', row.commitShortSha, 'api'),
      valueObservation('flui.build.age_minutes', row.ageMinutes, 'api', 'min'),
    ]),
  };
}

function taskRow(row: BuildTaskRow, index: number): SurfaceListRow {
  return {
    id: `${JOBS_ID}:${index}${row.buildId ? `:${scopeIdPart(row.buildId)}` : ''}`,
    // No ref, and no name: a Kubernetes Job is platform plumbing, not an entity of this
    // product — see the naming note on presentedContent.
    label: row.appSlug ?? row.purpose ?? 'build task',
    observations: keep([
      textObservation('flui.build_task.build_id', row.buildId, 'api'),
      textObservation('flui.build_task.status', row.status, 'api'),
      valueObservation('flui.build_task.age_minutes', row.ageMinutes, 'api', 'min'),
      textObservation('flui.build_task.cpu_request', row.cpuRequest, 'api'),
      textObservation('flui.build_task.memory_request', row.memoryRequest, 'api'),
    ]),
  };
}

function workerRow(row: BuildWorkerRow, index: number): SurfaceListRow {
  return {
    id: `${PODS_ID}:${index}${row.buildId ? `:${scopeIdPart(row.buildId)}` : ''}`,
    label: row.appSlug ?? 'build worker',
    observations: keep([
      textObservation('flui.build_worker.build_id', row.buildId, 'api'),
      textObservation('flui.build_worker.phase', row.phase, 'api'),
      valueObservation('flui.build_worker.age_minutes', row.ageMinutes, 'api', 'min'),
      valueObservation('flui.build_worker.containers', row.containerCount, 'derived'),
    ]),
  };
}

/**
 * Everything the Build Queue page would present, without the revision/timestamp envelope.
 *
 * WHAT THE USER IS LOOKING AT is one cluster's build namespace, and which cluster that is
 * comes from a select, not from the URL — so the cluster is held in `attention` with
 * `reason: 'selection'`, which is what actually happened, rather than `route`, which would
 * claim the address named it. With no cluster picked the page is a single empty select and
 * `attention` names only the page.
 *
 * THE RISK THIS PAGE CARRIES is becoming a replica of the store: three tables that mirror a
 * Kubernetes listing. Two rules keep it a description of a screen. First, the lists are
 * capped like every other list in this repo and declare their `completeness`. Second, the
 * NAMES of the Kubernetes objects — the Job name, the Pod name, the container names — never
 * travel: they are internal platform metadata (§7's last item), the product's own docs
 * policy keeps Kubernetes primitives out of what a user is shown, and nothing a consumer
 * could do with Flui takes one as an argument. What identifies a row here is the build it
 * belongs to and the application slug beside it, which is exactly the pair the table leads
 * with. Only the queue rows get an entity `ref` at all, and it is the application's.
 *
 * The refusal is an observation, not `state.error`: the page keeps it "apart from the
 * failures" in its own words — a capability outside this plan is not a view that broke.
 */
export function presentedContent(input: BuildNamespaceSurfaceInput): PresentedContent {
  const resources = input.resources;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Build Queue',
    ...(input.selectedClusterId
      ? {
          entities: [
            {
              ref: clusterEntityRef(input.selectedClusterId),
              ...(input.selectedClusterName ? { label: input.selectedClusterName } : {}),
              role: 'primary' as const,
            },
          ],
        }
      : {}),
    observations: keep([
      valueObservation('flui.build_queue.clusters', input.clusterCount, 'api'),
      boolObservation('flui.build_queue.cluster_chosen', Boolean(input.selectedClusterId), 'ui'),
      boolObservation('flui.build_queue.refused', input.refused, 'api'),
      resources ? valueObservation('flui.build_queue.queued', resources.queued.length, 'api') : null,
      resources ? valueObservation('flui.build_queue.running', resources.tasks.length, 'api') : null,
      resources ? valueObservation('flui.build_queue.cpu_requested', resources.totalCpuRequestMillicores, 'api', 'm') : null,
      resources ? valueObservation('flui.build_queue.memory_requested', resources.totalMemoryRequestMiB, 'api', 'MiB') : null,
    ]),
    state: {
      loading: input.isLoadingClusters || input.isLoadingResources,
      ...(input.hasError ? { error: true, errorCode: 'flui.build_queue.load_failed' } : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  if (resources) {
    const lists: [string, string, SurfaceListRow[], number][] = [
      [QUEUE_ID, 'Queue', resources.queued.map(queueRow), resources.queued.length],
      [JOBS_ID, 'Build Tasks', resources.tasks.map(taskRow), resources.tasks.length],
      [PODS_ID, 'Build Workers', resources.workers.map(workerRow), resources.workers.length],
    ];
    for (const [listId, label, rows, total] of lists) {
      const { scopes: listScopes } = buildSurfaceList({ listId, parentId: PAGE_ID, label, rows, totalCount: total });
      listScopes[0] = { ...listScopes[0], state: { loading: false, empty: total === 0 } };
      scopes.push(...listScopes);
    }
  }

  let attention: AttentionTarget[] = input.selectedClusterId
    ? [{ scopeId: PAGE_ID, entityRef: clusterEntityRef(input.selectedClusterId), reason: 'selection' }]
    : [{ scopeId: PAGE_ID, reason: 'route' }];

  if (input.cleanup.open) {
    scopes.push({
      id: CLEANUP_ID,
      parentId: PAGE_ID,
      kind: 'form',
      label: 'Clean up',
      observations: keep([
        valueObservation('flui.build_queue.cleanup_older_than', input.cleanup.olderThanMinutes, 'ui', 'min'),
        boolObservation('flui.build_queue.cleanup_running', input.cleanup.running, 'ui'),
        input.cleanup.previewTaskCount === null
          ? null
          : valueObservation('flui.build_queue.cleanup_preview_tasks', input.cleanup.previewTaskCount, 'api'),
        input.cleanup.previewWorkerCount === null
          ? null
          : valueObservation('flui.build_queue.cleanup_preview_workers', input.cleanup.previewWorkerCount, 'api'),
      ]),
    });
    // An opened panel is a view the user switched into, not a modal and not a selection.
    attention = [{ scopeId: CLEANUP_ID, reason: 'active-view' }];
  }

  return { scopes, attention };
}

export function buildBuildNamespaceSurface(
  input: BuildNamespaceSurfaceInput,
  context: BuildNamespaceSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'apps/build-namespace',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class BuildNamespaceSurfaceRevision {
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
