import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
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

/** Which window governs an application, and the changes held for it. */
@Component({
  selector: 'app-app-maintenance-card',
  standalone: true,
  imports: [MaintenanceWindowEditorComponent, DeferredListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-lg border border-border p-4 space-y-3" data-testid="app-maintenance">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <h3 class="m-0 text-sm font-semibold text-foreground">Maintenance</h3>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
            {{ reading()?.says ?? 'Reading…' }}
            @if (reading()?.nextOpening && reading()?.mode !== 'anytime') { · next {{ label(reading()!.nextOpening) }} }
          </p>
        </div>
        <div class="inline-flex rounded-md border border-border p-0.5 text-[12px]" role="group" aria-label="Maintenance window">
          @for (m of modes; track m.value) {
            <button type="button" class="rounded px-2 py-0.5"
              [class]="reading()?.mode === m.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'"
              (click)="choose(m.value)" [attr.data-testid]="'maintenance-mode-' + m.value">{{ m.label }}</button>
          }
        </div>
      </div>
      @if (editingOwn()) {
        <app-maintenance-window-editor [value]="reading()?.window ?? null" [saving]="saving()" (saved)="saveOwn($event)" (cancelled)="editingOwn.set(false)" />
      }
      <app-deferred-list [rows]="held()" [cancellable]="true" (cancelAction)="cancel($event)" />
    </section>
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
