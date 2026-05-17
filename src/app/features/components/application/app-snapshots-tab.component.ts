import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCamera,
  lucideCircleAlert,
  lucideLoader,
  lucidePlus,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationSnapshotsService } from '../../service/application-snapshots.service';
import {
  ApplicationSnapshot,
  SnapshotStatus,
  getSnapshotKind,
  snapshotSizeLabel,
  snapshotStatus,
} from '../../model/volume-management.models';

type StatusFilter = 'all' | SnapshotStatus;

@Component({
  selector: 'app-snapshots-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideCamera,
      lucidePlus,
      lucideRefreshCw,
      lucideTrash2,
      lucideX,
      lucideLoader,
      lucideCircleAlert,
      lucideRotateCcw,
    }),
  ],
  template: `
    <div class="space-y-6">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <ng-icon name="lucideCamera" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Snapshots
          </h2>
          <p class="text-sm text-muted-foreground mt-0.5">
            Point-in-time copies of this app's data. They live on the same disk that hosts the app, so they take up space there.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <select
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
            class="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All</option>
            <option value="READY">Ready</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="DELETING">Deleting</option>
          </select>
          <button
            (click)="refresh()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="isLoading()"
            />
            Refresh
          </button>
          <button
            (click)="openCreateDialog()"
            [disabled]="!appId() || creating()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
            Create snapshot
          </button>
        </div>
      </div>

      <!-- Error -->
      @if (errorMessage()) {
        <div class="card-surface p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage() }}</p>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (isLoading() && snapshots().length === 0) {
        <div class="animate-pulse space-y-2">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton h-12 rounded-lg"></div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <!-- Empty -->
        <div class="card-inner p-8 text-center">
          <ng-icon name="lucideCamera" class="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p class="text-sm font-medium">
            @if (filter() === 'all') {
              No snapshots yet
            } @else {
              No snapshots match the selected filter
            }
          </p>
          @if (filter() === 'all') {
            <p class="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Create a snapshot to capture the current state of this application's volume.
              Snapshots consume disk space inside the cluster's shared volume.
            </p>
          }
        </div>
      } @else {
        <div class="card-inner overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted-foreground border-b border-border">
                <th class="px-4 py-3 font-normal">Created</th>
                <th class="px-4 py-3 font-normal">PVC</th>
                <th class="px-4 py-3 font-normal">Type</th>
                <th class="px-4 py-3 font-normal">Status</th>
                <th class="px-4 py-3 font-normal text-right">Size</th>
                <th class="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              @for (snap of filtered(); track snap.exportId) {
                @let st = derivedStatus(snap);
                <tr class="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {{ formatDate(snap.createdAt) }}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs">{{ snap.sourcePvcName || '—' }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      [class]="kindBadgeClass(snap)"
                      [title]="kindTooltip(snap)"
                    >
                      {{ kindLabel(snap) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs flex items-center gap-1.5" [class]="statusClass(st)">
                      @if (st === 'PENDING' || st === 'DELETING') {
                        <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                      }
                      {{ statusLabel(snap) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <div class="text-sm">{{ sizeLine(snap) }}</div>
                    @if (sizeSubline(snap); as sub) {
                      <div class="text-[11px] text-muted-foreground">{{ sub }}</div>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="inline-flex items-center gap-1">
                      <button
                        (click)="confirmRestore(snap)"
                        [disabled]="!snap.ready || st === 'DELETING' || isRestoring(snap.exportId)"
                        class="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-50"
                        title="Restore snapshot"
                      >
                        @if (isRestoring(snap.exportId)) {
                          <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                        } @else {
                          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                        }
                      </button>
                      <button
                        (click)="confirmDelete(snap)"
                        [disabled]="st === 'DELETING' || isDeleting(snap.exportId)"
                        class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete snapshot"
                      >
                        <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Create dialog -->
    @if (createOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="closeCreateDialog()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold">Create snapshot</h3>
              <p class="text-xs text-muted-foreground mt-1">
                Captures the current data of this application's volume.
              </p>
            </div>
            <button (click)="closeCreateDialog()" class="p-1 hover:bg-muted rounded">
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium mb-1 block" for="snapshot-description">Description (optional)</label>
              <input
                id="snapshot-description"
                type="text"
                [ngModel]="formDescription()"
                (ngModelChange)="formDescription.set($event)"
                placeholder="e.g. before-major-upgrade"
                maxlength="120"
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block" for="snapshot-pvc">PVC name (optional)</label>
              <input
                id="snapshot-pvc"
                type="text"
                [ngModel]="formPvcName()"
                (ngModelChange)="formPvcName.set($event)"
                placeholder="leave empty if the app has a single volume"
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono text-xs"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="closeCreateDialog()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="submitCreate()"
              [disabled]="creating()"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (creating()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Creating…
              } @else {
                Create
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirmation -->
    @if (pendingDelete(); as snap) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelDelete()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-semibold">Delete snapshot</h3>
          <p class="text-sm text-muted-foreground mt-2">
            This will permanently remove the snapshot.
            <span class="block mt-1 text-xs font-mono">{{ snap.exportId }}</span>
          </p>
          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="cancelDelete()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="executeDelete()"
              [disabled]="isDeleting(snap.exportId)"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (isDeleting(snap.exportId)) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Deleting…
              } @else {
                <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                Delete
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Restore confirmation -->
    @if (pendingRestore(); as snap) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelRestore()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-semibold">Restore snapshot</h3>
          <p class="text-sm text-muted-foreground mt-2">
            Creates a brand-new PVC with the data from this snapshot. Your live application is NOT affected.
            <span class="block mt-1 text-xs font-mono break-all">{{ snap.exportId }}</span>
          </p>
          <label class="flex items-start gap-2 mt-4 text-sm cursor-pointer">
            <input
              type="checkbox"
              [checked]="restoreAndSwap()"
              (change)="restoreAndSwap.set(!restoreAndSwap())"
              class="mt-0.5"
            />
            <span>
              Also swap the live application to the new PVC
              <span class="block text-xs text-muted-foreground mt-0.5">
                Triggers a rolling restart. The current PVC stays in the cluster as a backup.
              </span>
            </span>
          </label>
          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="cancelRestore()"
              [disabled]="restoring()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              (click)="executeRestore()"
              [disabled]="restoring()"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (restoring()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                {{ restoreAndSwap() ? 'Restoring & swapping…' : 'Restoring…' }}
              } @else {
                <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                {{ restoreAndSwap() ? 'Restore & swap' : 'Restore' }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppSnapshotsTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly snapshotsService = inject(ApplicationSnapshotsService);

  readonly snapshots = this.snapshotsService.snapshots;
  readonly isLoading = this.snapshotsService.loading;
  readonly creating = this.snapshotsService.creating;
  readonly deletingId = this.snapshotsService.deletingId;
  readonly errorMessage = this.snapshotsService.error;

  readonly filter = signal<StatusFilter>('all');
  readonly createOpen = signal(false);
  readonly formDescription = signal('');
  readonly formPvcName = signal('');
  readonly pendingDelete = signal<ApplicationSnapshot | null>(null);
  readonly pendingRestore = signal<ApplicationSnapshot | null>(null);
  readonly restoreAndSwap = signal(false);
  readonly restoring = signal(false);
  readonly restoringSnapshotId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.snapshots();
    return f === 'all' ? list : list.filter((s) => snapshotStatus(s) === f);
  });

  readonly appId = (): string | null => this.appService.selectedApplication()?.id ?? null;

  ngOnInit(): void {
    void (async () => {
      const id = this.appId();
      if (id) {
        await this.snapshotsService.loadForApp(id);
      }
    })();
  }

  ngOnDestroy(): void {
    this.snapshotsService.reset();
  }

  async refresh(): Promise<void> {
    const id = this.appId();
    if (id) {
      await this.snapshotsService.loadForApp(id);
    }
  }

  openCreateDialog(): void {
    this.formDescription.set('');
    this.formPvcName.set('');
    this.createOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createOpen.set(false);
  }

  async submitCreate(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const description = this.formDescription().trim();
    const volumeName = this.formPvcName().trim();
    const result = await this.snapshotsService.create(id, {
      description: description || undefined,
      volumeName: volumeName || undefined,
    });
    if (result) {
      this.closeCreateDialog();
    }
  }

  confirmDelete(snap: ApplicationSnapshot): void {
    this.pendingDelete.set(snap);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async executeDelete(): Promise<void> {
    const snap = this.pendingDelete();
    const id = this.appId();
    if (!snap || !id) return;
    const ok = await this.snapshotsService.delete(id, snap.exportId);
    if (ok) {
      this.pendingDelete.set(null);
    }
  }

  isDeleting(snapshotId: string): boolean {
    return this.deletingId() === snapshotId;
  }

  isRestoring(snapshotId: string): boolean {
    return this.restoringSnapshotId() === snapshotId;
  }

  confirmRestore(snap: ApplicationSnapshot): void {
    this.restoreAndSwap.set(false);
    this.pendingRestore.set(snap);
  }

  cancelRestore(): void {
    if (this.restoring()) return;
    this.pendingRestore.set(null);
  }

  async executeRestore(): Promise<void> {
    const snap = this.pendingRestore();
    const id = this.appId();
    if (!snap || !id) return;
    this.restoring.set(true);
    this.restoringSnapshotId.set(snap.exportId);
    try {
      const result = await this.snapshotsService.restore(id, snap.exportId);
      if (!result) return;
      if (this.restoreAndSwap()) {
        await this.snapshotsService.swap(id, 'data', result.newPvcName);
      }
      this.pendingRestore.set(null);
      await this.snapshotsService.loadForApp(id);
    } finally {
      this.restoring.set(false);
      this.restoringSnapshotId.set(null);
    }
  }

  kindLabel(snap: ApplicationSnapshot): string {
    return getSnapshotKind(snap);
  }

  kindTooltip(snap: ApplicationSnapshot): string {
    return getSnapshotKind(snap) === 'native'
      ? 'CSI VolumeSnapshot — block-level diff against the source volume.'
      : 'Copy-pod fallback — full file-level copy of the PVC, consumes equivalent space in the shared volume.';
  }

  kindBadgeClass(snap: ApplicationSnapshot): string {
    return getSnapshotKind(snap) === 'native'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }

  derivedStatus(snap: ApplicationSnapshot): SnapshotStatus {
    return snapshotStatus(snap);
  }

  statusLabel(snap: ApplicationSnapshot): string {
    const st = snapshotStatus(snap);
    if (st === 'PENDING') {
      return getSnapshotKind(snap) === 'clone' ? 'Copying data…' : 'Snapshotting…';
    }
    if (st === 'DELETING') return 'Deleting…';
    if (st === 'READY') return 'Ready';
    return st;
  }

  /**
   * Headline size for the row. Prefers the real on-disk usage when the
   * backend reported it; falls back to the PVC capacity. Always shows
   * something — never the raw "1 GB" with no context.
   */
  sizeLine(snap: ApplicationSnapshot): string {
    return snapshotSizeLabel(snap).headline;
  }

  sizeSubline(snap: ApplicationSnapshot): string | null {
    return snapshotSizeLabel(snap).subline;
  }

  statusClass(status: SnapshotStatus): string {
    switch (status) {
      case 'READY':
        return 'text-green-600 dark:text-green-400 font-medium';
      case 'PENDING':
        return 'text-blue-600 dark:text-blue-400';
      case 'FAILED':
        return 'text-red-600 dark:text-red-400 font-medium';
      case 'DELETING':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-muted-foreground';
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }
}
