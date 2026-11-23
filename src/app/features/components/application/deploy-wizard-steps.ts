import { WizardStepperStep } from '../../../shared/components/wizard-stepper/wizard-stepper.component';
import { FlowSubtype } from '../../service/deploy-wizard-state.service';

export interface DeployMarketplaceStepsInput {
  hasDetail: boolean;
  displayNameValid: boolean;
  hasPrompts: boolean;
  hasDefaultCredentials: boolean;
  hasEditableEnv: boolean;
  inputsValid: boolean;
  needsFeatures: boolean;
  needsDependencyPicker: boolean;
  dependenciesValid: boolean;
  needsLinkedBbPicker: boolean;
  exposesPublicEndpoint: boolean;
  internalExposure: boolean;
  domainValid: boolean;
}

export interface DeployStepsInput {
  currentIndex: number;
  flow: FlowSubtype;
  clusterSelected: boolean;
  masterPlacementBlocked: boolean;
  imageSelected: boolean;
  templateSelected: boolean;
  templateSettingsValid: boolean;
  repoSelected: boolean;
  analysisReady: boolean;
  marketplace: DeployMarketplaceStepsInput | null;
}

const REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function templateRepoNameError(value: string): string | null {
  if (!value) return null;
  if (value.length > 100) return 'Maximum 100 characters.';
  if (!REPO_NAME_PATTERN.test(value))
    return 'Only letters, numbers, dots, dashes, and underscores.';
  return null;
}

function step(id: string, title: string, icon: string, isValid: boolean): WizardStepperStep {
  return { id, title, icon, isValid, isCompleted: false };
}

function imageFlowSteps(
  input: DeployStepsInput,
  source: WizardStepperStep,
  cluster: WizardStepperStep,
  review: WizardStepperStep,
): WizardStepperStep[] {
  return [
    source,
    step('docker_image', 'Docker image', 'lucideContainer', input.imageSelected),
    step('environment', 'Configuration', 'lucideKey', true),
    cluster,
    review,
  ];
}

function templateFlowSteps(
  input: DeployStepsInput,
  source: WizardStepperStep,
  cluster: WizardStepperStep,
  review: WizardStepperStep,
): WizardStepperStep[] {
  return [
    source,
    step('template-picker', 'Template', 'lucideRocket', input.templateSelected),
    step('template-settings', 'Repo settings', 'lucideGithub', input.templateSettingsValid),
    cluster,
    step('environment', 'Env vars', 'lucideKey', true),
    review,
    step('generate', 'Deploy', 'lucidePlay', true),
  ];
}

function existingRepoFlowSteps(
  input: DeployStepsInput,
  source: WizardStepperStep,
  cluster: WizardStepperStep,
  review: WizardStepperStep,
): WizardStepperStep[] {
  return [
    source,
    step('repository', 'Repository', 'lucideGitBranch', input.repoSelected),
    step('analysis', 'Analysis', 'lucideGithub', input.analysisReady),
    cluster,
    step('environment', 'Env vars', 'lucideKey', true),
    review,
    step('generate', 'Deploy', 'lucidePlay', true),
  ];
}

function marketplaceFlowSteps(
  m: DeployMarketplaceStepsInput,
  source: WizardStepperStep,
  cluster: WizardStepperStep,
  review: WizardStepperStep,
): WizardStepperStep[] {
  const steps: WizardStepperStep[] = [
    source,
    step('catalog-overview', 'App', 'lucideStore', m.hasDetail && m.displayNameValid),
  ];
  if (m.hasPrompts || m.hasDefaultCredentials) {
    steps.push(step('catalog-inputs', 'Configuration', 'lucideKey', m.inputsValid));
  }
  if (m.hasEditableEnv) {
    steps.push(step('catalog-config', 'Settings', 'lucideSettings', true));
  }
  if (m.needsFeatures) {
    steps.push(step('catalog-features', 'Features', 'lucideSlidersHorizontal', true));
  }
  steps.push(cluster);
  if (m.needsDependencyPicker) {
    steps.push(step('catalog-dependencies', 'Dependencies', 'lucideDatabase', m.dependenciesValid));
  }
  if (m.needsLinkedBbPicker) {
    steps.push(step('catalog-linked-bb', 'Link ', 'lucideDatabase', true));
  }
  if (m.exposesPublicEndpoint && !m.internalExposure) {
    steps.push(step('catalog-domain', 'Domain', 'lucideCloud', m.domainValid));
  }
  steps.push(review, step('generate', 'Install', 'lucidePlay', true));
  return steps;
}

function flowSteps(input: DeployStepsInput): WizardStepperStep[] {
  const source = step('source', 'Source', 'lucideSettings', !!input.flow);
  const cluster = step('cluster', 'Cluster', 'lucideServer', input.clusterSelected);
  const review = step('review', 'Review', 'lucideCheck', !input.masterPlacementBlocked);
  switch (input.flow) {
    case 'image':
      return imageFlowSteps(input, source, cluster, review);
    case 'template':
      return templateFlowSteps(input, source, cluster, review);
    case 'existing-repo':
      return existingRepoFlowSteps(input, source, cluster, review);
    case 'marketplace':
      return input.marketplace
        ? marketplaceFlowSteps(input.marketplace, source, cluster, review)
        : [source];
    default:
      return [source];
  }
}

export function buildDeploySteps(input: DeployStepsInput): WizardStepperStep[] {
  return flowSteps(input).map((s, i) => ({ ...s, isCompleted: i < input.currentIndex }));
}

export function allStepsValidExceptLast(steps: WizardStepperStep[]): boolean {
  const reviewIdx = steps.length - 1;
  return steps.every((s, idx) => idx === reviewIdx || s.isValid);
}
