import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { Project } from '../../model/project.model';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const PAGE_ID = 'projects';
const LIST_ID = `${PAGE_ID}:list`;
const MAX_ROWS = 60;

export interface ProjectsSurfaceInput {
  projects: Project[];
  workloadCounts: Readonly<Record<string, number>>;
}

export interface ProjectsSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export function projectEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://project/${id}`;
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

function projectRow(
  project: Project,
  workloadCounts: Readonly<Record<string, number>>,
): { ref: string; label: string; observations: Observation[] } {
  const appsCount = workloadCounts[project.id] ?? 0;
  return {
    ref: projectEntityRef(project.id),
    label: project.name,
    observations: [
      textObservation('flui.project.slug', project.slug, 'api'),
      valueObservation('flui.project.apps_count', appsCount, 'derived'),
      textObservation('flui.project.description', project.description, 'api'),
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * A list page with no per-row navigation or selection — a project card is managed in
 * place (assign/unassign an app inline), never opened as its own view. Per §4 of the
 * playbook: `attention` names only the page, every row is `role: 'related'`.
 */
export function presentedContent(input: ProjectsSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = { id: PAGE_ID, kind: 'page', label: 'Projects' };

  const rows = input.projects.slice(0, MAX_ROWS);
  const truncated = input.projects.length > rows.length;

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    completeness: {
      shown: rows.length,
      total: input.projects.length,
      ...(truncated ? { truncated: true } : {}),
    },
    state: { empty: rows.length === 0 },
  };

  const rowScopes: SemanticScopeSnapshot[] = rows.map((project) => {
    const row = projectRow(project, input.workloadCounts);
    const entities: EntityReference[] = [{ ref: row.ref, label: row.label, role: 'related' }];
    return {
      id: `${LIST_ID}:${project.id}`,
      parentId: LIST_ID,
      kind: 'region',
      entities,
      ...(row.observations.length ? { observations: row.observations } : {}),
    };
  });

  return {
    scopes: [pageScope, listScope, ...rowScopes],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildProjectsSurface(
  input: ProjectsSurfaceInput,
  context: ProjectsSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/projects',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as ApplicationSurfaceRevision — see application-surface.ts. */
export class ProjectsSurfaceRevision {
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
