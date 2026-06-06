import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError } from 'rxjs';
import { InferenceService } from '../../core/api/api/inference.service';
import { InferenceConnectionDto } from '../../core/api/model/inferenceConnectionDto';
import { InferenceProviderInfoDto } from '../../core/api/model/inferenceProviderInfoDto';
import { CreateInferenceConnectionDto } from '../../core/api/model/createInferenceConnectionDto';
import { ValidationResultDto } from '../../core/api/model/validationResultDto';

type InferenceProvider = 'contabo' | 'hetzner' | 'scaleway';

@Injectable({ providedIn: 'root' })
export class InferenceSettingsService {
  private readonly api = inject(InferenceService);

  readonly providers = signal<InferenceProviderInfoDto[]>([]);
  readonly connections = signal<InferenceConnectionDto[]>([]);
  readonly isHosted = signal(false);

  loadProviders(): void {
    this.api.inferenceControllerListProviders().subscribe({
      next: (p) => this.providers.set(p),
    });
  }

  loadConnections(): void {
    this.api.inferenceControllerListConnections().subscribe({
      next: (c) => this.connections.set(c),
    });
  }

  validateProvider(provider: InferenceProvider): Observable<ValidationResultDto> {
    return this.api.inferenceControllerValidateProvider(provider, { apiKey: '' });
  }

  createConnection(dto: CreateInferenceConnectionDto): Observable<InferenceConnectionDto> {
    return this.api.inferenceControllerCreateConnection(dto).pipe(
      tap(() => this.loadConnections()),
      catchError((err) => {
        if (err?.status === 403) this.isHosted.set(true);
        throw err;
      }),
    );
  }

  validateConnection(id: string): Observable<ValidationResultDto> {
    return this.api.inferenceControllerValidateConnection(id);
  }

  deleteConnection(id: string): Observable<void> {
    return this.api.inferenceControllerDeleteConnection(id).pipe(
      tap(() => this.loadConnections()),
    );
  }
}
