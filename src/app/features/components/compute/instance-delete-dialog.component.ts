import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTriangleAlert,
  lucideX,
  lucideExternalLink,
  lucideLoader,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  HlmCardContentDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
} from '@spartan-ng/ui-card-helm';
import { InstanceWithLabels, getClusterInfo } from '../../model/instance.models';

@Component({
  selector: 'app-instance-delete-dialog',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    HlmButtonDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmCardContentDirective,
  ],
  providers: [
    provideIcons({
      lucideTriangleAlert,
      lucideX,
      lucideExternalLink,
      lucideLoader,
    }),
  ],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        (click)="onCancel()"
      >
        <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
          <div hlmCard (click)="$event.stopPropagation()">
            <div hlmCardHeader>
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <ng-icon
                      name="lucideTriangleAlert"
                      class="h-5 w-5 text-destructive"
                    />
                  </div>
                  <div>
                    <h2 hlmCardTitle class="text-xl">Delete Instance</h2>
                    <p hlmCardDescription>
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  (click)="onCancel()"
                  class="h-8 w-8 p-0"
                >
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div hlmCardContent class="space-y-4">
              <div class="space-y-2">
                <p class="text-sm text-foreground">
                  You are about to delete instance:
                </p>
                <div class="rounded-md bg-muted p-3">
                  <p class="font-semibold">{{ currentInstance()?.displayName || currentInstance()?.name }}</p>
                  <p class="text-sm text-muted-foreground font-mono">{{ currentInstance()?.name }}</p>
                </div>
              </div>

              @if (clusterInfo()) {
                <div class="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <div class="flex items-start gap-3">
                    <ng-icon
                      name="lucideTriangleAlert"
                      class="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
                    />
                    <div class="flex-1 space-y-2">
                      <p class="font-medium text-yellow-800 dark:text-yellow-200">
                        This server is part of a cluster
                      </p>
                      <div class="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        <p><strong>Cluster:</strong> {{ clusterInfo()?.clusterName }}</p>
                        <p><strong>Node Type:</strong> {{ clusterInfo()?.nodeType }}</p>
                      </div>
                      <p class="text-sm text-yellow-700 dark:text-yellow-300">
                        The recommended approach is to manage this server through the cluster.
                      </p>
                      <a
                        [routerLink]="['/cluster', clusterInfo()?.clusterId]"
                        class="inline-flex items-center gap-1 text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:underline"
                      >
                        Go to cluster dashboard
                        <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div class="flex items-start gap-2 rounded-md bg-muted p-3">
                  <input
                    type="checkbox"
                    id="force-delete"
                    class="mt-1 h-4 w-4 rounded border-input"
                    [checked]="forceDelete()"
                    (change)="toggleForceDelete()"
                  />
                  <label for="force-delete" class="text-sm cursor-pointer">
                    <span class="font-medium">Force delete</span>
                    <span class="block text-muted-foreground">
                      Delete this instance anyway, even though it's part of a cluster
                    </span>
                  </label>
                </div>
              }

              <div class="flex justify-end gap-2 pt-4">
                <button
                  hlmBtn
                  variant="outline"
                  (click)="onCancel()"
                  [disabled]="isDeleting"
                >
                  Cancel
                </button>
                <button
                  hlmBtn
                  variant="destructive"
                  (click)="onConfirm()"
                  [disabled]="(clusterInfo() && !forceDelete()) || isDeleting"
                >
                  @if (isDeleting) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  } @else {
                    Delete Instance
                  }
                </button>
              </div>
            </div>
          </div>
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

  @Input() isDeleting = false;

  @Output() confirmed = new EventEmitter<{ instance: InstanceWithLabels; force: boolean }>();
  @Output() cancelled = new EventEmitter<void>();

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
    this.forceDelete.update(v => !v);
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
