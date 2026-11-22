import { Component, Input, signal, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { InstanceWithLabels, getClusterInfo } from '../../model/instance.models';

@Component({
  selector: 'app-instance-delete-dialog',
  imports: [RouterLink, FlAlert, FlKeyValue, FlKvItem, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (isOpen()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="onCancel()"
      >
        <div
          class="fl-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="instance-delete-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="instance-delete-title">
              Delete {{ currentInstance()?.displayName || currentInstance()?.name }}
            </h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              [disabled]="isDeleting()"
              (click)="onCancel()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>This deletes the server at the provider. It cannot be undone.</p>
            <p class="fl-mono text-fl-ink-muted">{{ currentInstance()?.name }}</p>

            @if (clusterInfo(); as cluster) {
              <fl-alert tone="warning" title="This server is part of a cluster">
                Manage it through the cluster instead.
                <a alertActions flButton size="sm" [routerLink]="['/cluster', cluster.clusterId]"
                  >Open cluster</a
                >
              </fl-alert>
              <fl-key-value>
                <fl-kv-item key="Cluster">{{ cluster.clusterName }}</fl-kv-item>
                <fl-kv-item key="Node type">{{ cluster.nodeType }}</fl-kv-item>
              </fl-key-value>
              <label class="fl-check">
                <input
                  type="checkbox"
                  [checked]="forceDelete()"
                  [disabled]="isDeleting()"
                  (change)="toggleForceDelete()"
                />
                <span>Force delete, even though it is part of a cluster</span>
              </label>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="isDeleting()" (click)="onCancel()">
              Cancel
            </button>
            <button
              flButton="danger"
              type="button"
              [disabled]="(clusterInfo() && !forceDelete()) || isDeleting()"
              (click)="onConfirm()"
            >
              @if (isDeleting()) {
                <fl-spinner label="Deleting" />
                Deleting…
              } @else {
                Delete instance
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class InstanceDeleteDialogComponent {
  @Input({ required: true }) set instance(value: InstanceWithLabels | null) {
    this._instance.set(value);
    this._clusterInfo.set(value ? getClusterInfo(value) : null);
  }

  readonly isDeleting = input(false);

  readonly confirmed = output<{
    instance: InstanceWithLabels;
    force: boolean;
  }>();
  readonly cancelled = output<void>();

  private readonly _instance = signal<InstanceWithLabels | null>(null);
  private readonly _clusterInfo = signal<ReturnType<typeof getClusterInfo>>(null);

  isOpen = signal(false);
  forceDelete = signal(false);

  currentInstance = this._instance.asReadonly();
  clusterInfo = this._clusterInfo.asReadonly();

  open() {
    this.isOpen.set(true);
    this.forceDelete.set(false);
  }

  close() {
    this.isOpen.set(false);
    this.forceDelete.set(false);
  }

  toggleForceDelete() {
    this.forceDelete.update((v) => !v);
  }

  onConfirm() {
    const inst = this._instance();
    if (inst) {
      this.confirmed.emit({ instance: inst, force: this.forceDelete() });
      this.close();
    }
  }

  onCancel() {
    this.cancelled.emit();
    this.close();
  }
}
