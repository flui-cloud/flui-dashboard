import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VariablesService } from '../../core/api/api/variables.service';
import { AppVariablesCombinedResponseDto } from '../../core/api/model/appVariablesCombinedResponseDto';

@Injectable({ providedIn: 'root' })
export class AppVariablesService {
  private readonly api = inject(VariablesService);

  private readonly combinedData = signal<AppVariablesCombinedResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly savingData = signal(false);
  private readonly errorData = signal<string | null>(null);

  readonly variables = this.combinedData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly saving = this.savingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly hasVariables = computed(() => !!this.combinedData());
  readonly sensitiveKeys = computed(() => this.combinedData()?.sensitiveKeys ?? []);

  readonly plainData = computed(() => {
    const vars = this.combinedData();
    if (!vars) return {};
    const sensitive = new Set(vars.sensitiveKeys);
    return Object.fromEntries(
      Object.entries(vars.data).filter(([key]) => !sensitive.has(key))
    );
  });

  readonly sensitiveData = computed(() => {
    const vars = this.combinedData();
    if (!vars) return {};
    const sensitive = new Set(vars.sensitiveKeys);
    return Object.fromEntries(
      Object.entries(vars.data).filter(([key]) => sensitive.has(key))
    );
  });

  async loadVariables(appId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerGetAppVariables(appId, 'all')
      );
      this.combinedData.set(result ?? null);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load variables'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async upsertPlain(appId: string, data: Record<string, string>, deleteKeys: string[] = []): Promise<AppVariablesCombinedResponseDto | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerUpsertAppVariables(appId, { data, deleteKeys }, 'plain')
      );
      this.combinedData.set(result ?? null);
      return result ?? null;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to save plain variables'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  async upsertSensitive(appId: string, data: Record<string, string>, deleteKeys: string[] = []): Promise<AppVariablesCombinedResponseDto | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerUpsertAppVariables(appId, { data, deleteKeys }, 'sensitive')
      );
      this.combinedData.set(result ?? null);
      return result ?? null;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to save sensitive variables'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  clearError(): void {
    this.errorData.set(null);
  }

  clearVariables(): void {
    this.combinedData.set(null);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
