import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VariablesService } from '../../core/api/api/variables.service';
import { VariableSetSummaryDto } from '../../core/api/model/variableSetSummaryDto';
import { AppVariablesResponseDto } from '../../core/api/model/appVariablesResponseDto';

@Injectable({ providedIn: 'root' })
export class ClusterVariablesService {
  private readonly api = inject(VariablesService);

  private readonly variableSets = signal<VariableSetSummaryDto[]>([]);
  private readonly selectedSetData = signal<AppVariablesResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly savingData = signal(false);
  private readonly errorData = signal<string | null>(null);

  readonly sets = this.variableSets.asReadonly();
  readonly currentSet = this.selectedSetData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly saving = this.savingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  async loadSets(clusterId: string, namespace: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerListClusterVariables(clusterId, namespace, 'all', 'all')
      );
      this.variableSets.set(result ?? []);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load variable sets'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadSet(clusterId: string, namespace: string, name: string, type: 'plain' | 'sensitive' = 'plain'): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerGetClusterVariables(clusterId, namespace, name, type)
      );
      this.selectedSetData.set(result ?? null);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load variable set'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async upsertSet(
    clusterId: string,
    namespace: string,
    name: string,
    data: Record<string, string>,
    type: 'plain' | 'sensitive'
  ): Promise<AppVariablesResponseDto | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.variablesControllerUpsertClusterVariables(clusterId, namespace, name, { data }, type)
      );
      this.selectedSetData.set(result ?? null);
      await this.loadSets(clusterId, namespace);
      return result ?? null;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to save variable set'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  clearError(): void {
    this.errorData.set(null);
  }

  clearCurrentSet(): void {
    this.selectedSetData.set(null);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
