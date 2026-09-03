import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { SetupMethod } from '../../service/github-setup-wizard.service';
import type { GitHubSetupStatusResponseDto } from '../../../core/api/model/gitHubSetupStatusResponseDto';
import type { PatValidationResultDto } from '../../../core/api/model/patValidationResultDto';

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'github-setup-wizard';

const STEP_TITLES = ['Choose Method', 'Configure', 'Done'] as const;
const STEP_IDS = ['method', 'configure', 'done'] as const;

/**
 * A system-wide configuration wizard, not a domain entity — like the GitHub App/PAT
 * setup being configured, there is no `id` to hold a `ref` to (§5 requires a stable
 * domain identifier; "the GitHub integration" is a singleton, not an instance). So,
 * same as backup-overview-surface.ts, attention names only the page.
 *
 * The wizard's own draft form values (`githubAppForm`/`manifestForm`/`patForm` —
 * private key PEM, webhook secret, classic PAT token, App name/URL still being typed)
 * are never read by this producer at all: same exclusion as the deploy wizard's own
 * in-progress fields, because they are exactly that — a draft the user has not
 * committed, and several of them are outright credentials.
 */
export interface GithubSetupWizardSurfaceInput {
  currentStepIndex: number;
  selectedMethod: SetupMethod;
  manualMode: boolean;
  configuredStatus: GitHubSetupStatusResponseDto | null;
  patValidation: PatValidationResultDto | null;
  hasError: boolean;
}

export interface GithubSetupWizardSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number | boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(input: GithubSetupWizardSurfaceInput): Observation[] {
  const configured = input.configuredStatus;
  return [
    valueObservation('flui.github_setup.configured', !!configured?.configured, 'api'),
    configured?.configured ? textObservation('flui.github_setup.existing_auth_method', configured.authMethod, 'api') : null,
    configured?.appSlug ? textObservation('flui.github_setup.existing_app_slug', configured.appSlug, 'api') : null,
    textObservation('flui.github_setup.selected_method', input.selectedMethod, 'ui'),
    input.hasError ? valueObservation('flui.github_setup.has_error', true, 'ui') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function stepObservations(input: GithubSetupWizardSurfaceInput): Observation[] {
  if (STEP_IDS[input.currentStepIndex] !== 'configure') return [];
  if (input.selectedMethod === 'github_app') {
    return [valueObservation('flui.github_setup.manual_mode', input.manualMode, 'ui')];
  }
  if (input.selectedMethod === 'pat' && input.patValidation) {
    const v = input.patValidation;
    return [
      valueObservation('flui.github_setup.pat_validated', v.valid, 'derived'),
      v.valid ? textObservation('flui.github_setup.pat_login', v.login, 'api') : null,
      v.missingScopes?.length
        ? valueObservation('flui.github_setup.pat_missing_scopes_count', v.missingScopes.length, 'api')
        : null,
    ].filter((observation): observation is Observation => observation !== null);
  }
  return [];
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: GithubSetupWizardSurfaceInput): PresentedContent {
  const stepId = STEP_IDS[input.currentStepIndex] ?? 'method';
  const stepTitle = STEP_TITLES[input.currentStepIndex] ?? 'Choose Method';

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'GitHub Integration Setup',
    observations: pageObservations(input),
  };

  const stepObs = stepObservations(input);
  const stepScope: SemanticScopeSnapshot = {
    id: `${PAGE_ID}:step:${stepId}`,
    parentId: PAGE_ID,
    kind: 'region',
    label: stepTitle,
    ...(stepObs.length ? { observations: stepObs } : {}),
  };

  return {
    scopes: [pageScope, stepScope],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildGithubSetupWizardSurface(
  input: GithubSetupWizardSurfaceInput,
  context: GithubSetupWizardSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'apps/repositories/github-setup',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class GithubSetupWizardSurfaceRevision {
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

