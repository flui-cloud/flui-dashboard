import { Injectable, computed, inject } from '@angular/core';
import { RepositoryService } from '../../service/repository.service';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import { EnvironmentVariable } from '../../model/application.models';
import { DeployWizardForm } from './deploy-wizard.state';

@Injectable()
export class DeployWizardEnv {
  private readonly form = inject(DeployWizardForm);
  private readonly repoService = inject(RepositoryService);
  private currentAnalysisToken: symbol | null = null;

  readonly hasUnreviewedDefaults = computed(() => {
    const meta = this.form.detectedVarMeta();
    if (meta.size === 0) return false;
    return this.form.envVars().some((v) => {
      const m = meta.get(v.key);
      return m?.defaultValue !== undefined && v.value === m.defaultValue;
    });
  });

  prefillEnvVarsFromManifest(): boolean {
    const env = this.form.manifestForSelector()?.manifest?.deploy.env;
    if (!env?.length) return false;

    if (this.form.envVars().length === 0) {
      const entries = env
        .filter((e) => e.value !== undefined || e.valueFrom?.userInput)
        .map((e) => ({
          key: e.name,
          value: e.value ?? e.valueFrom?.userInput?.default ?? '',
          isSecret: e.valueFrom?.userInput?.sensitive ?? false,
        }));
      this.form.envVars.set(entries);
    }
    return true;
  }

  async analyzeAndSuggestEnvVars(): Promise<void> {
    const f = this.form;
    const repo = f.selectedRepo();
    const publicRepo = f.selectedPublicRepo();
    if (!repo && !publicRepo) return;

    const token = Symbol();
    this.currentAnalysisToken = token;
    f.envDetectionLoading.set(true);
    f.envDetectionError.set(null);
    f.envDetectionResult.set(null);
    f.detectedVarMeta.set(new Map());

    try {
      const analysis = repo
        ? await this.repoService.analyzeRepository(repo.id, f.selectedBranch())
        : await this.repoService.analyzePublicRepository(publicRepo!.clone_url, f.selectedBranch());
      if (this.currentAnalysisToken !== token) return;

      const suggestions = analysis?.buildPlan?.envVarSuggestions as
        EnvVarDetectionResultDto | undefined;
      f.envDetectionResult.set(suggestions ?? null);

      if (suggestions?.candidates.length) {
        this.applyDetectedVars(0);
      }
    } catch {
      if (this.currentAnalysisToken === token) {
        f.envDetectionError.set('Could not analyze repository.');
      }
    } finally {
      if (this.currentAnalysisToken === token) {
        f.envDetectionLoading.set(false);
      }
    }
  }

  cancelEnvDetection(): void {
    this.currentAnalysisToken = null;
    this.form.envDetectionLoading.set(false);
  }

  applyDetectedVars(candidateIndex: number, preserveKey?: string): void {
    const result = this.form.envDetectionResult();
    if (!result?.candidates.length) return;

    const candidate = result.candidates[candidateIndex];
    this.form.selectedCandidateIndex.set(candidateIndex);

    const preservedValue = preserveKey
      ? this.form.envVars().find((v) => v.key === preserveKey)?.value
      : undefined;

    const meta = new Map<string, DetectedEnvVarDto>();
    const vars: EnvironmentVariable[] = candidate.vars
      .filter((v) => !v.readOnly)
      .map((v) => {
        meta.set(v.name, v);
        const value =
          preservedValue !== undefined && v.name === preserveKey
            ? preservedValue
            : (v.defaultValue ?? '');
        return { key: v.name, value, isSecret: v.sensitive };
      });

    this.form.detectedVarMeta.set(meta);
    this.form.envVars.set(vars);
  }

  setEnvMode(mode: 'key-value' | 'json'): void {
    const f = this.form;
    if (mode === 'json' && f.envMode() === 'key-value') {
      const json: Record<string, string> = {};
      f.envVars().forEach((v) => {
        if (v.key) json[v.key] = v.value;
      });
      f.rawEnvJson.set(JSON.stringify(json, null, 2));
    } else if (mode === 'key-value' && f.envMode() === 'json') {
      try {
        const json = JSON.parse(f.rawEnvJson());
        const vars: EnvironmentVariable[] = Object.entries(json).map(([key, value]) => ({
          key,
          value: String(value),
          isSecret: false,
        }));
        f.envVars.set(vars);
        f.jsonError.set(null);
      } catch {
        f.jsonError.set('Invalid JSON format');
      }
    }

    f.envMode.set(mode);
  }

  addEnvVar(): void {
    this.form.envVars.update((vars) => [...vars, { key: '', value: '', isSecret: false }]);
  }

  removeEnvVar(index: number): void {
    this.form.envVars.update((vars) => vars.filter((_, i) => i !== index));
  }

  updateEnvKey(index: number, key: string): void {
    this.form.envVars.update((vars) => vars.map((v, i) => (i === index ? { ...v, key } : v)));
  }

  updateEnvValue(index: number, value: string): void {
    this.form.envVars.update((vars) => vars.map((v, i) => (i === index ? { ...v, value } : v)));
  }

  toggleEnvSecret(index: number): void {
    this.form.envVars.update((vars) =>
      vars.map((v, i) => (i === index ? { ...v, isSecret: !v.isSecret } : v)),
    );
  }

  updateRawEnvJson(json: string): void {
    this.form.rawEnvJson.set(json);

    try {
      JSON.parse(json);
      this.form.jsonError.set(null);
    } catch {
      this.form.jsonError.set('Invalid JSON format');
    }
  }

  getEnvVarsCount(): number {
    if (this.form.envMode() === 'key-value') {
      return this.form.envVars().filter((v) => v.key && v.value).length;
    }
    try {
      const json = JSON.parse(this.form.rawEnvJson());
      return Object.keys(json).length;
    } catch {
      return 0;
    }
  }

  getSecretVarsCount(): number {
    return this.form.envVars().filter((v) => v.isSecret && v.key && v.value).length;
  }

  buildEnvVarsList(): EnvironmentVariable[] | null {
    if (this.form.envMode() === 'key-value') {
      return this.form.envVars().filter((v) => v.key && v.value);
    }
    try {
      const json = JSON.parse(this.form.rawEnvJson());
      return Object.entries(json).map(([key, value]) => ({
        key,
        value: String(value),
        isSecret: false,
      }));
    } catch {
      return null;
    }
  }
}
