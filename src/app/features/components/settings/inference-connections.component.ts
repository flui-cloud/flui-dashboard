import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { SandboxLevelNoticeComponent } from '../../../shared/components/sandbox-level-notice.component';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

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
  imports: [
    ReadOnlySectionDirective,
    SandboxLevelNoticeComponent,
    ReactiveFormsModule,
    FlAlert,
    FlField,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    FlTag,
  ],
  providers: [provideIcons({ lucidePlus, lucideTrash2 })],
  host: { class: 'fl-stack' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-sandbox-level-notice area="models" />

    <fl-panel title="LLM connections" [count]="service.connections().length" [flush]="true">
      @if (!service.isHosted() && mayManage() && !showForm()) {
        <button
          panelActions
          appReadOnlySection="models"
          flButton
          size="sm"
          type="button"
          (click)="showForm.set(true)"
        >
          <fl-icon name="lucidePlus" />
          Add connection
        </button>
      }
      @if (service.connections().length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Base URL</th>
                <th scope="col" class="is-num">Models</th>
                <th scope="col">Check</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (c of service.connections(); track c.id) {
                @let st = connState(c.id);
                <tr>
                  <td class="fl-cell-name">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ c.label }}</span>
                      @if (c.isDefault) {
                        <fl-tag>Default</fl-tag>
                      }
                    </span>
                  </td>
                  <td class="fl-mono">{{ c.baseUrl }}</td>
                  <td class="is-num">{{ c.models.length }}</td>
                  <td class="whitespace-normal">
                    @if (st.validating) {
                      <fl-status tone="progress" label="Checking" />
                    } @else if (st.validation) {
                      <fl-status
                        [tone]="st.validation.ok ? 'success' : 'error'"
                        [label]="st.validation.message"
                      />
                    } @else {
                      <span class="fl-muted">Not checked</span>
                    }
                  </td>
                  <td class="is-fit">
                    <span class="flex items-center gap-1">
                      <button
                        appReadOnlySection="models"
                        flButton
                        size="sm"
                        type="button"
                        [attr.aria-label]="'Validate ' + c.label"
                        (click)="validateConn(c.id)"
                        [disabled]="st.validating || st.deleting"
                      >
                        Validate
                      </button>
                      @if (!service.isHosted() && mayManage()) {
                        <button
                          appReadOnlySection="models"
                          flButton="ghost"
                          size="sm"
                          type="button"
                          [iconOnly]="true"
                          [attr.aria-label]="'Delete ' + c.label"
                          [attr.data-testid]="'delete-connection-' + c.id"
                          (click)="confirmDeleteConn(c)"
                          [disabled]="st.deleting || st.validating"
                        >
                          @if (st.deleting) {
                            <fl-spinner label="Deleting" />
                          } @else {
                            <fl-icon name="lucideTrash2" />
                          }
                        </button>
                      }
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state
          [compact]="true"
          title="No LLM connections yet"
          body="Add an OpenAI-compatible endpoint to give the assistant a model."
        />
      }
    </fl-panel>

    @if (!service.isHosted() && mayManage() && showForm()) {
      <fl-panel title="New connection">
        <form [formGroup]="form" (ngSubmit)="submitForm()" class="flex flex-col gap-4">
          <fl-field label="Provider" for="conn-preset">
            <span class="fl-select-wrap">
              <select
                id="conn-preset"
                class="fl-select"
                formControlName="preset"
                (change)="applyPreset()"
              >
                @for (p of presets; track p.id) {
                  <option [value]="p.id">{{ p.label }}</option>
                }
              </select>
            </span>
          </fl-field>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fl-field
              label="Label"
              for="conn-label"
              [error]="isInvalid('label') ? 'Required.' : null"
            >
              <div class="fl-input fl-input--lg">
                <input id="conn-label" formControlName="label" placeholder="OpenAI (prod)" />
              </div>
            </fl-field>
            <fl-field
              label="Base URL"
              for="conn-url"
              [error]="isInvalid('baseUrl') ? 'Valid URL required.' : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="conn-url"
                  formControlName="baseUrl"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </fl-field>
          </div>
          <fl-field
            label="API key"
            for="conn-key"
            [error]="isInvalid('apiKey') ? 'Required.' : null"
          >
            <div class="fl-input fl-input--lg">
              <input
                id="conn-key"
                type="password"
                formControlName="apiKey"
                placeholder="sk-…"
                autocomplete="new-password"
              />
            </div>
          </fl-field>
          <label class="fl-check">
            <input type="checkbox" id="conn-default" formControlName="isDefault" />
            Set as default
          </label>
          @if (createError()) {
            <fl-alert tone="error" title="Connection not added">{{ createError() }}</fl-alert>
          }
          <div class="flex justify-end gap-2">
            <button flButton="ghost" type="button" (click)="cancelForm()">Cancel</button>
            <button flButton="primary" type="submit" [disabled]="creating()">
              @if (creating()) {
                <fl-spinner label="Adding" />
              }
              Add
            </button>
          </div>
        </form>
      </fl-panel>
    }
  `,
})
export class InferenceConnectionsComponent implements OnInit {
  protected readonly service = inject(InferenceSettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly perms = inject(PermissionService);
  private readonly states = signal<Record<string, ConnUiState>>({});

  protected readonly mayManage = computed(
    () => this.perms.isAdmin() || this.perms.can('integration:manage'),
  );

  protected readonly pendingId = signal<string | null>(null);

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

  async confirmDeleteConn(conn: { id: string; label: string; baseUrl: string }): Promise<void> {
    this.pendingId.set(conn.id);
    const ok = await this.confirmService.confirm({
      title: 'Delete LLM connection',
      body:
        `${conn.label} (${conn.baseUrl}) is deleted. This action cannot be undone. ` +
        'The stored API key is deleted with it, and anything using this ' +
        'connection stops working.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) this.onDeleteConfirmed();
    else this.onDeleteCancelled();
  }

  onDeleteConfirmed(): void {
    const id = this.pendingId();
    if (!id) return;
    this.patchConn(id, { deleting: true });
    this.service.deleteConnection(id).subscribe({
      next: () => {
        this.patchConn(id, { deleting: false });
        this.pendingId.set(null);
      },
      error: (err) => {
        this.patchConn(id, {
          deleting: false,
          validation: { ok: false, message: err?.error?.message ?? 'Delete failed' },
        });
        this.pendingId.set(null);
      },
    });
  }

  onDeleteCancelled(): void {
    this.pendingId.set(null);
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
