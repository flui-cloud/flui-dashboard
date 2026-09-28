import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { Costs } from '../model/costs.models';

@Injectable({ providedIn: 'root' })
export class CostsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly data = signal<Costs | null>(null);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);

  readonly costs = this.data.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  async load(months: number): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      this.data.set(
        await firstValueFrom(
          this.http.get<Costs>(
            `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/costs`,
            { params: { months } },
          ),
        ),
      );
    } catch (error: unknown) {
      this.data.set(null);
      this.errorData.set(messageOf(error));
    } finally {
      this.loadingData.set(false);
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'Costs cover the whole installation, so only an administrator of the infrastructure can read them.';
    if (error.status === 404) return 'This installation’s API does not serve costs yet: it is running an older build.';
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
  }
  return 'Could not read the costs.';
}
