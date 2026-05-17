import { Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDatabase,
  lucideRefreshCw,
  lucideTrash2,
  lucideCheck,
  lucideTriangleAlert,
  lucideX,
  lucideLoader,
  lucideBarChart2,
} from '@ng-icons/lucide';
import { BuildCacheService } from '../../service/build-cache.service';
import { BuildCacheInfoResponseDto } from '../../../core/api/model/buildCacheInfoResponseDto';

function getCachePhaseClass(phase: BuildCacheInfoResponseDto.PhaseEnum | null): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  switch (phase) {
    case 'Bound':   return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
    case 'Pending': return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
    case 'Lost':    return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
    default:        return `${base} bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400`;
  }
}

@Component({
  selector: 'app-build-cache-panel',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideDatabase, lucideRefreshCw, lucideTrash2,
      lucideCheck, lucideTriangleAlert, lucideX, lucideLoader, lucideBarChart2,
    }),
  ],
  template: `
    <div class="bg-card border border-border rounded-lg p-4 space-y-4">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-sm flex items-center gap-2">
          <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground" />
          Build Cache (BuildKit PVC)
        </h3>
        <button (click)="refresh()" [disabled]="isLoading()"
          class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          <ng-icon name="lucideRefreshCw" [class]="isLoading() ? 'animate-spin' : ''" class="h-3.5 w-3.5 mr-1" />
          Refresh
        </button>
      </div>

      <!-- Status error -->
      @if (statusError()) {
        <div class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
          {{ statusError() }}
        </div>
      }

      <!-- Loading skeleton -->
      @if (isLoading() && !status()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Loading cache status...
        </div>
      }

      <!-- No PVC -->
      @if (!isLoading() && status() && !status()!.exists) {
        <p class="text-sm text-muted-foreground">
          No cache PVC provisioned. It will be created automatically on the first build.
        </p>
      }

      <!-- PVC details -->
      @if (status()?.exists) {
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div class="space-y-0.5">
            <p class="text-xs text-muted-foreground">PVC Name</p>
            <p class="font-mono text-xs">{{ status()!.pvcName }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-xs text-muted-foreground">Phase</p>
            <span [class]="getCachePhaseClass(status()!.phase)">{{ status()!.phase ?? '—' }}</span>
          </div>
          <div class="space-y-0.5">
            <p class="text-xs text-muted-foreground">Capacity</p>
            <p class="font-medium">{{ status()!.capacity ?? '—' }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-xs text-muted-foreground">Storage Class</p>
            <p class="font-mono text-xs">{{ status()!.storageClass ?? '—' }}</p>
          </div>
        </div>
        @if (status()!.createdAt) {
          <p class="text-xs text-muted-foreground">
            Created {{ status()!.createdAt | date:'medium' }}
          </p>
        }

        <!-- Cache Contents breakdown -->
        @if (breakdown()) {
          <div class="border-t border-border pt-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-medium flex items-center gap-1.5">
                  <ng-icon name="lucideBarChart2" class="h-3.5 w-3.5 text-muted-foreground" />
                  Cache Contents
                </span>
                @switch (breakdown()!.scanStatus) {
                  @case ('ok') {
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Scanned</span>
                  }
                  @case ('in_progress') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />Scanning...
                    </span>
                  }
                  @case ('failed') {
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Scan failed</span>
                  }
                  @case ('pending') {
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not scanned yet</span>
                  }
                }
                @if (breakdown()!.scannedAt) {
                  <span class="text-xs text-muted-foreground">· {{ breakdown()!.scannedAt | date:'short' }}</span>
                }
              </div>
              <button (click)="scanCache()"
                [disabled]="isRefreshingBreakdown() || breakdown()!.scanStatus === 'in_progress'"
                class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors ml-2 flex-shrink-0">
                <ng-icon name="lucideRefreshCw" [class]="isRefreshingBreakdown() ? 'animate-spin' : ''" class="h-3.5 w-3.5 mr-1" />
                Scan
              </button>
            </div>

            @if (refreshSkipped()) {
              <p class="text-xs text-amber-600 dark:text-amber-400">
                Scan skipped: {{ refreshSkippedReason() ?? 'build in progress or scan already running' }}
              </p>
            }

            @if (breakdownError()) {
              <p class="text-xs text-red-600 dark:text-red-400">{{ breakdownError() }}</p>
            }

            @if (breakdown()!.scanStatus === 'ok' && breakdown()!.totalHumanSize) {
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="space-y-0.5">
                  <p class="text-muted-foreground">Total</p>
                  <p class="font-semibold">{{ breakdown()!.totalHumanSize }}</p>
                </div>
                <div class="space-y-0.5">
                  <p class="text-muted-foreground">Layers</p>
                  <p class="font-medium">{{ breakdown()!.layers.humanSize ?? '—' }}</p>
                </div>
                <div class="space-y-0.5">
                  <p class="text-muted-foreground">Package Caches</p>
                  <p class="font-medium">{{ breakdown()!.packageCachesTotalHumanSize ?? '—' }}</p>
                </div>
              </div>

              @if (breakdown()!.packageCaches.length > 0) {
                <div>
                  @for (pkg of breakdown()!.packageCaches; track pkg.id) {
                    <div class="flex items-center justify-between text-xs py-1.5 border-t border-border/50">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="font-mono font-medium shrink-0">{{ pkg.id }}</span>
                        <span class="text-muted-foreground truncate">{{ pkg.mountPath }}</span>
                      </div>
                      <span class="font-medium tabular-nums ml-3 shrink-0">{{ pkg.humanSize }}</span>
                    </div>
                  }
                </div>
              }
            }
          </div>
        } @else if (!isLoadingBreakdown()) {
          <div class="border-t border-border pt-4">
            <button (click)="scanCache()" [disabled]="isRefreshingBreakdown()"
              class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">
              <ng-icon name="lucideRefreshCw" [class]="isRefreshingBreakdown() ? 'animate-spin' : ''" class="h-3.5 w-3.5 mr-1" />
              Scan cache contents
            </button>
          </div>
        }
      }

      <!-- Action area -->
      @if (!isClearingCache() && !clearResult()) {
        @if (!showConfirmClear()) {
          <div class="pt-1">
            <button
              (click)="showConfirmClear.set(true)"
              [disabled]="!status()?.exists"
              class="inline-flex items-center px-3 py-1.5 rounded-md border border-input bg-background text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ng-icon name="lucideTrash2" class="h-4 w-4 mr-1.5 text-red-500" />
              Clear Cache
            </button>
          </div>
        } @else {
          <div class="flex items-center gap-3 pt-1 flex-wrap">
            <span class="text-sm text-muted-foreground">
              This will delete and recreate the BuildKit PVC. The cache will be rebuilt on the next build.
            </span>
            <div class="flex items-center gap-2 ml-auto">
              <button (click)="confirmClear()"
                class="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                Confirm Clear
              </button>
              <button (click)="showConfirmClear.set(false)"
                class="inline-flex items-center px-3 py-1.5 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
                Cancel
              </button>
            </div>
          </div>
        }
      }

      <!-- Clear progress -->
      @if (isClearingCache()) {
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ clearMessage() }}</span>
            <span>Step {{ clearStepIndex() + 1 }} of {{ clearTotalSteps() }}</span>
          </div>
          <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              [style.width.%]="clearProgress()"></div>
          </div>
          <p class="text-xs text-muted-foreground">{{ clearProgress() }}%</p>
        </div>
      }

      <!-- Success banner -->
      @if (clearResult() === 'success') {
        <div class="flex items-center justify-between gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideCheck" class="h-4 w-4 flex-shrink-0" />
            Cache cleared. It will be recreated automatically on the next build.
          </div>
          <button (click)="dismiss()" class="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 flex-shrink-0">
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>
      }

      <!-- Error banner -->
      @if (clearResult() === 'failed') {
        <div class="flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
            {{ clearError() ?? 'Cache clear failed.' }}
          </div>
          <button (click)="dismiss()" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 flex-shrink-0">
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>
      }

    </div>
  `,
})
export class BuildCachePanelComponent implements OnDestroy {
  private readonly cacheService = inject(BuildCacheService);

  readonly clusterId = input.required<string>();

  readonly status              = this.cacheService.cacheStatus;
  readonly isLoading           = this.cacheService.isLoadingStatus;
  readonly isClearingCache     = this.cacheService.isClearingCache;
  readonly clearProgress       = this.cacheService.clearProgress;
  readonly clearMessage        = this.cacheService.clearMessage;
  readonly clearStepIndex      = this.cacheService.clearStepIndex;
  readonly clearTotalSteps     = this.cacheService.clearTotalSteps;
  readonly clearResult         = this.cacheService.clearResult;
  readonly clearError          = this.cacheService.clearError;
  readonly statusError         = this.cacheService.statusError;
  readonly breakdown           = this.cacheService.breakdown;
  readonly isLoadingBreakdown  = this.cacheService.isLoadingBreakdown;
  readonly isRefreshingBreakdown = this.cacheService.isRefreshingBreakdown;
  readonly breakdownError      = this.cacheService.breakdownError;
  readonly refreshSkipped      = this.cacheService.refreshSkipped;
  readonly refreshSkippedReason = this.cacheService.refreshSkippedReason;

  readonly showConfirmClear = signal(false);
  readonly getCachePhaseClass = getCachePhaseClass;

  private readonly clusterEffect = effect(() => {
    const id = this.clusterId();
    this.cacheService.resetClearState();
    this.showConfirmClear.set(false);
    this.cacheService.loadCacheStatus(id);
    this.cacheService.loadCacheBreakdown(id);
  });

  refresh(): void {
    const id = this.clusterId();
    this.cacheService.loadCacheStatus(id);
    this.cacheService.loadCacheBreakdown(id);
  }

  scanCache(): void {
    this.cacheService.refreshCacheBreakdown(this.clusterId());
  }

  confirmClear(): void {
    this.showConfirmClear.set(false);
    this.cacheService.clearCache(this.clusterId());
  }

  dismiss(): void {
    this.cacheService.resetClearState();
  }

  ngOnDestroy(): void {
    this.cacheService.resetClearState();
    this.clusterEffect.destroy();
  }
}
