import { Provider } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { EnvSuggestionsPanelComponent } from './env-suggestions-panel.component';
import { CatalogOverviewStepComponent } from './deploy-wizard-catalog-steps/catalog-overview-step.component';
import { CatalogInputsStepComponent } from './deploy-wizard-catalog-steps/catalog-inputs-step.component';
import { CatalogConfigStepComponent } from './deploy-wizard-catalog-steps/catalog-config-step.component';
import { CatalogDomainStepComponent } from './deploy-wizard-catalog-steps/catalog-domain-step.component';
import { CatalogFeaturesStepComponent } from './deploy-wizard-catalog-steps/catalog-features-step.component';
import { CatalogLinkedBbStepComponent } from './deploy-wizard-catalog-steps/catalog-linked-bb-step.component';
import { CatalogDependenciesStepComponent } from './deploy-wizard-catalog-steps/catalog-dependencies-step.component';
import { CatalogUdpPortsNoticeComponent } from './deploy-wizard-catalog-steps/catalog-udp-ports-notice.component';
import { CatalogResourcesReviewComponent } from './deploy-wizard-catalog-steps/catalog-resources-review.component';
import { DeployStepAnalysis } from './deploy-step-analysis';
import { DeployStepDockerImage } from './deploy-step-docker-image';
import { DeployStepGenerate } from './deploy-step-generate';
import { DeployStepRepository } from './deploy-step-repository';
import { DeployStepSource } from './deploy-step-source';
import { DeployStepTemplatePicker } from './deploy-step-template-picker';
import { DeployStepTemplateSettings } from './deploy-step-template-settings';
import { DeployStepEnvironment } from './deploy-step-environment';
import { DeployEnvHealthCheck } from './deploy-env-health-check';
import { DeployEnvVars } from './deploy-env-vars';
import { DeployStepCluster } from './deploy-step-cluster';
import { DeployStepReview } from './deploy-step-review';
import { DeployReviewSource } from './deploy-review-source';
import { DeployReviewMarketplace } from './deploy-review-marketplace';
import { DEPLOY_WIZARD_ICONS } from './deploy-wizard-icons';
import { DeployWizardForm } from './deploy-wizard.state';
import { DeployWizardEnv } from './deploy-wizard-env';
import { DeployWizardRepository } from './deploy-wizard-repository';
import { DeployWizardImage } from './deploy-wizard-image';
import { DeployWizardCluster } from './deploy-wizard-cluster';
import { DeployWizardReview } from './deploy-wizard-review';
import { DeployWizardDeploy } from './deploy-wizard-deploy';
import { DeployWizardNavigation } from './deploy-wizard-navigation';
import { DeployWizardSurfaceFeed } from './deploy-wizard-surface-feed';

export const DEPLOY_WIZARD_STEP_COMPONENTS = [
  EnvSuggestionsPanelComponent,
  CatalogOverviewStepComponent,
  CatalogInputsStepComponent,
  CatalogConfigStepComponent,
  CatalogDomainStepComponent,
  CatalogFeaturesStepComponent,
  CatalogLinkedBbStepComponent,
  CatalogDependenciesStepComponent,
  CatalogUdpPortsNoticeComponent,
  CatalogResourcesReviewComponent,
  DeployStepAnalysis,
  DeployStepDockerImage,
  DeployStepGenerate,
  DeployStepRepository,
  DeployStepSource,
  DeployStepTemplatePicker,
  DeployStepTemplateSettings,
  DeployStepEnvironment,
  DeployEnvHealthCheck,
  DeployEnvVars,
  DeployStepCluster,
  DeployStepReview,
  DeployReviewSource,
  DeployReviewMarketplace,
] as const;

export const DEPLOY_WIZARD_PROVIDERS: Provider[] = [
  DeployWizardStateService,
  DeployWizardForm,
  DeployWizardEnv,
  DeployWizardRepository,
  DeployWizardImage,
  DeployWizardCluster,
  DeployWizardReview,
  DeployWizardDeploy,
  DeployWizardNavigation,
  DeployWizardSurfaceFeed,
  provideIcons(DEPLOY_WIZARD_ICONS),
];
