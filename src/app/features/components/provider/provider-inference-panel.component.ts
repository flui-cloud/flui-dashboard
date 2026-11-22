import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { ValidationResultDto } from '../../../core/api/model/validationResultDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

@Component({
  selector: 'provider-inference-panel',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlCopyId, FlButton, FlStatus, FlTag],
  host: { class: 'fl-stack' },
  template: `
    @if (info(); as p) {
      <fl-panel title="Inference">
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          [disabled]="testing()"
          (click)="test()"
        >
          {{ testing() ? 'Testing…' : 'Test inference' }}
        </button>
        <div class="fl-stack">
          <p class="text-fl-body-sm text-fl-ink-muted">
            Uses this provider's credentials. No separate key.
          </p>
          <fl-key-value>
            <fl-kv-item key="Endpoint">
              <fl-copy-id [value]="p.baseUrl" label="endpoint" />
            </fl-kv-item>
            <fl-kv-item key="Data residency">{{ p.euDataResidency ? 'EU' : '—' }}</fl-kv-item>
            <fl-kv-item key="Models">
              @if (p.models.length) {
                <span class="flex flex-wrap gap-1">
                  @for (m of p.models; track m) {
                    <fl-tag class="fl-mono">{{ m }}</fl-tag>
                  }
                </span>
              } @else {
                <span class="text-fl-ink-muted">No models reachable yet</span>
              }
            </fl-kv-item>
          </fl-key-value>
          @if (result(); as r) {
            <fl-status [tone]="r.ok ? 'success' : 'error'" [label]="r.message" />
          }
        </div>
      </fl-panel>
    }
  `,
})
export class ProviderInferencePanelComponent implements OnInit {
  readonly providerId = input.required<string>();

  private readonly service = inject(InferenceSettingsService);

  protected readonly testing = signal(false);
  protected readonly result = signal<{ ok: boolean; message: string } | null>(null);

  protected readonly info = computed(
    () => this.service.providers().find((p) => p.provider === this.providerId()) ?? null,
  );

  ngOnInit(): void {
    this.service.loadProviders();
  }

  test(): void {
    this.testing.set(true);
    this.result.set(null);
    this.service
      .validateProvider(
        this.providerId() as Parameters<InferenceSettingsService['validateProvider']>[0],
      )
      .subscribe({
        next: (r) => {
          const models = (r.details as { models?: unknown } | undefined)?.models;
          const msg = this.describeValidationResult(r, models);
          this.testing.set(false);
          this.result.set({ ok: r.success, message: msg });
        },
        error: (e) => {
          this.testing.set(false);
          this.result.set({ ok: false, message: e?.error?.message ?? 'Validation failed' });
        },
      });
  }

  private describeValidationResult(r: ValidationResultDto, models: unknown): string {
    if (Array.isArray(models)) {
      return `${models.length} model${models.length === 1 ? '' : 's'} reachable`;
    }
    if (r.message) return r.message;
    return r.success ? 'OK' : 'Failed';
  }
}
