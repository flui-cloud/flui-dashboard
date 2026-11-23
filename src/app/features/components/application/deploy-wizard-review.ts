import { Injectable, computed, inject } from '@angular/core';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { CatalogService } from '../../service/catalog.service';
import { stripHyphenEdges } from '../../../shared/utils/slug';
import { catalogAuthLabel } from './deploy-wizard-catalog-steps/catalog-features-step.component';
import { catalogOptionEnabled } from './deploy-wizard-catalog-steps/catalog-options';
import { DeployWizardForm } from './deploy-wizard.state';

@Injectable()
export class DeployWizardReview {
  private readonly form = inject(DeployWizardForm);
  private readonly state = inject(DeployWizardStateService);
  private readonly catalog = inject(CatalogService);

  readonly autoFqdnPreview = computed(() => {
    const caps = this.catalog.capabilities();
    const slug = this.state.catalogDetail()?.slug ?? 'your-app';
    const template = caps?.autoFqdnTemplate;
    if (template?.includes('{install-slug}')) {
      return template.replace('{install-slug}', `${slug}-xxxx`);
    }
    const zone = caps?.zoneName;
    return zone ? `${slug}-xxxx.${zone}` : `${slug}-xxxx`;
  });

  readonly internalUrlPreview = computed<string | null>(() => {
    const template = this.catalog.capabilities()?.internalHostTemplate;
    if (!template) return null;
    const rawName = this.getApplicationName();
    const slug = stripHyphenEdges(rawName.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-')) || 'app';
    return 'https://' + template.replace('{slug}', slug);
  });

  readonly catalogAuthModeLabel = computed<string | null>(() => {
    const mode = this.state.catalogAuthMode();
    return mode ? catalogAuthLabel(mode) : null;
  });

  readonly enabledFeatureLabels = computed<string[]>(() =>
    this.state
      .catalogFeatureOptions()
      .filter((o) =>
        catalogOptionEnabled(
          this.state.catalogFeatureOptions(),
          this.state.catalogFeatureToggles(),
          o.key,
        ),
      )
      .map((o) => o.label),
  );

  getApplicationName(): string {
    const f = this.form;
    if (f.flowSubtype() === 'marketplace') {
      return this.state.catalogDisplayName() || this.state.catalogDetail()?.name || 'app';
    }
    if (f.sourceType() === 'docker_image') {
      const ref = f.selectedImageRef();
      return ref.split(':')[0].split('/').pop() || 'app';
    }
    const branch = f.selectedBranch();
    const repo = f.selectedRepo();
    if (repo) return `${repo.name}-${branch}`;
    const publicRepo = f.selectedPublicRepo();
    if (publicRepo) return `${publicRepo.name}-${branch}`;
    return 'app';
  }

  getCatalogInputsCount(): number {
    const inputs = this.state.userInputs();
    return Object.values(inputs).filter((v) => v && v.trim().length > 0).length;
  }

  getCatalogOverridesCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const overrides = this.state.envOverrides();
    return detail.editableEnv.filter((env) => {
      const current = overrides[env.name];
      if (current === undefined) return false;
      return current !== (env.default ?? '');
    }).length;
  }

  getCatalogSecretsCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const inputs = this.state.userInputs();
    return detail.userInputPrompts.filter((p) => p.sensitive && (inputs[p.name] ?? '').length > 0)
      .length;
  }
}
