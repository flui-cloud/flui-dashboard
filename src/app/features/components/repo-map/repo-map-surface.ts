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
import { applicationEntityRef } from '../application/application-surface';
import { repositoryEntityRef } from '../application/repositories-list-surface';
import type { AppliedUnit, StrandedApplication } from '../../service/repo-map.service';

const PAGE_ID = 'repo-map';
const CONTROLS_ID = `${PAGE_ID}:controls`;
const VERDICT_ID = `${PAGE_ID}:verdict`;
const NEEDED_ID = `${PAGE_ID}:needed`;
const OBSTACLES_ID = `${PAGE_ID}:obstacles`;
const QUESTIONS_ID = `${PAGE_ID}:questions`;
const UNITS_ID = `${PAGE_ID}:units`;
const SERVICES_ID = `${PAGE_ID}:services`;
const APPLY_ID = `${PAGE_ID}:apply`;
const APPLIED_UNITS_ID = `${APPLY_ID}:units`;
const REFUSAL_ID = `${PAGE_ID}:refusal`;
const STRANDED_ID = `${REFUSAL_ID}:applications`;

/** One row of "What would run" — a unit the engine found, as the page draws it. */
export interface RepoMapUnitRow {
  /** The unit directory (`.` for the repository root); already display-named by the page. */
  id: string;
  name: string;
  buildStrategy: string;
  port: number | null;
  readiness: string;
  /** The page's "not in the flui.yaml" marker: the render skipped this unit. */
  skipped: boolean;
}

/** One row of the same section, below the units: a service the repository declares. */
export interface RepoMapServiceRow {
  name: string;
  /** The catalog block that would be installed, or null — the page then says "no block". */
  block: string | null;
}

/** One entry of "In the way", as the card shows it: a sentence, an optional fix, an optional
 * unit. Only the presence of those is carried here — see {@link presentedContent}. */
export interface RepoMapObstacleRow {
  hasRemedy: boolean;
  unit: string;
}

export interface RepoMapCapacity {
  assessed: boolean;
  notAssessedReason: string | null;
  known: boolean;
  fits?: boolean;
  requiredCpuMillicores?: number;
  requiredMemoryMebibytes?: number;
  availableCpuMillicores?: number;
  availableMemoryMebibytes?: number;
  uncountedCount: number;
}

/**
 * What the Deployment Readiness page has on screen.
 *
 * Anti-drift (playbook §5): every field here is one the component already computes to draw
 * the page — `outcomeLabel()`, `needed()`, `obstacles()`, `questions()`, `renderedUnits()`,
 * `applyBlockedReason()` and friends — never a second read of the map response. The counts
 * below are counts OF those same computeds, taken at the call site, so a filter or a
 * first-sentence trim the page applies is inherited here instead of being re-derived.
 */
export interface RepoMapSurfaceInput {
  /** From the route. Empty means there is no repository to name at all — no snapshot. */
  repositoryId: string;
  /** `owner/repo`, when the repositories list has loaded. The page falls back to a generic
   * heading when it has not, and so does this producer: never an invented name. */
  repoFullName?: string;

  branchInput: string;
  branchOptionCount: number;
  /** The provider would not list branches; the page falls back to a free-text field. */
  branchListingFailed: boolean;
  clusterIdInput: string;
  clusterName?: string;
  hasRun: boolean;

  loading: boolean;
  /** The call itself failed (network, 4xx/5xx before the engine ran) — the red banner at the
   * top of the page. The message is deliberately NOT carried: backend prose never enters. */
  hasLoadError: boolean;

  /** Null until the first map comes back — the page then shows only the controls. */
  read: {
    branch: string;
    ok: boolean;
    /** A closed code (`no-credential`, `not-found`, `too-large`, `unreadable`, `rejected`), the
     * one the "could not be read" card prints verbatim. */
    reason?: string;
    commitShortSha?: string;
  } | null;

  /** Everything below the verdict card. Null whenever the repository could not be read: the
   * page draws the red "could not be read" card instead, and nothing else. */
  assessment: {
    coverage?: string;
    outcome: string;
    /** The page's own wording for that outcome, the headline of the verdict card. */
    outcomeLabel: string;
    unitsReady: number;
    unitsPendingInputs: number;
    unitsBlocked: number;
    unitsNotAssessed: number;
    capacity: RepoMapCapacity;
    neededCount: number;
    neededSecretCount: number;
    neededBlocksStartCount: number;
    externalCount: number;
    obstacles: RepoMapObstacleRow[];
    questionCount: number;
    questionsWithOptionsCount: number;
    units: RepoMapUnitRow[];
    services: RepoMapServiceRow[];
    renderedUnitCount: number;
    caveatCount: number;
  } | null;

  /** The disclosure panels that actually put content on the screen. */
  yamlExpanded: boolean;
  rawMapExpanded: boolean;

  applying: boolean;
  /** Empty when the deploy button is live. One of a closed set of sentences this dashboard
   * writes itself — see {@link presentedContent} for why this one string is carried. */
  applyBlockedReason: string;

  applied: {
    partial: boolean;
    branch: string;
    commitShortSha: string;
    baseBranch: string;
    fileCount: number;
    skippedCount: number;
    units: AppliedUnit[];
    unmarkedCount: number;
  } | null;

  refusal: {
    status: number;
    stranded: {
      branchDeleted: boolean;
      committed: boolean;
      /** Absent is not `false`: the backend simply did not say. */
      markedForReuse?: boolean;
      applications: StrandedApplication[];
    } | null;
  } | null;
}

export interface RepoMapSurfaceContext {
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

function unitRow(unit: RepoMapUnitRow): SurfaceListRow {
  return {
    id: `${UNITS_ID}:${scopeIdPart(unit.id)}`,
    // No `ref`: a unit is not a Flui entity. It becomes an application only when an apply
    // runs, and the applied units below DO carry `flui://application/<id>` for exactly that
    // reason. Minting a ref here would let "deploy this one" resolve onto something no tool
    // can address (playbook §4, fifth case).
    label: unit.name,
    observations: keep([
      textObservation('flui.repo_map.unit_build_strategy', unit.buildStrategy, 'api'),
      unit.port === null ? null : valueObservation('flui.repo_map.unit_port', unit.port, 'api'),
      textObservation('flui.repo_map.unit_readiness', unit.readiness, 'api'),
      boolObservation('flui.repo_map.unit_not_rendered', unit.skipped, 'derived'),
    ]),
  };
}

function serviceRow(service: RepoMapServiceRow, index: number): SurfaceListRow {
  return {
    id: `${SERVICES_ID}:${index}:${scopeIdPart(service.name)}`,
    label: service.name,
    observations: keep([
      // The catalog block the page prints beside the name, or the absence the page prints
      // instead ("no block"). Not a `flui://catalog-app/...` entity: nothing is installed yet,
      // and this is a match the engine proposes, not a resource that exists.
      textObservation('flui.repo_map.service_block', service.block, 'api'),
      boolObservation('flui.repo_map.service_has_block', Boolean(service.block), 'derived'),
    ]),
  };
}

function appliedUnitRow(unit: AppliedUnit): SurfaceListRow {
  return {
    id: `${APPLIED_UNITS_ID}:${scopeIdPart(unit.unitId)}`,
    ref: applicationEntityRef(unit.applicationId),
    label: unit.name,
    observations: keep([
      textObservation('flui.repo_map.applied_unit_slug', unit.slug, 'api'),
      boolObservation('flui.repo_map.applied_unit_armed', unit.armed, 'api'),
      // The one thing on this screen that costs money if it is missed: an unarmed unit that
      // could not even be marked for reuse. `reason` — the backend's own sentence beside it —
      // stays out; that this application is in that state is the fact, not its prose.
      unit.markedForReuse === false
        ? boolObservation('flui.repo_map.applied_unit_unmarked', true, 'api')
        : null,
    ]),
  };
}

function strandedRow(app: StrandedApplication): SurfaceListRow {
  return {
    id: `${STRANDED_ID}:${scopeIdPart(app.applicationId)}`,
    ref: applicationEntityRef(app.applicationId),
    label: app.name,
    observations: keep([
      textObservation('flui.repo_map.stranded_slug', app.slug, 'api'),
      valueObservation('flui.repo_map.stranded_attached_count', app.attachedServices.length, 'derived'),
    ]),
  };
}

function capacityObservations(capacity: RepoMapCapacity): Observation[] {
  const base = [
    boolObservation('flui.repo_map.capacity_assessed', capacity.assessed, 'api'),
    textObservation('flui.repo_map.capacity_not_assessed_reason', capacity.notAssessedReason, 'api'),
  ];
  if (!capacity.assessed || !capacity.known) return keep(base);
  return keep([
    ...base,
    capacity.fits === undefined ? null : boolObservation('flui.repo_map.capacity_fits', capacity.fits, 'api'),
    capacity.requiredCpuMillicores === undefined
      ? null
      : valueObservation('flui.repo_map.capacity_required_cpu', capacity.requiredCpuMillicores, 'api', 'm'),
    capacity.requiredMemoryMebibytes === undefined
      ? null
      : valueObservation('flui.repo_map.capacity_required_memory', capacity.requiredMemoryMebibytes, 'api', 'MiB'),
    capacity.availableCpuMillicores === undefined
      ? null
      : valueObservation('flui.repo_map.capacity_available_cpu', capacity.availableCpuMillicores, 'api', 'm'),
    capacity.availableMemoryMebibytes === undefined
      ? null
      : valueObservation('flui.repo_map.capacity_available_memory', capacity.availableMemoryMebibytes, 'api', 'MiB'),
    // A fit computed with parts left out is not a fit, and the page says so in words. The
    // count is what makes that qualification survive into the snapshot.
    valueObservation('flui.repo_map.capacity_uncounted', capacity.uncountedCount, 'api'),
  ]);
}

/**
 * Everything the Deployment Readiness page would present, without the revision/timestamp
 * envelope.
 *
 * The pattern is the detail page of §4: one real entity at the centre — the repository the
 * route names — held in `attention` with `reason: 'route'` for the whole life of the page.
 * There is no selection here and no overlay: every panel is a region of the one page, and the
 * apply result, loud as its red border is, is not something the user picked. Inventing a
 * selection to point at it would be exactly the move §4 forbids.
 *
 * What deliberately stays OUT, and why — this page is mostly engine prose, and a producer
 * that shovelled it in would be the "dump of API responses" of spec §1.3:
 *  - the rendered flui.yaml and the raw map JSON: a dump by definition. That the panels are
 *    open is a UI fact and is carried; their content is not.
 *  - every free-text sentence the engine writes — blocker summaries and remedies, question
 *    text, option chips, caveats, the verdict's own `reason`, the apply refusal's message,
 *    an unarmed unit's `reason`. Counts and the structured facts beside them carry what the
 *    reader can act on without carrying backend text into a model's prompt.
 *  - the names of required inputs and of the keys an external dependency wants: those are
 *    environment variable names, which §7's redaction checklist names outright. Their counts
 *    go, split by the two tags the page itself shows (secret, needed to start).
 *
 * One prose string IS carried, `flui.repo_map.apply_blocked_reason`, and it is the exception
 * that proves the rule: it is written by this dashboard, not by the backend or the engine,
 * comes from a closed set of five sentences in `applyBlockedReason()`, and is the single most
 * actionable line on the page — the amber sentence under a greyed-out deploy button saying
 * why it is grey. It carries no repository content.
 */
export function presentedContent(input: RepoMapSurfaceInput): PresentedContent {
  if (!input.repositoryId) return { scopes: [], attention: [] };

  const ref = repositoryEntityRef(input.repositoryId);
  const read = input.read;
  const assessment = read?.ok ? input.assessment : null;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: input.repoFullName ?? 'Deploy readiness',
    entities: [{ ref, ...(input.repoFullName ? { label: input.repoFullName } : {}), role: 'primary' }],
    observations: keep([
      textObservation('flui.repo_map.commit', read?.commitShortSha, 'api'),
      read ? boolObservation('flui.repo_map.read_ok', read.ok, 'api') : null,
      read && !read.ok ? textObservation('flui.repo_map.read_refusal', read.reason ?? 'unknown', 'api') : null,
      assessment ? textObservation('flui.repo_map.coverage', assessment.coverage, 'api') : null,
      assessment ? valueObservation('flui.repo_map.caveats', assessment.caveatCount, 'api') : null,
      boolObservation('flui.repo_map.yaml_shown', input.yamlExpanded, 'ui'),
      boolObservation('flui.repo_map.raw_map_shown', input.rawMapExpanded, 'ui'),
    ]),
    state: {
      loading: input.loading,
      // The view failed to load — the red banner at the top. A map that came back saying the
      // repository could not be READ is not this: that is a complete answer from the engine,
      // and it lives in `flui.repo_map.read_ok`/`read_refusal` (playbook §6 point 2).
      ...(input.hasLoadError ? { error: true, errorCode: 'flui.repo_map.unreachable' } : {}),
    },
  };

  const controlsScope: SemanticScopeSnapshot = {
    id: CONTROLS_ID,
    parentId: PAGE_ID,
    kind: 'form',
    label: 'Branch and cluster',
    ...(input.clusterIdInput
      ? {
          entities: [
            {
              ref: clusterEntityRef(input.clusterIdInput),
              ...(input.clusterName ? { label: input.clusterName } : {}),
              role: 'related' as const,
            },
          ],
        }
      : {}),
    observations: keep([
      textObservation('flui.repo_map.branch', input.branchInput, 'ui'),
      valueObservation('flui.repo_map.branch_options', input.branchOptionCount, 'api'),
      boolObservation('flui.repo_map.branch_listing_failed', input.branchListingFailed, 'api'),
      boolObservation('flui.repo_map.cluster_chosen', Boolean(input.clusterIdInput), 'ui'),
      boolObservation('flui.repo_map.has_run', input.hasRun, 'ui'),
    ]),
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, controlsScope];

  if (assessment) {
    scopes.push({
      id: VERDICT_ID,
      parentId: PAGE_ID,
      kind: 'region',
      label: assessment.outcomeLabel,
      observations: keep([
        textObservation('flui.repo_map.outcome', assessment.outcome, 'api'),
        valueObservation('flui.repo_map.units_ready', assessment.unitsReady, 'derived'),
        valueObservation('flui.repo_map.units_pending_inputs', assessment.unitsPendingInputs, 'derived'),
        valueObservation('flui.repo_map.units_blocked', assessment.unitsBlocked, 'derived'),
        valueObservation('flui.repo_map.units_not_assessed', assessment.unitsNotAssessed, 'derived'),
        ...capacityObservations(assessment.capacity),
      ]),
    });

    // "What you need to provide" is drawn even when there is nothing — it says so — so this
    // scope is always here, with `empty` telling the two apart.
    scopes.push({
      id: NEEDED_ID,
      parentId: PAGE_ID,
      kind: 'region',
      label: 'What you need to provide',
      observations: [
        valueObservation('flui.repo_map.needed', assessment.neededCount, 'derived'),
        valueObservation('flui.repo_map.needed_secret', assessment.neededSecretCount, 'derived'),
        valueObservation('flui.repo_map.needed_blocks_start', assessment.neededBlocksStartCount, 'derived'),
        valueObservation('flui.repo_map.externals', assessment.externalCount, 'derived'),
      ],
      state: { empty: assessment.neededCount === 0 },
    });

    // The next two sections are not rendered at all when empty — "an inactive scope never
    // appears" (schema), so they are omitted rather than emitted with `empty: true`.
    if (assessment.obstacles.length > 0) {
      const { scopes: obstacleScopes } = buildSurfaceList({
        listId: OBSTACLES_ID,
        parentId: PAGE_ID,
        label: 'In the way',
        totalCount: assessment.obstacles.length,
        rows: assessment.obstacles.map((obstacle, index) => ({
          id: `${OBSTACLES_ID}:${index}`,
          observations: keep([
            textObservation('flui.repo_map.obstacle_unit', obstacle.unit, 'api'),
            boolObservation('flui.repo_map.obstacle_has_remedy', obstacle.hasRemedy, 'derived'),
          ]),
        })),
      });
      scopes.push(...obstacleScopes);
    }

    if (assessment.questionCount > 0) {
      scopes.push({
        id: QUESTIONS_ID,
        parentId: PAGE_ID,
        kind: 'region',
        label: 'We could not tell',
        observations: [
          valueObservation('flui.repo_map.questions', assessment.questionCount, 'derived'),
          valueObservation('flui.repo_map.questions_with_options', assessment.questionsWithOptionsCount, 'derived'),
        ],
      });
    }

    const { scopes: unitScopes } = buildSurfaceList({
      listId: UNITS_ID,
      parentId: PAGE_ID,
      label: 'What would run',
      totalCount: assessment.units.length,
      rows: assessment.units.map(unitRow),
      listObservations: [valueObservation('flui.repo_map.rendered_units', assessment.renderedUnitCount, 'api')],
    });
    unitScopes[0] = { ...unitScopes[0], state: { loading: false, empty: assessment.units.length === 0 } };
    scopes.push(...unitScopes);

    if (assessment.services.length > 0) {
      const { scopes: serviceScopes } = buildSurfaceList({
        listId: SERVICES_ID,
        parentId: PAGE_ID,
        label: 'Services',
        totalCount: assessment.services.length,
        rows: assessment.services.map(serviceRow),
      });
      scopes.push(...serviceScopes);
    }
  }

  // The apply section, the refusal card and everything under them live inside the branch the
  // page only draws when the repository was read: a map that could not be read shows the red
  // "could not be read" card and nothing else.
  if (assessment) {
    const applied = input.applied;
    scopes.push({
      id: APPLY_ID,
      parentId: PAGE_ID,
      kind: 'region',
      label: applied ? (applied.partial ? 'Applied, but not everything was armed' : 'Applied') : 'Deploy from this map',
      observations: keep([
        boolObservation('flui.repo_map.applying', input.applying, 'ui'),
        boolObservation('flui.repo_map.applied', Boolean(applied), 'ui'),
        !applied && input.applyBlockedReason
          ? textObservation('flui.repo_map.apply_blocked_reason', input.applyBlockedReason, 'ui')
          : null,
        applied ? boolObservation('flui.repo_map.apply_partial', applied.partial, 'api') : null,
        applied ? textObservation('flui.repo_map.apply_branch', applied.branch, 'api') : null,
        applied ? textObservation('flui.repo_map.apply_commit', applied.commitShortSha, 'api') : null,
        applied ? textObservation('flui.repo_map.apply_base_branch', applied.baseBranch, 'api') : null,
        applied ? valueObservation('flui.repo_map.apply_files', applied.fileCount, 'api') : null,
        applied ? valueObservation('flui.repo_map.apply_skipped', applied.skippedCount, 'api') : null,
        applied ? valueObservation('flui.repo_map.apply_unmarked', applied.unmarkedCount, 'derived') : null,
      ]),
    });

    if (applied && applied.units.length > 0) {
      const { scopes: appliedScopes } = buildSurfaceList({
        listId: APPLIED_UNITS_ID,
        parentId: APPLY_ID,
        label: 'Applications created',
        totalCount: applied.units.length,
        rows: applied.units.map(appliedUnitRow),
      });
      scopes.push(...appliedScopes);
    }

    if (input.refusal) {
      const stranded = input.refusal.stranded;
      scopes.push({
        id: REFUSAL_ID,
        parentId: APPLY_ID,
        kind: 'region',
        label: stranded ? 'The apply failed and left something behind' : 'The apply was refused',
        observations: keep([
          valueObservation('flui.repo_map.refusal_status', input.refusal.status, 'api'),
          boolObservation('flui.repo_map.refusal_left_applications', Boolean(stranded), 'api'),
          stranded ? boolObservation('flui.repo_map.refusal_branch_deleted', stranded.branchDeleted, 'api') : null,
          stranded ? boolObservation('flui.repo_map.refusal_committed', stranded.committed, 'api') : null,
          // Three states, not two, exactly as the service reads it: absent means the backend did
          // not say, and saying `false` for it here would put a warning on the screen's own
          // wording that the screen never showed.
          stranded && stranded.markedForReuse !== undefined
            ? boolObservation('flui.repo_map.refusal_marked_for_reuse', stranded.markedForReuse, 'api')
            : null,
        ]),
        // The refusal IS the view failing to do what it was asked, and it carries a code rather
        // than the backend's sentence.
        state: { error: true, errorCode: stranded ? 'flui.repo_map.apply_left_applications' : 'flui.repo_map.apply_refused' },
      });

      if (stranded && stranded.applications.length > 0) {
        const { scopes: strandedScopes } = buildSurfaceList({
          listId: STRANDED_ID,
          parentId: REFUSAL_ID,
          label: 'Left behind',
          totalCount: stranded.applications.length,
          rows: stranded.applications.map(strandedRow),
        });
        scopes.push(...strandedScopes);
      }
    }
  }

  return {
    scopes,
    attention: [{ scopeId: PAGE_ID, entityRef: ref, reason: 'route' }],
  };
}

export function buildRepoMapSurface(
  input: RepoMapSurfaceInput,
  context: RepoMapSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  // No repository named by the route means no entity to be looking at — no snapshot, rather
  // than an empty one (playbook §8).
  if (content.scopes.length === 0) return null;
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: `apps/repositories/${input.repositoryId}/map`,
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class RepoMapSurfaceRevision {
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
