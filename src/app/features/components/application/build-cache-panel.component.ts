import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase, lucideRefreshCw } from '@ng-icons/lucide';
import { BuildCacheService } from '../../service/build-cache.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { cachePhaseStatus, cacheUsagePercent, scanStatus } from './build-namespace-format';

@Component({
  selector: 'app-build-cache-panel',
  imports: [
    DatePipe,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlUsageBar,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideDatabase, lucideRefreshCw })],
  template: `
    <fl-panel title="Build cache">
      <div panelActions class="fl-row">
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [disabled]="isLoading()"
          (click)="refresh()"
        >
          <fl-icon name="lucideRefreshCw" [size]="14" />
          Refresh
        </button>
        <button
          flButton
          size="sm"
          type="button"
          data-testid="build-cache-clear"
          [disabled]="!status()?.exists || isClearingCache() || !!clearResult()"
          (click)="askClear()"
        >
          Clear cache
        </button>
      </div>

      <div class="flex flex-col gap-4">
        @if (refusal()) {
          <fl-alert data-testid="build-cache-refused" tone="info" title="Not available">
            {{ refusal() }}
          </fl-alert>
        }

        @if (statusError()) {
          <fl-alert tone="error" title="Could not load the cache">{{ statusError() }}</fl-alert>
        }

        @if (isClearingCache()) {
          <div class="flex flex-wrap items-center gap-3">
            <fl-status role="status" tone="progress" [label]="clearMessage()" />
            <span class="fl-mono text-fl-ink-muted"
              >Step {{ clearStepIndex() + 1 }} of {{ clearTotalSteps() }} ·
              {{ clearProgress() }}%</span
            >
          </div>
        }

        @if (clearResult() === 'success') {
          <fl-alert tone="info" title="Cache cleared">
            It is created again on the next build.
            <ng-container alertActions>
              <button flButton="ghost" size="sm" type="button" (click)="dismiss()">Dismiss</button>
            </ng-container>
          </fl-alert>
        }

        @if (clearResult() === 'failed') {
          <fl-alert tone="error" title="Could not clear the cache">
            {{ clearError() ?? 'Cache clear failed.' }}
            <ng-container alertActions>
              <button flButton="ghost" size="sm" type="button" (click)="dismiss()">Dismiss</button>
            </ng-container>
          </fl-alert>
        }

        @if (isLoading() && !status()) {
          <fl-loading-state [rows]="3" />
        } @else if (status() && !status()!.exists) {
          <fl-empty-state
            icon="lucideDatabase"
            [compact]="true"
            title="No cache volume yet"
            body="It is created on the first build."
          />
        }

        @if (status()?.exists) {
          @let s = status()!;
          @let phase = cachePhase();
          @if (usage() !== null) {
            <fl-usage-bar
              label="Cache size"
              [percent]="usage()!"
              [aside]="(breakdown()?.totalHumanSize ?? '—') + ' of ' + (s.capacity ?? '—')"
            />
          }
          <fl-key-value>
            <fl-kv-item key="Volume claim" [mono]="true">{{ s.pvcName }}</fl-kv-item>
            <fl-kv-item key="Phase"
              ><fl-status [tone]="phase.tone" [label]="phase.label"
            /></fl-kv-item>
            <fl-kv-item key="Capacity">{{ s.capacity ?? '—' }}</fl-kv-item>
            <fl-kv-item key="Storage class" [mono]="true">{{ s.storageClass ?? '—' }}</fl-kv-item>
            <fl-kv-item key="Created">{{
              s.createdAt ? (s.createdAt | date: 'medium') : '—'
            }}</fl-kv-item>
          </fl-key-value>

          <div class="flex flex-col gap-3 border-t border-fl-border pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="fl-row">
                <span class="text-fl-body-sm font-semibold">Contents</span>
                @if (breakdown(); as b) {
                  @let scan = scanState()!;
                  <fl-status [tone]="scan.tone" [label]="scan.label" />
                  @if (b.scannedAt) {
                    <span class="text-fl-body-sm text-fl-ink-muted">{{
                      b.scannedAt | date: 'short'
                    }}</span>
                  }
                }
              </div>
              @if (breakdown() || !isLoadingBreakdown()) {
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [disabled]="isRefreshingBreakdown() || breakdown()?.scanStatus === 'in_progress'"
                  (click)="scanCache()"
                >
                  <fl-icon name="lucideRefreshCw" [size]="14" />
                  {{ breakdown() ? 'Scan' : 'Scan cache contents' }}
                </button>
              }
            </div>

            @if (refreshSkipped()) {
              <fl-alert tone="warning" title="Scan skipped">
                {{
                  refreshSkippedReason() ?? 'A build is in progress or a scan is already running.'
                }}
              </fl-alert>
            }

            @if (breakdownError()) {
              <fl-alert tone="error" title="Could not scan the cache">{{
                breakdownError()
              }}</fl-alert>
            }

            @if (breakdown(); as b) {
              @if (b.scanStatus === 'ok' && b.totalHumanSize) {
                <fl-key-value class="fl-kv--compact">
                  <fl-kv-item key="Total">{{ b.totalHumanSize }}</fl-kv-item>
                  <fl-kv-item key="Layers">{{ b.layers.humanSize ?? '—' }}</fl-kv-item>
                  <fl-kv-item key="Package caches">{{
                    b.packageCachesTotalHumanSize ?? '—'
                  }}</fl-kv-item>
                </fl-key-value>

                @if (b.packageCaches.length > 0) {
                  <div class="fl-table-wrap">
                    <table flTable density="dense">
                      <thead>
                        <tr>
                          <th scope="col">Cache</th>
                          <th scope="col">Mount path</th>
                          <th scope="col" class="is-num">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (pkg of b.packageCaches; track pkg.id) {
                          <tr>
                            <td class="fl-mono">{{ pkg.id }}</td>
                            <td class="fl-mono">{{ pkg.mountPath }}</td>
                            <td class="is-num">{{ pkg.humanSize }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class BuildCachePanelComponent implements OnDestroy {
  private readonly cacheService = inject(BuildCacheService);
  private readonly confirmService = inject(ConfirmService);

  readonly clusterId = input.required<string>();

  readonly status = this.cacheService.cacheStatus;
  readonly isLoading = this.cacheService.isLoadingStatus;
  readonly isClearingCache = this.cacheService.isClearingCache;
  readonly clearProgress = this.cacheService.clearProgress;
  readonly clearMessage = this.cacheService.clearMessage;
  readonly clearStepIndex = this.cacheService.clearStepIndex;
  readonly clearTotalSteps = this.cacheService.clearTotalSteps;
  readonly clearResult = this.cacheService.clearResult;
  readonly clearError = this.cacheService.clearError;
  readonly statusError = this.cacheService.statusError;
  readonly refusal = this.cacheService.refusal;
  readonly breakdown = this.cacheService.breakdown;
  readonly isLoadingBreakdown = this.cacheService.isLoadingBreakdown;
  readonly isRefreshingBreakdown = this.cacheService.isRefreshingBreakdown;
  readonly breakdownError = this.cacheService.breakdownError;
  readonly refreshSkipped = this.cacheService.refreshSkipped;
  readonly refreshSkippedReason = this.cacheService.refreshSkippedReason;

  readonly showConfirmClear = signal(false);

  protected readonly cachePhase = computed(() => cachePhaseStatus(this.status()?.phase ?? null));
  protected readonly scanState = computed(() => {
    const b = this.breakdown();
    return b ? scanStatus(b.scanStatus) : null;
  });
  protected readonly usage = computed(() => {
    const b = this.breakdown();
    if (b?.scanStatus !== 'ok') return null;
    return cacheUsagePercent(b.totalSizeBytes, this.status()?.capacity ?? null);
  });

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

  async askClear(): Promise<void> {
    this.showConfirmClear.set(true);
    const ok = await this.confirmService.confirm({
      title: 'Clear build cache',
      body: 'This deletes and recreates the cache volume. Cached layers and packages are gone, so the next build is slower while it fills the cache again.',
      confirmLabel: 'Clear cache',
      destructive: true,
    });
    if (ok) this.confirmClear();
    else this.showConfirmClear.set(false);
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
