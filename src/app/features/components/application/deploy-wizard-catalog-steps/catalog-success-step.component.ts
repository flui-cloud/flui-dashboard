import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideExternalLink,
  lucideLayoutDashboard,
  lucideLoader,
  lucideRocket,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { AppEndpointsService } from '../../../service/app-endpoints.service';
import { ApplicationService } from '../../../service/application.service';
import { evaluateEndpointReadiness } from '../../../model/endpoint-readiness';
import { buildOpenAppUrl } from '../../../model/open-app-url';
import { CreateApplicationDto } from '../../../../core/api/model/createApplicationDto';
import { ApplicationResponseDto } from '../../../../core/api/model/applicationResponseDto';

interface InternalReadiness {
  state: 'loading' | 'pending' | 'failed' | 'ready';
  label: string;
  detail?: string;
  isReady: boolean;
  isTerminal: boolean;
}

@Component({
  selector: 'app-catalog-success-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideExternalLink,
      lucideLayoutDashboard,
      lucideLoader,
      lucideRocket,
    }),
  ],
  template: `
    @let inst = install();
    @if (inst) {
      <div class="flex flex-col items-center gap-4 py-6 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
          <ng-icon name="lucideCircleCheck" class="h-8 w-8 text-green-500" />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-foreground">
            {{ inst.displayName }} is running
          </h3>
          @if (inst.resolvedFqdn) {
            <p class="text-sm text-muted-foreground">
              Available at
              <span class="font-mono text-foreground">{{ inst.resolvedFqdn }}</span>
            </p>
          } @else if (isInternalApp() && internalApp()?.internalUrl) {
            <p class="text-sm text-muted-foreground">
              Available at
              <span class="font-mono text-foreground">{{ internalApp()!.internalUrl }}</span>
            </p>
          } @else if (state.catalogDetail()?.appType === 'building-block') {
            <p class="text-sm text-muted-foreground">
              This is an internal service — other apps on the same cluster can reach it.
            </p>
          } @else if (isInternalApp()) {
            <p class="text-sm text-muted-foreground">
              Gets a private URL on your cluster's internal domain, protected by Flui authentication.
              Accessible from the internet — Flui login required to open.
            </p>
          } @else {
            <p class="text-sm text-muted-foreground">
              The app is running. Add a domain from the DNS tab to expose it publicly.
            </p>
          }
        </div>

        @if (inst.resolvedFqdn) {
          @let r = readiness();
          @if (r.state === 'cert-pending' || r.state === 'dns-pending' || r.state === 'loading') {
            <div
              class="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground max-w-md"
            >
              <ng-icon name="lucideLoader" class="h-4 w-4 mt-0.5 animate-spin text-primary" />
              <div class="flex-1 text-left">
                <p class="font-medium text-foreground">{{ r.label }}</p>
                @if (r.detail) {
                  <p class="mt-0.5">{{ r.detail }}</p>
                }
              </div>
            </div>
          } @else if (r.state === 'failed') {
            <div
              class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive max-w-md"
            >
              <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
              <div class="flex-1 text-left">
                <p class="font-medium">{{ r.label }}</p>
                @if (r.detail) {
                  <p class="mt-0.5">{{ r.detail }}</p>
                }
              </div>
            </div>
          }
        } @else if (isInternalApp()) {
          @let ir = internalReadiness();
          @if (ir.state === 'pending' || ir.state === 'loading') {
            <div
              class="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground max-w-md"
            >
              <ng-icon name="lucideLoader" class="h-4 w-4 mt-0.5 animate-spin text-primary" />
              <div class="flex-1 text-left">
                <p class="font-medium text-foreground">{{ ir.label }}</p>
                @if (ir.detail) {
                  <p class="mt-0.5">{{ ir.detail }}</p>
                }
              </div>
            </div>
          } @else if (ir.state === 'failed') {
            <div
              class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive max-w-md"
            >
              <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
              <div class="flex-1 text-left">
                <p class="font-medium">{{ ir.label }}</p>
                @if (ir.detail) {
                  <p class="mt-0.5">{{ ir.detail }}</p>
                }
              </div>
            </div>
          }
        }

        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          @if (inst.resolvedFqdn && readiness().isReady) {
            <a
              [href]="openAppUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm
                     font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              Open app
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
            </a>
          } @else if (isInternalApp() && internalReadiness().isReady && internalApp()?.internalUrl) {
            <a
              [href]="internalApp()!.internalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm
                     font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              Open app
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
            </a>
          }
          @if (firstAppId()) {
            <a
              [routerLink]="['/apps/applications', firstAppId()]"
              [class]="appDetailsButtonClass()"
            >
              <ng-icon name="lucideLayoutDashboard" class="h-4 w-4" />
              App details
            </a>
          }
        </div>
      </div>
    } @else {
      <p class="text-sm text-muted-foreground">Waiting for install to finish…</p>
    }
  `,
})
export class CatalogSuccessStepComponent implements OnDestroy {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly endpointsService = inject(AppEndpointsService);
  private readonly applicationService = inject(ApplicationService);

  protected readonly install = computed(() => this.state.currentInstall());
  protected readonly firstAppId = computed(
    () => this.install()?.applicationIds?.[0] ?? null,
  );

  private readonly clusterLoaded = signal<string | null>(null);
  private readonly internalAppLoaded = signal<string | null>(null);
  protected readonly internalApp = signal<ApplicationResponseDto | null>(null);
  private pollingAbort = false;
  private internalPollingAbort = false;

  /** True when the install targets an internal-exposure app (manifest `exposure: "internal"`
   *  or user opted into Internal for a privatizable public app). Building blocks are excluded:
   *  they never surface a user-facing URL. */
  protected readonly isInternalApp = computed(() => {
    const detail = this.state.catalogDetail();
    if (!detail || detail.appType === 'building-block') return false;
    return (
      detail.exposure === 'internal' ||
      this.state.exposureMode() === CreateApplicationDto.ExposureEnum.Internal
    );
  });

  protected readonly matchedEndpoint = computed(() => {
    const fqdn = this.install()?.resolvedFqdn;
    if (!fqdn) return null;
    return this.endpointsService.endpoints().find((e) => e.fqdn === fqdn) ?? null;
  });

  protected readonly openAppUrl = computed(() =>
    buildOpenAppUrl(this.install()?.resolvedFqdn, this.state.catalogDetail()?.entrypointPath),
  );

  protected readonly readiness = computed(() =>
    evaluateEndpointReadiness(this.matchedEndpoint()),
  );

  /** Readiness of the internal URL, mirroring the AppOverviewTab pattern:
   *  an internal app is ready once the backend populates `internalUrl` on the
   *  Application (which happens after the internal DNS + wildcard TLS reconcile). */
  protected readonly internalReadiness = computed<InternalReadiness>(() => {
    if (!this.isInternalApp()) {
      return { state: 'loading', label: 'Checking internal endpoint…', isReady: false, isTerminal: false };
    }
    const app = this.internalApp();
    if (!app) {
      return {
        state: 'loading',
        label: 'Checking internal endpoint…',
        isReady: false,
        isTerminal: false,
      };
    }
    if (app.internalUrl) {
      return { state: 'ready', label: 'Ready', isReady: true, isTerminal: true };
    }
    const r = app.reconciliationStatus as string;
    if (r === 'ERROR') {
      return {
        state: 'failed',
        label: 'Internal endpoint failed',
        detail: app.reconciliationError ?? 'DNS or TLS reconciliation ended in error.',
        isReady: false,
        isTerminal: true,
      };
    }
    return {
      state: 'pending',
      label: 'Setting up internal endpoint…',
      detail: 'Flui is configuring the internal DNS and TLS certificate. This takes a few minutes.',
      isReady: false,
      isTerminal: false,
    };
  });

  protected readonly appDetailsButtonClass = computed(() => {
    // Secondary styling when "Open app" is visible, primary otherwise.
    const publicReady = !!this.install()?.resolvedFqdn && this.readiness().isReady;
    const internalReady =
      this.isInternalApp() && this.internalReadiness().isReady && !!this.internalApp()?.internalUrl;
    const primaryVisible = publicReady || internalReady;
    return primaryVisible
      ? 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted'
      : 'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90';
  });

  constructor() {
    // Public apps: load endpoints when the install's cluster becomes known,
    // then poll cert status while it's still issuing.
    effect(() => {
      const inst = this.install();
      if (!inst?.resolvedFqdn || !inst.clusterId) return;
      if (this.clusterLoaded() === inst.clusterId) return;
      this.clusterLoaded.set(inst.clusterId);
      this.bootstrapReadiness(inst.clusterId);
    });

    // Internal apps: fetch the application and poll until `internalUrl` is
    // populated (or reconciliation errors out).
    effect(() => {
      if (!this.isInternalApp()) return;
      if (this.install()?.resolvedFqdn) return; // public flow covers it
      const appId = this.firstAppId();
      if (!appId) return;
      if (this.internalAppLoaded() === appId) return;
      this.internalAppLoaded.set(appId);
      this.bootstrapInternalReadiness(appId);
    });
  }

  ngOnDestroy(): void {
    this.pollingAbort = true;
    this.internalPollingAbort = true;
  }

  private async bootstrapReadiness(clusterId: string): Promise<void> {
    await this.endpointsService.loadEndpoints(clusterId);
    const ep = this.matchedEndpoint();
    if (!ep) return;
    const r = evaluateEndpointReadiness(ep);
    if (r.isTerminal) return;

    // Light client-side polling — service already has an 8s polling helper,
    // we drive our own loop so we refresh the list signal consistently.
    this.pollingAbort = false;
    const start = Date.now();
    const timeoutMs = 5 * 60_000;
    const interval = 8000;
    while (!this.pollingAbort && Date.now() - start < timeoutMs) {
      await this.delay(interval);
      if (this.pollingAbort) return;
      const refreshed = await this.endpointsService.getEndpointStatus(ep.id);
      if (!refreshed) continue;
      if (evaluateEndpointReadiness(refreshed).isTerminal) return;
    }
  }

  private async bootstrapInternalReadiness(appId: string): Promise<void> {
    const initial = await this.safeRefreshApp(appId);
    if (initial) this.internalApp.set(initial);
    if (initial && this.isInternalTerminal(initial)) return;

    this.internalPollingAbort = false;
    const start = Date.now();
    const timeoutMs = 5 * 60_000;
    const interval = 8000;
    while (!this.internalPollingAbort && Date.now() - start < timeoutMs) {
      await this.delay(interval);
      if (this.internalPollingAbort) return;
      const refreshed = await this.safeRefreshApp(appId);
      if (!refreshed) continue;
      this.internalApp.set(refreshed);
      if (this.isInternalTerminal(refreshed)) return;
    }
  }

  private isInternalTerminal(app: ApplicationResponseDto): boolean {
    if (app.internalUrl) return true;
    return (app.reconciliationStatus as string) === 'ERROR';
  }

  private async safeRefreshApp(id: string): Promise<ApplicationResponseDto | null> {
    try {
      return await this.applicationService.refreshApplication(id);
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
