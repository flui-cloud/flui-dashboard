import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import {
  ClusterMaintenance,
  DeferredAction,
  MaintenanceService,
  MaintenanceWindow,
  openingLabel,
} from '../../service/maintenance.service';
import { MaintenanceWindowEditorComponent } from './maintenance-window-editor.component';
import { DeferredListComponent } from './deferred-list.component';
import { CanDirective } from '../../../core/directives/can.directive';

/** A cluster's maintenance window, its next opening and the changes held for it. */
@Component({
  selector: 'app-cluster-maintenance-card',
  standalone: true,
  imports: [MaintenanceWindowEditorComponent, DeferredListComponent, CanDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card-surface space-y-3 p-4" data-testid="cluster-maintenance">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="m-0 text-sm font-semibold text-foreground">Maintenance window</h3>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
            {{ reading()?.says ?? 'Reading…' }}
            @if (reading()?.nextOpening; as next) { · next {{ label(next) }} }
          </p>
        </div>
        @if (!editing()) {
          <div class="flex gap-2" *fluiCan="'cluster:manage'">
            <button type="button" class="text-[13px] text-primary hover:underline" (click)="editing.set(true)" data-testid="maintenance-edit">
              {{ reading()?.window ? 'Change' : 'Set a window' }}
            </button>
            @if (reading()?.window) {
              <button type="button" class="text-[13px] text-muted-foreground hover:text-destructive" (click)="clear()">Remove</button>
            }
          </div>
        }
      </div>
      @if (editing()) {
        <app-maintenance-window-editor [value]="reading()?.window ?? null" [saving]="saving()" (saved)="save($event)" (cancelled)="editing.set(false)" />
      }
      <app-deferred-list [rows]="held()" />
    </section>
  `,
})
export class ClusterMaintenanceCardComponent {
  readonly clusterId = input<string | null>(null);
  private readonly api = inject(MaintenanceService);

  protected readonly reading = signal<ClusterMaintenance | null>(null);
  protected readonly held = signal<DeferredAction[]>([]);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected label = openingLabel;

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const [reading, held] = await Promise.all([this.api.cluster(id), this.api.clusterDeferred(id)]);
      this.reading.set(reading);
      this.held.set(held);
    } catch {
      this.reading.set(null);
    }
  }

  protected async save(window: MaintenanceWindow): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.saving.set(true);
    const written = await this.api.setCluster(id, window);
    this.saving.set(false);
    if (written) {
      this.reading.set(written);
      this.editing.set(false);
    }
  }

  protected async clear(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    const written = await this.api.clearCluster(id);
    if (written) this.reading.set(written);
  }
}
