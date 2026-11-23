import { Component, computed, effect, inject, input, signal } from '@angular/core';
import {
  AppMaintenance,
  AppMaintenanceMode,
  DeferredAction,
  MaintenanceService,
  MaintenanceWindow,
  openingLabel,
} from '../../service/maintenance.service';
import { MaintenanceWindowEditorComponent } from './maintenance-window-editor.component';
import { DeferredListComponent } from './deferred-list.component';
import { FlKeyValue, FlKvItem, FlLoadingState, FlPanel } from '../../../ui/patterns';

/** Which window governs an application, and the changes held for it. */
@Component({
  selector: 'app-app-maintenance-card',
  imports: [
    MaintenanceWindowEditorComponent,
    DeferredListComponent,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Maintenance" data-testid="app-maintenance">
      <div panelActions class="fl-segmented" role="group" aria-label="Maintenance window">
        @for (m of modes; track m.value) {
          <button
            type="button"
            [attr.aria-pressed]="pressed() === m.value"
            (click)="choose(m.value)"
            [attr.data-testid]="'maintenance-mode-' + m.value"
          >
            {{ m.label }}
          </button>
        }
      </div>
      <div class="flex flex-col gap-4">
        @if (reading(); as r) {
          <fl-key-value>
            <fl-kv-item key="Window">{{ r.says }}</fl-kv-item>
            @if (r.nextOpening && r.mode !== 'anytime') {
              <fl-kv-item key="Next opening">{{ label(r.nextOpening) }}</fl-kv-item>
            }
          </fl-key-value>
        } @else {
          <fl-loading-state [rows]="2" />
        }
        @if (editingOwn()) {
          <app-maintenance-window-editor
            class="border-t border-fl-border pt-4"
            [value]="reading()?.window ?? null"
            [saving]="saving()"
            (saved)="saveOwn($event)"
            (cancelled)="editingOwn.set(false)"
          />
        }
      </div>
    </fl-panel>
    <app-deferred-list [rows]="held()" [cancellable]="true" (cancelAction)="cancel($event)" />
  `,
})
export class AppMaintenanceCardComponent {
  readonly appId = input<string | null>(null);
  private readonly api = inject(MaintenanceService);

  protected readonly modes: { value: AppMaintenanceMode; label: string }[] = [
    { value: 'follow', label: 'Follow cluster' },
    { value: 'own', label: 'Own window' },
    { value: 'anytime', label: 'Any time' },
  ];
  protected readonly reading = signal<AppMaintenance | null>(null);
  protected readonly held = signal<DeferredAction[]>([]);
  protected readonly editingOwn = signal(false);
  protected readonly saving = signal(false);
  protected readonly pressed = computed(() =>
    this.editingOwn() ? 'own' : (this.reading()?.mode ?? null),
  );
  protected label = openingLabel;

  constructor() {
    effect(() => {
      const id = this.appId();
      if (id) void this.load(id);
    });
  }

  /** Called by the proposal once a change is held, so the list shows it. */
  async reload(): Promise<void> {
    const id = this.appId();
    if (id) await this.load(id);
  }

  private async load(id: string): Promise<void> {
    try {
      const [reading, held] = await Promise.all([this.api.app(id), this.api.appDeferred(id)]);
      this.reading.set(reading);
      this.held.set(held);
    } catch {
      this.reading.set(null);
    }
  }

  protected async choose(mode: AppMaintenanceMode): Promise<void> {
    if (mode === 'own') {
      this.editingOwn.set(true);
      return;
    }
    const id = this.appId();
    if (!id) return;
    this.editingOwn.set(false);
    const written = await this.api.setApp(id, { mode });
    if (written) this.reading.set(written);
  }

  protected async saveOwn(window: MaintenanceWindow): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.saving.set(true);
    const written = await this.api.setApp(id, { mode: 'own', window });
    this.saving.set(false);
    if (written) {
      this.reading.set(written);
      this.editingOwn.set(false);
    }
  }

  protected async cancel(row: DeferredAction): Promise<void> {
    const id = this.appId();
    if (!id) return;
    if (await this.api.cancel(id, row.id)) await this.load(id);
  }
}
