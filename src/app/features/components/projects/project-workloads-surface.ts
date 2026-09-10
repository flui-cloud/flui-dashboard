import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  scopeIdPart,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from '../application/application-surface';
import { appGroupEntityRef } from '../application/applications-list-surface';
import { projectEntityRef } from './projects-surface';
import type { AppGroupView } from '../../model/application.models';

/**
 * The Projects *workloads* page (`/apps/projects`), which is a different page from the
 * Projects management list at `/management/projects` — that one has its own producer,
 * `projects-surface.ts`, and its own page id. Both name the same `flui://project/<id>`
 * entities, deliberately: one canonical ref per entity across views (spec §12.1 item 2).
 */
const PAGE_ID = 'project-workloads';
const CREATE_ID = `${PAGE_ID}:create`;
const EDIT_ID = `${PAGE_ID}:edit`;
const PROJECT_DELETE_ID = `${PAGE_ID}:delete-project`;
const APP_DELETE_ID = `${PAGE_ID}:delete-workload`;
const UNASSIGNED_KEY = '__unassigned';

/**
 * This page can draw dozens of sections, each with its own rows, and the schema caps a
 * snapshot at 200 scopes. Two budgets instead of one big list cap: a section that is
 * present at all keeps a usable number of rows, and the page stops adding sections before
 * the ceiling. Both are declared through `completeness`/`surface.truncated`, never silently.
 */
const MAX_SECTIONS = 12;
const MAX_ROWS_PER_SECTION = 10;

export interface ProjectWorkloadsSection {
  /** Null for the "Unassigned" section — real workloads, no project entity to name. */
  projectId: string | null;
  name: string;
  slug?: string;
  /** The line the section header prints: "3 applications · 1 database", or "No workloads". */
  summary: string;
  collapsed: boolean;
  groups: AppGroupView[];
}

export interface ProjectWorkloadsSurfaceInput {
  /** `sections()` — already filtered by search/kind/system/hide-empty, in page order. */
  sections: ProjectWorkloadsSection[];
  /** `projects().length` — every project, before `hideEmpty` drops the empty ones. */
  projectCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  canManage: boolean;
  /** Whether the search box holds a term — never the term itself, which is still being
   * typed and is not committed content (the same call applications-list-surface makes). */
  hasSearch: boolean;
  kindFilter: string;
  includeSystem: boolean;
  hideEmpty: boolean;

  createOpen: boolean;
  editing: { id: string; name: string } | null;
  pendingProjectDelete: { id: string; name: string } | null;
  /** A single Application, not a group: `askDeleteApp` is wired to the row's component. */
  pendingAppDelete: { id: string; name: string } | null;
}

export interface ProjectWorkloadsSurfaceContext {
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

function sectionKey(section: ProjectWorkloadsSection): string {
  return scopeIdPart(section.projectId ?? UNASSIGNED_KEY);
}

function sectionScopes(section: ProjectWorkloadsSection, filtered: boolean): SemanticScopeSnapshot[] {
  const listId = `${PAGE_ID}:section:${sectionKey(section)}`;
  // A collapsed section shows its header and its summary line and nothing else — the rows
  // are genuinely not on the screen, so they are not claimed. `completeness` then says
  // "0 of N", which is the truth, and the collapsed flag says why.
  const rows = section.collapsed
    ? []
    : section.groups.slice(0, MAX_ROWS_PER_SECTION).map((group) => ({
        id: `${listId}:${scopeIdPart(group.id)}`,
        ref: appGroupEntityRef(group.id),
        label: group.name,
        observations: keep([
          textObservation('flui.application.status', group.status, 'api'),
          textObservation('flui.application.category', group.category, 'api'),
          valueObservation('flui.application.components', group.components.length, 'derived'),
        ]),
      }));

  const { scopes } = buildSurfaceList({
    listId,
    parentId: PAGE_ID,
    label: section.name,
    totalCount: section.groups.length,
    rows,
    filtered,
    listObservations: [
      textObservation('flui.project_workloads.section_summary', section.summary, 'derived'),
      textObservation('flui.project.slug', section.slug, 'api'),
      boolObservation('flui.project_workloads.section_collapsed', section.collapsed, 'ui'),
    ],
  });

  scopes[0] = {
    ...scopes[0],
    ...(section.projectId
      ? { entities: [{ ref: projectEntityRef(section.projectId), label: section.name, role: 'related' as const }] }
      : {}),
    state: { loading: false, empty: section.groups.length === 0 },
    completeness: {
      shown: rows.length,
      total: section.groups.length,
      ...(filtered ? { filtered: true } : {}),
      ...(!section.collapsed && section.groups.length > rows.length ? { truncated: true } : {}),
    },
  };
  return scopes;
}

/**
 * Everything the Projects workloads page would present, without the revision/timestamp
 * envelope.
 *
 * SHAPE. This is a list page with no row selection — clicking a workload navigates to its
 * recap — so no row is ever `role: 'primary'` and the page's own claim on `attention` is
 * just `reason: 'route'` with no entity (playbook §4, second case). The "Unassigned"
 * section is the fifth case seen from the other side: it holds REAL workloads, each with
 * its own ref, but the section itself names no project, so the list scope simply carries no
 * entity rather than being given an invented `flui://project/__unassigned`.
 *
 * ARBITRATION (playbook §4, sixth case — written down, not left to evaluation order). Four
 * things on this page can claim attention at once:
 *   1. the Delete-project dialog — an overlay naming a project;
 *   2. the Delete-workload dialog — an overlay naming one application;
 *   3. the inline rename form — a real per-instance selection naming a project;
 *   4. the inline "New project" form — an opened view naming nothing that exists yet.
 * They rank in that order. Between the two dialogs the project one wins: deleting a project
 * is the wider act, and it is the entity that contains the other. The two inline forms rank
 * below both dialogs because a dialog is modal and physically on top. `reason` follows the
 * spec's own reserved vocabulary rather than the shape of the widget: `overlay` for the two
 * modals — the same reading `repositories-list-surface.ts` already took for its own
 * delete-confirmation dialog — `selection` for the rename (a project was picked),
 * `active-view` for the create form (a region the user opened, naming nothing).
 */
export function presentedContent(input: ProjectWorkloadsSurfaceInput): PresentedContent {
  // `includeSystem` counts the other way round from the rest: the page hides system
  // workloads by DEFAULT, so a section is filtered unless that toggle is on.
  const filtered =
    input.hasSearch || Boolean(input.kindFilter) || input.hideEmpty || !input.includeSystem;
  const sections = input.sections.slice(0, MAX_SECTIONS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Projects',
    observations: keep([
      valueObservation('flui.project_workloads.projects', input.projectCount, 'api'),
      valueObservation('flui.project_workloads.sections_shown', sections.length, 'derived'),
      valueObservation('flui.project_workloads.sections_total', input.sections.length, 'derived'),
      boolObservation('flui.project_workloads.searching', input.hasSearch, 'ui'),
      textObservation('flui.project_workloads.filter_kind', input.kindFilter || null, 'ui'),
      boolObservation('flui.project_workloads.include_system', input.includeSystem, 'ui'),
      boolObservation('flui.project_workloads.hide_empty', input.hideEmpty, 'ui'),
      boolObservation('flui.project_workloads.refreshing', input.isRefreshing, 'ui'),
      boolObservation('flui.project_workloads.can_manage', input.canManage, 'api'),
    ]),
    state: { loading: input.isLoading, empty: input.sections.length === 0 },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];
  for (const section of sections) scopes.push(...sectionScopes(section, filtered));

  let attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  if (input.createOpen) {
    scopes.push({ id: CREATE_ID, parentId: PAGE_ID, kind: 'form', label: 'New project' });
    attention = [{ scopeId: CREATE_ID, reason: 'active-view' }];
  }

  if (input.editing) {
    const ref = projectEntityRef(input.editing.id);
    scopes.push({
      id: EDIT_ID,
      parentId: PAGE_ID,
      kind: 'form',
      label: 'Edit project',
      entities: [{ ref, label: input.editing.name, role: 'selected' }],
    });
    attention = [{ scopeId: EDIT_ID, entityRef: ref, reason: 'selection' }];
  }

  if (input.pendingAppDelete) {
    const ref = applicationEntityRef(input.pendingAppDelete.id);
    scopes.push({
      id: APP_DELETE_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Delete workload',
      entities: [{ ref, label: input.pendingAppDelete.name, role: 'selected' }],
    });
    attention = [{ scopeId: APP_DELETE_ID, entityRef: ref, reason: 'overlay' }];
  }

  // Last on purpose: the project dialog outranks the workload one — see above.
  if (input.pendingProjectDelete) {
    const ref = projectEntityRef(input.pendingProjectDelete.id);
    scopes.push({
      id: PROJECT_DELETE_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Delete project',
      entities: [{ ref, label: input.pendingProjectDelete.name, role: 'selected' }],
    });
    attention = [{ scopeId: PROJECT_DELETE_ID, entityRef: ref, reason: 'overlay' }];
  }

  return { scopes, attention };
}

export function buildProjectWorkloadsSurface(
  input: ProjectWorkloadsSurfaceInput,
  context: ProjectWorkloadsSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated =
    input.sections.length > MAX_SECTIONS ||
    content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'apps/projects',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class ProjectWorkloadsSurfaceRevision {
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
