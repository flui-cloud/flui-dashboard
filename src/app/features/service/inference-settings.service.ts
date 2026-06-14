import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { InferenceService } from '../../core/api/api/inference.service';
import { AssistantService } from '../../core/api/api/assistant.service';
import { InferenceConnectionDto } from '../../core/api/model/inferenceConnectionDto';
import { InferenceProviderInfoDto } from '../../core/api/model/inferenceProviderInfoDto';
import { CreateInferenceConnectionDto } from '../../core/api/model/createInferenceConnectionDto';
import { ValidationResultDto } from '../../core/api/model/validationResultDto';
import { AssistantRecommendationsDto } from '../../core/api/model/assistantRecommendationsDto';
import { RecommendationGroupDto } from '../../core/api/model/recommendationGroupDto';
import { RecommendedModelDto } from '../../core/api/model/recommendedModelDto';

type InferenceProvider = 'contabo' | 'hetzner' | 'scaleway';

type ModelOpts = { model?: string; provider?: string; connectionId?: string } | null | undefined;

@Injectable({ providedIn: 'root' })
export class InferenceSettingsService {
  private readonly api = inject(InferenceService);
  private readonly assistantApi = inject(AssistantService);

  readonly providers = signal<InferenceProviderInfoDto[]>([]);
  readonly configuredProviders = computed(() => this.providers().filter((p) => p.configured));
  readonly connections = signal<InferenceConnectionDto[]>([]);
  readonly recommendations = signal<AssistantRecommendationsDto | null>(null);
  readonly isHosted = signal(false);

  loadRecommendations(): void {
    this.assistantApi.assistantControllerGetRecommendations().subscribe({
      next: (r) => this.recommendations.set(r),
      error: () => this.recommendations.set(null),
    });
  }

  groupFor(opts: ModelOpts): RecommendationGroupDto | undefined {
    const rec = this.recommendations();
    if (!rec || !opts) return undefined;
    if (opts.provider) return rec.groups.find((g) => g.matchProvider === opts.provider);
    if (opts.connectionId) {
      const conn = this.connections().find((c) => c.id === opts.connectionId);
      if (!conn) return undefined;
      return rec.groups.find((g) => !!g.matchConnectionHost && !!conn.baseUrl?.includes(g.matchConnectionHost));
    }
    return undefined;
  }

  recommendedModelFor(opts: ModelOpts): RecommendedModelDto | undefined {
    if (!opts?.model) return undefined;
    return this.groupFor(opts)?.models.find((m) => m.model === opts.model);
  }

  loadProviders(): void {
    this.api.inferenceControllerListProviders().subscribe({
      next: (p) => this.providers.set(p),
      error: () => this.providers.set([]),
    });
  }

  loadConnections(): void {
    this.api.inferenceControllerListConnections().subscribe({
      next: (c) => this.connections.set(c),
      error: () => this.connections.set([]),
    });
  }

  validateProvider(provider: InferenceProvider): Observable<ValidationResultDto> {
    return this.api.inferenceControllerValidateProvider(provider);
  }

  createConnection(dto: CreateInferenceConnectionDto): Observable<InferenceConnectionDto> {
    return this.api.inferenceControllerCreateConnection(dto).pipe(
      tap(() => this.loadConnections()),
      catchError((err) => {
        if (err?.status === 403) this.isHosted.set(true);
        return throwError(() => err);
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
