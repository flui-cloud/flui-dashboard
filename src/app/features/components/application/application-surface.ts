import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { AppRuntimeResponseDto, Application } from '../../model/application.models';
import type { AppAccess } from '../../model/app-access';

// app.id names this producer (spec's own example: "vops"); the entity-ref namespace names
// the platform an entity belongs to, which other flui producers would share.
const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export interface ApplicationSurfaceInput {
  application: Application | null;
  runtime: AppRuntimeResponseDto | null | undefined;
  replicaCounts: { ready: number; desired: number };
  diagnosesCount: number;
  access: AppAccess | null;
  activeTab: string | null;
}

export interface ApplicationSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export function applicationEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://application/${id}`;
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

function containerObservations(runtime: AppRuntimeResponseDto | null | undefined): Observation[] {
  const container = runtime?.containers?.[0];
  if (!container) return [];
  return [
    textObservation('flui.application.cpu_request', container.requests?.cpu, 'api'),
    textObservation('flui.application.memory_request', container.requests?.memory, 'api'),
    textObservation('flui.application.cpu_limit', container.limits?.cpu, 'api'),
    textObservation('flui.application.memory_limit', container.limits?.memory, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

// The banner above the tabs is the only place access mode reaches the screen — a full
// (non-showcase, non-read-only) app shows no banner, so nothing is presented about it.
function accessObservation(access: AppAccess | null): Observation | null {
  if (access?.showcase) return textObservation('flui.application.access_mode', 'showcase', 'ui');
  if (access?.readOnly) return textObservation('flui.application.access_mode', 'read-only', 'ui');
  return null;
}

function titleCase(route: string): string {
  return route.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pageObservations(input: ApplicationSurfaceInput, app: Application): Observation[] {
  const image = input.runtime?.containers?.[0]?.image ?? app.imageRef;
  return [
    textObservation('flui.application.status', app.status, 'api'),
    textObservation('flui.application.category', app.category, 'api'),
    valueObservation('flui.application.replicas_ready', input.replicaCounts.ready, 'derived'),
    valueObservation('flui.application.replicas_desired', input.replicaCounts.desired, 'derived'),
    textObservation('flui.application.image', image, 'api'),
    ...containerObservations(input.runtime),
    textObservation('flui.application.last_deployed_at', app.lastDeployedAt, 'api'),
    input.diagnosesCount > 0
      ? valueObservation('flui.application.diagnoses_count', input.diagnosesCount, 'derived')
      : null,
    accessObservation(input.access),
  ].filter((observation): observation is Observation => observation !== null);
}

function tabScope(pageId: string, activeTab: string): SemanticScopeSnapshot {
  const observation = textObservation('flui.application.active_tab', activeTab, 'ui');
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
 * Everything a snapshot would express, without the revision/timestamp envelope around it —
 * split out from {@link buildApplicationSurface} so the revision counter can hash exactly
 * this (what is actually presented), never the raw component input. Pure over the
 * component's own signals — see spec §3.4 (anti-drift). No selection state is invented:
 * the application being viewed is the page's one real, obvious focus, so attention always
 * names it with reason "route" (unlike a list page with no selection).
 */
export function presentedContent(input: ApplicationSurfaceInput): PresentedContent | null {
  const app = input.application;
  if (!app) return null;

  const pageId = `app-detail:${app.id}`;
  const ref = applicationEntityRef(app.id);
  const entities: EntityReference[] = [{ ref, label: app.name, role: 'primary' }];

  // `state` describes the view (nothing to show / failed to load), never the entity's own
  // domain health — the app being "failed" is already carried as the status observation
  // above, so it is not repeated here as a view-error.
  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: app.name,
    entities,
    observations: pageObservations(input, app),
  };

  const scopes: SemanticScopeSnapshot[] = input.activeTab
    ? [pageScope, tabScope(pageId, input.activeTab)]
    : [pageScope];

  const attention: AttentionTarget[] = [{ scopeId: pageId, entityRef: ref, reason: 'route' }];

  return { scopes, attention };
}

export function buildApplicationSurface(
  input: ApplicationSurfaceInput,
  context: ApplicationSurfaceContext,
): SurfaceSnapshot | null {
  const app = input.application;
  const content = presentedContent(input);
  if (!app || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'app-detail',
      route: `applications/${app.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/**
 * Revision moves when the content a snapshot would express moves, never on the clock
 * (§7.1) — the same content-hash approach the vops producer uses, kept local to this
 * file rather than duplicated as component state. Hashes what would actually be
 * PRESENTED (the built scopes + attention), not the raw input: input carries fields
 * (e.g. runtime internals with nothing derived from them) that can change without any
 * observation on screen moving, which would otherwise bump the revision on nothing.
 */
export class ApplicationSurfaceRevision {
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
