import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideAlertCircle, lucideLoader, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import {
  HlmCardDirective,
  HlmCardContentDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
  HlmCardDescriptionDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';

interface ConnUiState {
  validating: boolean;
  validation: { ok: boolean; message: string } | null;
  deleting: boolean;
}

interface ConnectionPreset {
  id: string;
  label: string;
  baseUrl: string;
}

const CONNECTION_PRESETS: ConnectionPreset[] = [
  { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
  { id: 'custom', label: 'Custom', baseUrl: '' },
];
const DEFAULT_PRESET = CONNECTION_PRESETS[0];

@Component({
  selector: 'app-inference-connections',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmBadgeDirective,
    HlmInputDirective,
    HlmLabelDirective,
  ],
  providers: [provideIcons({ lucideCheck, lucideAlertCircle, lucideLoader, lucidePlus, lucideTrash2 })],
  template: `
    <div class="space-y-4">
      @if (service.connections().length > 0) {
        <div hlmCard>
          <div hlmCardContent class="pt-6">
            <ul class="divide-y divide-border">
              @for (c of service.connections(); track c.id) {
                @let st = connState(c.id);
                <li class="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 space-y-0.5">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-medium">{{ c.label }}</span>
                        @if (c.isDefault) {
                          <span hlmBadge variant="secondary" class="text-xs">Default</span>
                        }
                      </div>
                      <p class="font-mono text-xs text-muted-foreground truncate">{{ c.baseUrl }}</p>
                      @if (c.models.length) {
                        <p class="text-xs text-muted-foreground">
                          {{ c.models.length }} model{{ c.models.length === 1 ? '' : 's' }}
                        </p>
                      }
                    </div>
                    <div class="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        (click)="validateConn(c.id)"
                        [disabled]="st.validating || st.deleting"
                        class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        @if (st.validating) {
                          <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                        }
                        Validate
                      </button>
                      @if (!service.isHosted()) {
                        <button
                          type="button"
                          (click)="deleteConn(c.id)"
                          [disabled]="st.deleting || st.validating"
                          class="inline-flex items-center gap-1 rounded-md border border-destructive/50 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          @if (st.deleting) {
                            <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                          } @else {
                            <ng-icon name="lucideTrash2" class="h-3 w-3" />
                          }
                        </button>
                      }
                    </div>
                  </div>
                  @if (st.validation) {
                    <div
                      class="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
                      [class]="st.validation.ok
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-destructive/10 text-destructive'"
                    >
                      <ng-icon
                        [name]="st.validation.ok ? 'lucideCheck' : 'lucideAlertCircle'"
                        class="h-3.5 w-3.5 shrink-0"
                      />
                      {{ st.validation.message }}
                    </div>
                  }
                </li>
              }
            </ul>
          </div>
        </div>
      } @else {
        <p class="text-sm text-muted-foreground">No LLM connections configured yet.</p>
      }

      @if (!service.isHosted()) {
        @if (!showForm()) {
          <button
            type="button"
            (click)="showForm.set(true)"
            class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            Add connection
          </button>
        } @else {
          <div hlmCard>
            <div hlmCardHeader>
              <h4 hlmCardTitle>New connection</h4>
              <p hlmCardDescription>Connect an OpenAI-compatible LLM endpoint.</p>
            </div>
            <div hlmCardContent>
              <form [formGroup]="form" (ngSubmit)="submitForm()" class="space-y-4">
                <div class="space-y-1.5">
                  <label hlmLabel for="conn-preset">Provider</label>
                  <select
                    id="conn-preset"
                    formControlName="preset"
                    (change)="applyPreset()"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    @for (p of presets; track p.id) {
                      <option [value]="p.id">{{ p.label }}</option>
                    }
                  </select>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label hlmLabel for="conn-label">Label</label>
                    <input
                      hlmInput
                      id="conn-label"
                      formControlName="label"
                      placeholder="OpenAI (prod)"
                      class="w-full"
                      [class.border-destructive]="isInvalid('label')"
                    />
                    @if (isInvalid('label')) {
                      <p class="text-xs text-destructive">Required.</p>
                    }
                  </div>
                  <div class="space-y-1.5">
                    <label hlmLabel for="conn-url">Base URL</label>
                    <input
                      hlmInput
                      id="conn-url"
                      formControlName="baseUrl"
                      placeholder="https://api.openai.com/v1"
                      class="w-full"
                      [class.border-destructive]="isInvalid('baseUrl')"
                    />
                    @if (isInvalid('baseUrl')) {
                      <p class="text-xs text-destructive">Valid URL required.</p>
                    }
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label hlmLabel for="conn-key">API Key</label>
                  <input
                    hlmInput
                    id="conn-key"
                    type="password"
                    formControlName="apiKey"
                    placeholder="sk-…"
                    autocomplete="new-password"
                    class="w-full"
                    [class.border-destructive]="isInvalid('apiKey')"
                  />
                  @if (isInvalid('apiKey')) {
                    <p class="text-xs text-destructive">Required.</p>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="conn-default"
                    formControlName="isDefault"
                    class="h-4 w-4 rounded border-input accent-primary"
                  />
                  <label for="conn-default" class="text-sm text-foreground cursor-pointer">Set as default</label>
                </div>
                @if (createError()) {
                  <div class="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
                    {{ createError() }}
                  </div>
                }
                <div class="flex gap-2">
                  <button
                    type="submit"
                    [disabled]="creating()"
                    class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    @if (creating()) {
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    }
                    Add
                  </button>
                  <button
                    type="button"
                    (click)="cancelForm()"
                    class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class InferenceConnectionsComponent implements OnInit {
  protected readonly service = inject(InferenceSettingsService);
  private readonly fb = inject(FormBuilder);
  private readonly states = signal<Record<string, ConnUiState>>({});

  readonly showForm = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  protected readonly presets = CONNECTION_PRESETS;

  readonly form = this.fb.nonNullable.group({
    preset: [DEFAULT_PRESET.id],
    label: [DEFAULT_PRESET.label, Validators.required],
    baseUrl: [DEFAULT_PRESET.baseUrl, [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    apiKey: ['', Validators.required],
    isDefault: [false],
  });

  applyPreset(): void {
    const preset = CONNECTION_PRESETS.find((p) => p.id === this.form.controls.preset.value);
    if (!preset || preset.id === 'custom') {
      this.form.patchValue({ label: '', baseUrl: '' });
      return;
    }
    this.form.patchValue({ label: preset.label, baseUrl: preset.baseUrl });
  }

  connState(id: string): ConnUiState {
    return this.states()[id] ?? { validating: false, validation: null, deleting: false };
  }

  private patchConn(id: string, patch: Partial<ConnUiState>): void {
    this.states.update((s) => ({ ...s, [id]: { ...this.connState(id), ...patch } }));
  }

  ngOnInit(): void {
    this.service.loadConnections();
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }

  validateConn(id: string): void {
    this.patchConn(id, { validating: true, validation: null });
    this.service.validateConnection(id).subscribe({
      next: (r) => {
        const models = (r.details as { models?: unknown[] } | undefined)?.models;
        let msg: string;
        if (Array.isArray(models)) {
          msg = `${models.length} model${models.length === 1 ? '' : 's'} found`;
        } else {
          msg = r.message ?? (r.success ? 'Connection valid' : 'Connection failed');
        }
        this.patchConn(id, { validating: false, validation: { ok: r.success, message: msg } });
        if (r.success) this.service.loadConnections();
      },
      error: (err) =>
        this.patchConn(id, {
          validating: false,
          validation: { ok: false, message: err?.error?.message ?? 'Validation failed' },
        }),
    });
  }

  deleteConn(id: string): void {
    this.patchConn(id, { deleting: true });
    this.service.deleteConnection(id).subscribe({
      error: (err) =>
        this.patchConn(id, {
          deleting: false,
          validation: { ok: false, message: err?.error?.message ?? 'Delete failed' },
        }),
    });
  }

  submitForm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { label, baseUrl, apiKey, isDefault } = this.form.getRawValue();
    this.creating.set(true);
    this.createError.set(null);
    this.service.createConnection({ label, baseUrl, apiKey, isDefault }).subscribe({
      next: (conn) => {
        this.creating.set(false);
        this.cancelForm();
        this.validateConn(conn.id);
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          err?.status === 403
            ? 'Not allowed in hosted mode.'
            : (err?.error?.message ?? 'Failed to create connection.'),
        );
      },
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.form.reset({
      preset: DEFAULT_PRESET.id,
      label: DEFAULT_PRESET.label,
      baseUrl: DEFAULT_PRESET.baseUrl,
      apiKey: '',
      isDefault: false,
    });
    this.createError.set(null);
  }
}
