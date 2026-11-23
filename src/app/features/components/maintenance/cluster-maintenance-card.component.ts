import { Component, effect, inject, input, signal } from '@angular/core';
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
import { FlErrorState, FlKeyValue, FlKvItem, FlLoadingState, FlPanel } from '../../../ui/patterns';
import { FlButton } from '../../../ui/primitives';

/** A cluster's maintenance window, its next opening and the changes held for it. */
@Component({
  selector: 'app-cluster-maintenance-card',
  imports: [
    MaintenanceWindowEditorComponent,
    DeferredListComponent,
    CanDirective,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlErrorState,
    FlButton,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Maintenance window" data-testid="cluster-maintenance">
      @if (!editing()) {
        <ng-container ngProjectAs="[panelActions]">
          <div class="fl-row" *fluiCan="'cluster:manage'">
            @if (reading()?.window) {
              <button flButton="ghost" size="sm" type="button" (click)="clear()">Remove</button>
            }
            <button
              flButton
              size="sm"
              type="button"
              (click)="editing.set(true)"
              data-testid="maintenance-edit"
            >
              {{ reading()?.window ? 'Change' : 'Set a window' }}
            </button>
          </div>
        </ng-container>
      }
      <div class="flex flex-col gap-4">
        @if (reading(); as r) {
          <fl-key-value>
            <fl-kv-item key="Window">{{ r.says }}</fl-kv-item>
            @if (r.nextOpening; as next) {
              <fl-kv-item key="Next opening">{{ label(next) }}</fl-kv-item>
            }
          </fl-key-value>
        } @else if (failed()) {
          <fl-error-state
            title="Could not read the maintenance window"
            [compact]="true"
            (retry)="retry()"
          />
        } @else {
          <fl-loading-state [rows]="2" />
        }
        @if (editing()) {
          <app-maintenance-window-editor
            class="border-t border-fl-border pt-4"
            [value]="reading()?.window ?? null"
            [saving]="saving()"
            (saved)="save($event)"
            (cancelled)="editing.set(false)"
          />
        }
      </div>
    </fl-panel>
    <app-deferred-list [rows]="held()" />
  `,
})
export class ClusterMaintenanceCardComponent {
  readonly clusterId = input<string | null>(null);
  private readonly api = inject(MaintenanceService);

  protected readonly reading = signal<ClusterMaintenance | null>(null);
  protected readonly held = signal<DeferredAction[]>([]);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected label = openingLabel;

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) void this.load(id);
    });
  }

  protected retry(): void {
    const id = this.clusterId();
    if (id) void this.load(id);
  }

  private async load(id: string): Promise<void> {
    try {
      const [reading, held] = await Promise.all([
        this.api.cluster(id),
        this.api.clusterDeferred(id),
      ]);
      this.reading.set(reading);
      this.held.set(held);
      this.failed.set(false);
    } catch {
      this.reading.set(null);
      this.failed.set(true);
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
