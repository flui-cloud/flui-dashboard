import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'deploy-wizard';

export type DeployFlowSubtype = 'image' | 'template' | 'existing-repo' | 'marketplace' | null;

export interface DeployWizardSurfaceInput {
  currentStepId: string;
  /** `currentStep()?.title` — the same human label the stepper itself renders. */
  currentStepTitle: string | null;
  sourceType: 'docker_image' | 'git_build' | null;
  flowSubtype: DeployFlowSubtype;
  /** Set once a discrete pick is made (clicked from a list), never while its own step is
   * mid-edit as free text — see the file-level note below on what is deliberately excluded. */
  selectedCluster: { id: string; name: string } | null;
  selectedRepositoryFullName: string | null;
  selectedTemplate: { framework: string; displayName: string } | null;
}

export interface DeployWizardSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function pageObservations(input: DeployWizardSurfaceInput): Observation[] {
  const observations: (Observation | null)[] = [
    textObservation('flui.deploy.source_type', input.sourceType, 'ui'),
    textObservation('flui.deploy.flow', input.flowSubtype, 'ui'),
    textObservation('flui.deploy.cluster', input.selectedCluster?.name, 'ui'),
  ];
  // Repository/template identity only makes sense for the flow that actually picked one —
  // a leftover pick from a flow the user has since switched away from is not what is
  // currently being deployed (`selectFlow()` resets these signals on switch anyway, but the
  // producer does not rely on that: it gates on the active flow explicitly).
  if (input.flowSubtype === 'existing-repo') {
    observations.push(textObservation('flui.deploy.repository', input.selectedRepositoryFullName, 'ui'));
  }
  if (input.flowSubtype === 'template') {
    observations.push(textObservation('flui.deploy.template', input.selectedTemplate?.displayName, 'ui'));
  }
  return observations.filter((observation): observation is Observation => observation !== null);
}

function titleCase(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function stepScope(step: string, label: string | null): SemanticScopeSnapshot {
  const observation = textObservation('flui.deploy.active_step', step, 'ui');
  return {
    id: `${PAGE_ID}:step:${step}`,
    parentId: PAGE_ID,
    kind: 'region',
    label: label ?? titleCase(step),
    ...(observation ? { observations: [observation] } : {}),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope.
 *
 * A multi-step creation flow — genuinely different from every other page built so far
 * (§11 of the playbook): there is no existing domain entity to point `attention` at (the
 * app being deployed does not exist until the wizard finishes), so `attention` names only
 * the page/step, `reason: 'route'`, and no `entityRef` is ever set here.
 *
 * What IS modeled: which step the user is on (a child region scope, the exact technique
 * `application-surface.ts` uses for the active tab) and what has already been committed by
 * a discrete click — the flow chosen on the Source step, the target cluster, and (for the
 * flow that actually uses it) the picked repository or template. These are all clicks on a
 * card/list-item, not typed text, so — unlike a form value — they are safe to present the
 * moment they are made, not gated on "having moved past that step" (mirrors how the
 * Fleet/Applications-list producers present a `<select>` filter unconditionally once set).
 *
 * What is deliberately NOT modeled, per the playbook's own instruction for this page:
 *  - the application name, docker image ref, and any other free-text field the user is
 *    still typing — not yet committed/presented content, and volatile on every keystroke;
 *  - environment variable NAMES or VALUES, anywhere in the env-vars step — named explicitly
 *    as a redaction risk for this page, and excluded even in a form the producer never
 *    reaches (there is simply no input field carrying them here);
 *  - the repository's URL/clone URL (only its `fullName`, already a public, non-secret
 *    "owner/repo" label, is presented — same choice as repositories-list-surface.ts, for
 *    the same repo, under the same ref grammar, kept consistent across the two pages);
 *  - the marketplace flow's own selection, and the branch picked inside the existing-repo
 *    flow — left out to keep this producer's footprint to what the brief's own example
 *    names ("the user is on the runtime-config step, source is a git repo, target cluster
 *    X"), not an exhaustive mirror of every wizard field.
 */
export function presentedContent(input: DeployWizardSurfaceInput): PresentedContent | null {
  // Nothing to present before the stepper itself has resolved a step id (the very first
  // tick, before the component's own `steps()` computed has a value) — no invented state.
  if (!input.currentStepId) return null;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Deploy New Application',
    observations: pageObservations(input),
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, stepScope(input.currentStepId, input.currentStepTitle)];
  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes, attention };
}

export function buildDeployWizardSurface(
  input: DeployWizardSurfaceInput,
  context: DeployWizardSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'deploy-wizard',
      route: 'apps/deploy/new',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/**
 * Revision moves only when presented content moves — see application-surface.ts's
 * `ApplicationSurfaceRevision` for the full rationale.
 */
export class DeployWizardSurfaceRevision {
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
