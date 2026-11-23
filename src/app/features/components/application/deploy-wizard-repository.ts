import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConnectedRepository, RepositoryService } from '../../service/repository.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { PlatformVersionService } from '../../service/platform-version.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import { githubCredentialProblem } from '../../../core/state/github-credential';
import { ToastService } from '../../../shared/services/toast.service';
import { DeployWizardForm } from './deploy-wizard.state';
import { DeployWizardEnv } from './deploy-wizard-env';

@Injectable()
export class DeployWizardRepository {
  private readonly form = inject(DeployWizardForm);
  private readonly env = inject(DeployWizardEnv);
  private readonly state = inject(DeployWizardStateService);
  private readonly repoService = inject(RepositoryService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly platformVersion = inject(PlatformVersionService);
  private readonly toast = inject(ToastService);

  readonly manifestAgentPrompt = computed(() => {
    const spec = this.platformVersion.version()?.manifestSpec;
    const schemaUrl =
      spec?.applicationSchemaUrl ??
      'https://unpkg.com/@flui-cloud/spec/schemas/application.v1beta1.json';
    return [
      'Write a flui.yaml for this repository, following the schema at',
      schemaUrl,
      '- one kind: Application per deployable app. Then check it with:',
      'flui deploy --validate-only --cluster <cluster>',
      'which checks the schema and also asks this installation whether it would',
      'actually land — cluster, repository, build credentials, room, and what it',
      'would do. Without the Flui CLI the schema alone can be checked with:',
      'npx -p @flui-cloud/spec flui-spec validate flui.yaml',
    ].join('\n');
  });

  readonly manifestPromptCopied = signal(false);

  readonly installNameChanged = computed(() => {
    const declared = this.state.manifestResult()?.manifest?.metadata.name;
    const chosen = this.state.overrideName().trim();
    return !!declared && !!chosen && declared !== chosen;
  });

  async copyManifestPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.manifestAgentPrompt());
      this.manifestPromptCopied.set(true);
      setTimeout(() => this.manifestPromptCopied.set(false), 1500);
    } catch {
      this.toast.showError('Could not copy to clipboard');
    }
  }

  async loadRepositories(): Promise<void> {
    this.form.isLoadingRepos.set(true);

    try {
      await this.repoService.loadRepositories();
    } catch (error) {
      console.error('❌ Failed to load repositories:', error);
    } finally {
      this.form.isLoadingRepos.set(false);
    }
  }

  onPublicRepoSelected(repo: PublicRepoSearchResultDto): void {
    this.form.selectedPublicRepo.set(repo);
    this.form.selectedRepo.set(null);
    this.form.availableBranches.set([]);
    this.form.selectedBranch.set(repo.default_branch);
    this.loadBranches().then(() => {});
  }

  clearPublicRepo(): void {
    this.form.selectedPublicRepo.set(null);
    this.form.availableBranches.set([]);
    this.form.branchesFailed.set(false);
    this.form.branchesProblem.set(null);
    this.form.selectedBranch.set('');
  }

  selectRepository(repo: ConnectedRepository): void {
    this.form.selectedRepo.set(repo);
    this.form.selectedPublicRepo.set(null);
  }

  async loadBranches(): Promise<void> {
    const f = this.form;
    const publicRepo = f.selectedPublicRepo();
    const connectedRepo = f.selectedRepo();
    if (!publicRepo && !connectedRepo) return;

    f.isLoadingBranches.set(true);

    try {
      let branchNames: string[];
      if (publicRepo) {
        branchNames = await this.repoService.getPublicRepositoryBranches(publicRepo.full_name);
      } else {
        const branches = await this.repoService.getRepositoryBranches(connectedRepo!.id);
        branchNames = branches.map((b: any) => b.name || b);
      }
      f.availableBranches.set(branchNames);
      f.branchesFailed.set(false);
      f.branchesProblem.set(null);

      const currentBranch = f.selectedBranch();
      if (branchNames.length > 0 && !branchNames.includes(currentBranch)) {
        const declaredDefault = publicRepo?.default_branch ?? connectedRepo?.branch;
        f.selectedBranch.set(
          declaredDefault && branchNames.includes(declaredDefault)
            ? declaredDefault
            : branchNames[0],
        );
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
      f.availableBranches.set([]);
      f.branchesFailed.set(true);
      f.branchesProblem.set(githubCredentialProblem(error));
    } finally {
      f.isLoadingBranches.set(false);
    }
  }

  selectBranch(branch: string): void {
    const f = this.form;
    f.selectedBranch.set(branch);

    if (f.flowSubtype() === 'existing-repo' && f.selectedRepo()) {
      this.triggerManifestCheck().then(() => {
        const repo = f.selectedRepo();
        const manifest = f.manifestForSelector();
        if (repo && manifest?.valid) {
          this.state.initializeFromManifest(
            repo.id,
            repo.fullName,
            branch,
            manifest,
            f.selectedCluster()?.id ?? '',
          );
          if (f.currentStepId() === 'environment') {
            f.envVars.set([]);
            if (!this.env.prefillEnvVarsFromManifest()) {
              this.env.analyzeAndSuggestEnvVars();
            }
          }
        }
      });
      return;
    }

    if (f.currentStepId() === 'environment') {
      this.env.analyzeAndSuggestEnvVars();
    }
  }

  async triggerManifestCheck(): Promise<void> {
    const f = this.form;
    const repo = f.selectedRepo();
    if (!repo) return;

    f.isCheckingManifest.set(true);
    f.manifestsForSelector.set(null);
    f.selectedManifestPath.set(null);
    f.manifestFetchError.set(null);
    f.manifestProblem.set(null);

    try {
      const result = await this.repoService.getFluiManifests(repo.id, f.selectedBranch());
      f.manifestsForSelector.set(result.manifests);
      const firstValid = result.manifests.find((e) => e.valid);
      if (firstValid) f.selectedManifestPath.set(firstValid.path);
    } catch (error: any) {
      f.manifestProblem.set(githubCredentialProblem(error));
      f.manifestFetchError.set(
        error?.error?.message || error?.message || 'Failed to read flui.yaml manifests',
      );
    } finally {
      f.isCheckingManifest.set(false);
    }
  }

  async runManifestChecks(clusterId: string): Promise<void> {
    const f = this.form;
    const repo = f.selectedRepo();
    const manifest = f.manifestForSelector();
    if (!repo || !manifest?.valid || !manifest.content) {
      f.manifestChecks.set(null);
      return;
    }

    f.manifestChecksLoading.set(true);
    f.manifestChecksError.set(null);
    try {
      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerValidateManifest({
          yaml: manifest.content,
          clusterId,
          repoFullName: repo.fullName,
          branch: f.selectedBranch() || undefined,
        }),
      );
      f.manifestChecks.set(response.checks ?? null);
    } catch (error: any) {
      f.manifestChecksError.set(
        error?.error?.message || error?.message || 'Could not run installation checks.',
      );
      f.manifestChecks.set(null);
    } finally {
      f.manifestChecksLoading.set(false);
    }
  }

  selectManifest(path: string): void {
    this.form.selectedManifestPath.set(path);
  }

  downloadManifest(): void {
    const manifest = this.form.manifestForSelector();
    if (!manifest?.content) return;
    const url = URL.createObjectURL(new Blob([manifest.content], { type: 'application/yaml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = manifest.manifest?.metadata.name
      ? `${manifest.manifest.metadata.name}.flui.yaml`
      : 'flui.yaml';
    link.click();
    URL.revokeObjectURL(url);
  }

  syncManifestIntoState(): void {
    const f = this.form;
    const repo = f.selectedRepo();
    const manifest = f.manifestForSelector();
    if (repo && manifest?.valid) {
      this.state.initializeFromManifest(
        repo.id,
        repo.fullName,
        f.selectedBranch(),
        manifest,
        f.selectedCluster()?.id ?? '',
      );
    }
  }
}
