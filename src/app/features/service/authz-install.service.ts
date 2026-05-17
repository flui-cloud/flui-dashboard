import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthzService } from '../../core/api/api/authz.service';
import { InfrastructureOperationsService } from '../../core/api/api/infrastructureOperations.service';
import { AuthzInstallResponseDto } from '../../core/api/model/authzInstallResponseDto';

interface OperationStatusSnapshot {
  status: string;
  progress?: number;
  currentStep?: { description?: string };
}

@Injectable({ providedIn: 'root' })
export class AuthzInstallService {
  private readonly authzApi = inject(AuthzService);
  private readonly operationsApi = inject(InfrastructureOperationsService);

  private readonly _install = signal<AuthzInstallResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _installing = signal(false);
  private readonly _progress = signal(0);
  private readonly _progressStep = signal('');

  readonly install = this._install.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly installing = this._installing.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly progressStep = this._progressStep.asReadonly();

  async loadForCluster(clusterId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const all = await firstValueFrom(this.authzApi.authzInstallControllerFindAll());
      const match = all
        .filter(i => i.clusterId === clusterId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
      this._install.set(match);
    } catch (err) {
      this._error.set(this.extractError(err) ?? 'Failed to load authz status');
    } finally {
      this._loading.set(false);
    }
  }

  async installAuthz(clusterId: string): Promise<void> {
    this._error.set(null);
    this._installing.set(true);
    this._progress.set(0);
    this._progressStep.set('Starting...');
    try {
      const result = await firstValueFrom(
        this.authzApi.authzInstallControllerInstall({ clusterId }),
      );
      this._install.set(result);
      await this.pollOperation(result.id, result.operationId);
    } catch (err) {
      this._error.set(this.extractError(err) ?? 'Installation failed');
    } finally {
      this._installing.set(false);
    }
  }

  async uninstallAuthz(installId: string): Promise<void> {
    this._error.set(null);
    this._installing.set(true);
    this._progress.set(0);
    this._progressStep.set('Uninstalling...');
    try {
      const result = await firstValueFrom(
        this.authzApi.authzInstallControllerUninstall(installId),
      );
      this._install.set(result);
      await this.pollOperation(result.id, result.operationId);
    } catch (err) {
      this._error.set(this.extractError(err) ?? 'Uninstall failed');
    } finally {
      this._installing.set(false);
    }
  }

  private async pollOperation(installId: string, operationId: string | undefined): Promise<void> {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 600;
    let pollCount = 0;

    while (pollCount < MAX_POLLS) {
      pollCount++;

      if (operationId) {
        try {
          const op = await firstValueFrom(
            this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId),
          ) as OperationStatusSnapshot;
          if (op.progress !== undefined) this._progress.set(op.progress);
          if (op.currentStep?.description) this._progressStep.set(op.currentStep.description);
        } catch {
          // progress is best-effort
        }
      }

      if (!operationId || pollCount % 4 === 0) {
        try {
          const fresh = await firstValueFrom(
            this.authzApi.authzInstallControllerFindOne(installId),
          );
          this._install.set(fresh);
          const s = fresh.status;
          if (
            s === AuthzInstallResponseDto.StatusEnum.Running ||
            s === AuthzInstallResponseDto.StatusEnum.Failed ||
            s === AuthzInstallResponseDto.StatusEnum.Uninstalled
          ) {
            this._progress.set(100);
            return;
          }
        } catch {
          // best-effort
        }
      }

      await this.delay(POLL_INTERVAL);
    }
  }

  private extractError(err: unknown): string | null {
    if (!err || typeof err !== 'object') return null;
    const e = err as Record<string, unknown>;
    const body = e['error'] as Record<string, unknown> | undefined;
    if (body?.['message']) return String(body['message']);
    if (e['message']) return String(e['message']);
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
