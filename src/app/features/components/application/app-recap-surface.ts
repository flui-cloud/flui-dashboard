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
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from './application-surface';
import { appGroupEntityRef } from './applications-list-surface';

const SURFACE_ID = 'app-recap';

export interface AppRecapSurfaceInput {
  /** From the route — the app GROUP id, which is what this page is about. */
  groupId: string | null;
  group: {
    id: string;
    name: string;
    /** 'standalone' | a composed bundle. The facts grid only exists for a standalone. */
    type: string;
    status: string;
    category: string;
    createdAt: string;
    clusterId?: string;
    clusterName?: string;
  } | null;
  /** The component the header names — the group's primary, when it has one. */
  primary: {
    id: string;
    slug?: string;
    kindLabel: string;
    sourceLabel: string;
    exposure: string;
    replicas: number;
    catalogVersion?: string;
  } | null;
  /** 'db' | 'web' | 'none' — which access card the page draws. */
  accessKind: string;
  /** The applications loaded and this group was still not among them: the page's own
   * "not found" state rather than a spinner that never ends. */
  notFound: boolean;
  isLoading: boolean;
  /** The bundled databases the page draws an extra connect card for. */
  extraDatabases: { id: string; name: string; status: string }[];
}

export interface AppRecapSurfaceContext {
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

/**
 * Everything the post-deploy recap page would present, without the revision/timestamp
 * envelope.
 *
 * This page is a transit card on the way to `/apps/applications/:id`, and it names the same
 * app GROUP the applications list names — `flui://app-group/<id>`, not
 * `flui://application/<id>`, because a composed install is a bundle of several applications
 * and calling the bundle by one app's ref would misname it (the distinction
 * `applications-list-surface.ts` already drew). The group's primary component is carried
 * beside it as a `related` application, so "open the app" still resolves to something a tool
 * can act on.
 *
 * WHAT STAYS OUT, from a facts grid that shows it all: `connInfo` in any form — the page
 * draws a connect card with the coordinates of every bundled database, and that is credential
 * material; the endpoint host and the app URL — an unclassified network identifier
 * (playbook §6 point 4); the Kubernetes namespace and the image reference — internal platform
 * metadata, and the product's own docs policy keeps Kubernetes primitives out of what a user
 * is handed. What is left is what a reader actually asks this page: what kind of thing this
 * is, where it came from, on which cluster, how it is exposed, how many replicas, and whether
 * anything else is bundled with it.
 */
export function presentedContent(input: AppRecapSurfaceInput): PresentedContent | null {
  if (!input.groupId) return null;
  const pageId = `${SURFACE_ID}:${scopeIdPart(input.groupId)}`;
  const ref = appGroupEntityRef(input.groupId);

  if (!input.group) {
    // No snapshot while the applications are still arriving — there is no entity to be
    // looking at yet. Once the load has finished and the group is still missing, the page
    // shows its "not found" card, and that IS what the user is looking at.
    if (!input.notFound) return null;
    return {
      scopes: [
        {
          id: pageId,
          kind: 'page',
          label: 'Workload',
          entities: [{ ref, role: 'primary' }],
          state: { loading: false, error: true, errorCode: 'flui.app_recap.not_found' },
        },
      ],
      attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
    };
  }

  const group = input.group;
  const primary = input.primary;

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: group.name,
    entities: [
      { ref, label: group.name, role: 'primary' },
      ...(primary ? [{ ref: applicationEntityRef(primary.id), label: primary.slug ?? group.name, role: 'related' as const }] : []),
      ...(group.clusterId
        ? [{ ref: clusterEntityRef(group.clusterId), ...(group.clusterName ? { label: group.clusterName } : {}), role: 'related' as const }]
        : []),
    ],
    observations: keep([
      textObservation('flui.application.status', group.status, 'api'),
      textObservation('flui.application.category', group.category, 'api'),
      textObservation('flui.app_recap.group_type', group.type, 'api'),
      textObservation('flui.app_recap.created_at', group.createdAt, 'api'),
      textObservation('flui.app_recap.access_kind', input.accessKind, 'derived'),
      primary ? textObservation('flui.application.slug', primary.slug, 'api') : null,
      primary ? textObservation('flui.application.kind', primary.kindLabel, 'api') : null,
      primary ? textObservation('flui.application.source', primary.sourceLabel, 'api') : null,
      primary ? textObservation('flui.application.exposure', primary.exposure, 'api') : null,
      primary ? valueObservation('flui.application.replicas', primary.replicas, 'api') : null,
      primary ? textObservation('flui.application.catalog_version', primary.catalogVersion, 'api') : null,
      boolObservation('flui.app_recap.bundled_databases', input.extraDatabases.length > 0, 'derived'),
    ]),
    state: { loading: input.isLoading },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  if (input.extraDatabases.length > 0) {
    const listId = `${pageId}:databases`;
    const { scopes: dbScopes } = buildSurfaceList({
      listId,
      parentId: pageId,
      label: 'Bundled databases',
      totalCount: input.extraDatabases.length,
      rows: input.extraDatabases.map((db) => ({
        id: `${listId}:${scopeIdPart(db.id)}`,
        ref: applicationEntityRef(db.id),
        label: db.name,
        observations: keep([textObservation('flui.application.status', db.status, 'api')]),
      })),
    });
    scopes.push(...dbScopes);
  }

  return { scopes, attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }] };
}

export function buildAppRecapSurface(
  input: AppRecapSurfaceInput,
  context: AppRecapSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: SURFACE_ID,
      route: `apps/recap/${input.groupId}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class AppRecapSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent | null): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
