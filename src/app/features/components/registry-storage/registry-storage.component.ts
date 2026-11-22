import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  ConnectRegistryBucket,
  RegistryBucket,
  RegistryStorageChoice,
  RegistryTrafficWindow,
  ScalewayRegistryRegion,
  measuredAgo,
  usageGauge,
} from '../../model/registry-storage.models';
import { RegistryStorageService } from '../../service/registry-storage.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  RegistryConnectOption,
  RegistryStorageSurfaceInput,
  RegistryStorageSurfaceRevision,
  buildRegistryStorageSurface,
  presentedContent,
} from './registry-storage-surface';
import { emptyOwnBucketForm, registryLimitLine, registryLocation } from './registry-storage-view';
import { RegistryAppsPanel, RegistryUsagePanel } from './registry-usage-panel';
import { RegistryTrafficPanel } from './registry-traffic-panel';
import { RegistryEnablePanel } from './registry-enable-panel';
import { RegistryBucketPanel } from './registry-bucket-panel';
import { RegistryReplacedBuckets } from './registry-replaced-buckets';
import { RegistryConfirmDialog } from './registry-confirm-dialog';

@Component({
  selector: 'app-registry-storage',
  imports: [
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    RegistryUsagePanel,
    RegistryAppsPanel,
    RegistryTrafficPanel,
    RegistryEnablePanel,
    RegistryBucketPanel,
    RegistryReplacedBuckets,
    RegistryConfirmDialog,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Image registry">
        <ng-container headerMeta>
          <span>Where the images Flui builds for your applications are kept.</span>
          @if (usage(); as u) {
            <span class="fl-muted" data-testid="registry-measured"
              >Measured {{ ago(u.measuredAt) }}</span
            >
          }
        </ng-container>
        @if (usage()) {
          <button
            headerActions
            flButton
            type="button"
            data-testid="registry-measure"
            [disabled]="registry.measuring()"
            (click)="measure()"
          >
            <fl-icon name="lucideRefreshCw" />
            {{ registry.measuring() ? 'Measuring…' : 'Measure now' }}
          </button>
        }
      </fl-page-header>

      @if (registry.refused()) {
        <fl-alert tone="info" title="Not available to you" data-testid="registry-refused">{{
          registry.refusalMessage()
        }}</fl-alert>
      }

      @if (registry.loadError(); as message) {
        <fl-alert tone="error" title="Could not load the registry" data-testid="registry-error">
          {{ message }}
          <button alertActions flButton size="sm" type="button" (click)="reload()">
            Try again
          </button>
        </fl-alert>
      }

      @if (registry.mode(); as m) {
        @if (m.mode === 'flui' && !m.ready && registry.stillNotReady()) {
          <fl-alert tone="warning" title="Registry not ready" data-testid="registry-not-ready">
            The Flui registry is still not ready after five minutes. New builds push to it and fail
            until it is.
            @if (m.detail) {
              <span class="block fl-mono">{{ m.detail }}</span>
            }
            <button
              alertActions
              flButton
              size="sm"
              type="button"
              data-testid="registry-check-ready"
              (click)="checkReady()"
            >
              Check again
            </button>
          </fl-alert>
        } @else if (m.mode === 'flui' && !m.ready) {
          <fl-alert tone="info" title="Starting the Flui registry" data-testid="registry-starting">
            New builds push to it; this page updates when it is ready.
            @if (m.detail) {
              <span class="block fl-mono">{{ m.detail }}</span>
            }
          </fl-alert>
        }
      }

      @if (registry.status(); as status) {
        @if (usage(); as u) {
          <app-registry-usage-panel
            [status]="status"
            [usage]="u"
            [gauge]="gauge()"
            [location]="location()"
            [limitLine]="limitLine()"
          />
          @if (!registry.trafficHidden()) {
            <app-registry-traffic-panel
              [traffic]="registry.traffic()"
              [window]="registry.trafficWindow()"
              [loading]="registry.trafficLoading()"
              [failed]="registry.trafficFailed()"
              (windowChange)="setTrafficWindow($event)"
            />
          }
          <app-registry-apps-panel [usage]="u" />
        } @else if (onGhcr()) {
          <app-registry-enable-panel
            [storage]="enableStorage()"
            [busy]="switchBusy()"
            [enabling]="registry.switching() === 'enable'"
            [bucketReady]="bucketReady()"
            [error]="registry.switchError()"
            (storageChange)="enableStorage.set($event)"
            (enable)="enableRegistry()"
          />
        } @else {
          <fl-panel title="Storage">
            <fl-empty-state
              data-testid="registry-ghcr"
              [compact]="true"
              title="Images are kept on GitHub"
              body="This installation keeps images on GitHub's registry. There is nothing to show here."
            />
          </fl-panel>
        }

        @if (usage() || bucketForEnable()) {
          <app-registry-bucket-panel
            [status]="status"
            [onGhcr]="onGhcr()"
            [connectOpen]="connectOpen()"
            [option]="option()"
            [scalewayRegion]="scalewayRegion()"
            [busy]="busy()"
            [connecting]="registry.connecting()"
            [connectError]="registry.connectError()"
            [own]="own"
            [advancedOpen]="advancedOpen()"
            (replace)="connectOpen.set(true)"
            (optionChange)="option.set($event)"
            (regionChange)="scalewayRegion.set($event)"
            (request)="request($event)"
            (advancedToggle)="advancedOpen.set(!advancedOpen())"
            (keep)="closeConnect()"
          />
          @if (replacedBuckets().length > 0) {
            <app-registry-replaced-buckets
              [buckets]="replacedBuckets()"
              [removing]="registry.removing()"
              [error]="registry.removeError()"
              (remove)="askRemove($event)"
            />
          }
        }

        @if (canDisable()) {
          <div class="flex flex-col items-end gap-2">
            @if (registry.switchError(); as message) {
              <fl-alert tone="error" title="Switch refused" data-testid="registry-disable-error">{{
                message
              }}</fl-alert>
            }
            <button
              flButton="ghost"
              size="sm"
              type="button"
              data-testid="registry-disable"
              [disabled]="switchBusy()"
              (click)="confirmDisable.set(true)"
            >
              Send new builds back to GitHub Container Registry
            </button>
          </div>
        }
      } @else if (registry.loading()) {
        <fl-panel title="Storage">
          <fl-loading-state />
        </fl-panel>
      }
    </div>

    @if (confirmReplace(); as kind) {
      <app-registry-confirm-dialog
        title="Replace the bucket?"
        confirmLabel="Replace"
        testId="registry-confirm"
        submitTestId="registry-confirm-submit"
        (cancelled)="confirmReplace.set(null)"
        (confirmed)="confirmed()"
      >
        <p class="m-0">
          {{ kind === 'scaleway' ? 'A new bucket on Scaleway' : 'The bucket you entered' }}
          takes the place of {{ registry.status()?.bucket || 'the current one' }}.
        </p>
        <p class="m-0 text-fl-ink-muted" data-testid="registry-confirm-images">
          Images already in the registry are not copied to the new bucket. An application whose
          image is no longer there needs a new build before it can start elsewhere.
        </p>
      </app-registry-confirm-dialog>
    }

    @if (confirmDisable()) {
      <app-registry-confirm-dialog
        title="Switch back to GitHub?"
        confirmLabel="Switch back"
        testId="registry-disable-confirm"
        submitTestId="registry-disable-submit"
        (cancelled)="confirmDisable.set(false)"
        (confirmed)="disableRegistry()"
      >
        <p class="m-0">
          Send new builds back to GitHub Container Registry and stop the Flui registry? Its volume
          or bucket is kept.
        </p>
      </app-registry-confirm-dialog>
    }

    @if (confirmRemove(); as b) {
      <app-registry-confirm-dialog
        [title]="b.createdByFlui ? 'Delete the bucket?' : 'Forget the bucket?'"
        [confirmLabel]="b.createdByFlui ? 'Delete' : 'Forget'"
        [danger]="b.createdByFlui"
        testId="registry-remove-confirm"
        submitTestId="registry-remove-submit"
        (cancelled)="confirmRemove.set(null)"
        (confirmed)="remove()"
      >
        <p class="m-0" data-testid="registry-remove-message">
          @if (b.createdByFlui) {
            Delete {{ b.bucket }} with every image in it, and the project and key Flui made for it?
          } @else {
            Forget {{ b.bucket }}? What it holds stays in your account.
          }
        </p>
      </app-registry-confirm-dialog>
    }
  `,
})
export class RegistryStorageComponent implements OnInit, OnDestroy {
  protected readonly registry = inject(RegistryStorageService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly toast = inject(ToastService);

  protected readonly connectOpen = signal(false);
  protected readonly option = signal<RegistryConnectOption>('scaleway');
  protected readonly scalewayRegion = signal<ScalewayRegistryRegion>('fr-par');
  protected readonly advancedOpen = signal(false);
  protected readonly confirmReplace = signal<RegistryConnectOption | null>(null);
  protected readonly confirmRemove = signal<RegistryBucket | null>(null);
  protected readonly confirmDisable = signal(false);
  protected readonly enableStorage = signal<RegistryStorageChoice>('volume');
  protected readonly onGhcr = computed(() => this.registry.mode()?.mode === 'ghcr');
  protected readonly bucketReady = computed(
    () => !!this.registry.status()?.connected || !!this.registry.mode()?.bucketConnected,
  );
  protected readonly bucketForEnable = computed(
    () => this.onGhcr() && this.enableStorage() === 's3',
  );
  protected readonly switchBusy = computed(() => this.registry.switching() !== null);
  protected readonly canDisable = computed(() => {
    const mode = this.registry.mode();
    return mode?.mode === 'flui' && mode.applicationsOnRegistry === 0;
  });
  protected readonly replacedBuckets = computed(() =>
    this.registry.buckets().filter((b) => !b.active),
  );

  protected own = emptyOwnBucketForm();

  protected readonly usage = computed(() => this.registry.status()?.usage ?? null);
  protected readonly gauge = computed(() => {
    const usage = this.usage();
    return usage ? usageGauge(usage) : null;
  });
  protected readonly busy = computed(() => this.registry.connecting() !== null);

  protected readonly location = computed(() => registryLocation(this.registry.status()));

  protected readonly limitLine = computed(() => registryLimitLine(this.usage(), this.gauge()));

  private readonly surfaceRevision = new RegistryStorageSurfaceRevision();

  readonly surface = computed(() => {
    const input: RegistryStorageSurfaceInput = {
      loading: this.registry.loading(),
      refused: this.registry.refused(),
      hasLoadError: !!this.registry.loadError(),
      status: this.registry.status(),
      measuring: this.registry.measuring(),
      connecting: this.registry.connecting(),
      hasConnectError: !!this.registry.connectError(),
      connectOpen:
        !!this.registry.status() && (!this.registry.status()!.connected || this.connectOpen()),
      confirmReplace: this.confirmReplace(),
      replacedBuckets: this.replacedBuckets().length,
      replacedCreatedByFlui: this.replacedBuckets().filter((b) => b.createdByFlui).length,
      removing: this.registry.removing() !== null,
      hasRemoveError: !!this.registry.removeError(),
      confirmRemove: this.confirmRemove()
        ? { createdByFlui: this.confirmRemove()!.createdByFlui }
        : null,
      traffic: this.registry.trafficHidden() ? null : this.registry.traffic(),
      trafficWindow: this.registry.trafficWindow(),
      trafficLoading: this.registry.trafficLoading(),
      trafficHidden: this.registry.trafficHidden(),
      mode: this.registry.mode(),
      switching: this.registry.switching(),
    };
    return buildRegistryStorageSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    void this.registry.load();
    void this.registry.loadBuckets();
    void this.registry.loadTraffic();
    void this.registry.loadMode().then(() => {
      if (this.registry.mode()?.bucketConnected) this.enableStorage.set('s3');
    });
  }

  protected setTrafficWindow(window: RegistryTrafficWindow): void {
    if (window === this.registry.trafficWindow() && this.registry.traffic()) return;
    void this.registry.loadTraffic(window);
  }

  protected checkReady(): void {
    void this.registry.checkReadyAgain();
  }

  ngOnDestroy(): void {
    this.registry.stopFollowing();
    this.currentSurface.set(null);
  }

  protected async enableRegistry(): Promise<void> {
    const storage = this.enableStorage();
    if (this.switchBusy() || (storage === 's3' && !this.bucketReady())) return;
    if (await this.registry.enable(storage)) {
      this.toast.showSuccess('New builds now push to the Flui registry');
    }
  }

  protected async disableRegistry(): Promise<void> {
    this.confirmDisable.set(false);
    if (await this.registry.disable()) {
      this.toast.showSuccess('New builds now push to GitHub Container Registry');
    }
  }

  protected reload(): void {
    void this.registry.load();
  }

  protected measure(): void {
    void this.registry.load(true);
  }

  protected request(kind: RegistryConnectOption): void {
    if (this.busy()) return;
    if (this.registry.status()?.connected) {
      this.confirmReplace.set(kind);
      return;
    }
    void this.submit(kind);
  }

  protected confirmed(): void {
    const kind = this.confirmReplace();
    this.confirmReplace.set(null);
    if (kind) void this.submit(kind);
  }

  protected askRemove(bucket: RegistryBucket): void {
    this.registry.clearRemoveError();
    this.confirmRemove.set(bucket);
  }

  protected async remove(): Promise<void> {
    const bucket = this.confirmRemove();
    this.confirmRemove.set(null);
    if (!bucket) return;
    const removal = await this.registry.removeBucket(bucket.id);
    if (!removal) return;
    this.toast.showSuccess(
      removal.bucketDeleted ? `Deleted ${removal.bucket}` : `Forgot ${removal.bucket}`,
    );
    await this.registry.loadBuckets();
  }

  protected closeConnect(): void {
    this.connectOpen.set(false);
    this.registry.clearConnectError();
    this.own = emptyOwnBucketForm();
  }

  private async submit(kind: RegistryConnectOption): Promise<void> {
    if (kind === 'scaleway') {
      const ok = await this.registry.connectScaleway(this.scalewayRegion());
      if (ok) {
        this.connectOpen.set(false);
        void this.registry.loadBuckets();
      }
      return;
    }
    const body = this.ownBody();
    this.own = { ...this.own, secretKey: '' };
    const ok = await this.registry.connectOwn(body);
    if (ok) {
      void this.registry.loadBuckets();
      this.own = emptyOwnBucketForm();
      this.advancedOpen.set(false);
      this.connectOpen.set(false);
    }
  }

  private ownBody(): ConnectRegistryBucket {
    const prefix = this.own.prefix.trim();
    return {
      provider: this.own.provider,
      endpoint: this.own.endpoint.trim(),
      region: this.own.region.trim(),
      bucket: this.own.bucket.trim(),
      ...(prefix ? { prefix } : {}),
      ...(this.own.forcePathStyle ? { forcePathStyle: true } : {}),
      accessKey: this.own.accessKey.trim(),
      secretKey: this.own.secretKey,
    };
  }

  protected ago(iso: string): string {
    return measuredAgo(iso);
  }
}
