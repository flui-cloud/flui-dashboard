import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideLayoutDashboard } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { AppEndpointsService } from '../../../service/app-endpoints.service';
import { ApplicationService } from '../../../service/application.service';
import {
  EndpointReadinessState,
  evaluateEndpointReadiness,
} from '../../../model/endpoint-readiness';
import { buildOpenAppUrl } from '../../../model/open-app-url';
import { CreateApplicationDto } from '../../../../core/api/model/createApplicationDto';
import { ApplicationResponseDto } from '../../../../core/api/model/applicationResponseDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { ButtonVariant, FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';

interface InternalReadiness {
  state: 'loading' | 'pending' | 'failed' | 'ready';
  label: string;
  detail?: string;
  isReady: boolean;
  isTerminal: boolean;
}

@Component({
  selector: 'app-catalog-success-step',
  imports: [RouterLink, FlAlert, FlKeyValue, FlKvItem, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideExternalLink, lucideLayoutDashboard })],
  templateUrl: './catalog-success-step.component.html',
})
export class CatalogSuccessStepComponent implements OnDestroy {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly endpointsService = inject(AppEndpointsService);
  private readonly applicationService = inject(ApplicationService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  protected readonly waiting = signal<{ says: string | null } | null>(null);
  private waitingChecked: string | null = null;

  protected readonly install = computed(() => this.state.currentInstall());
  protected readonly firstAppId = computed(() => this.install()?.applicationIds?.[0] ?? null);

  protected readonly isComposedInstall = computed(
    () => this.state.catalogDetail()?.appType === 'composed',
  );

  protected readonly detailRoute = computed<string[] | null>(() => {
    const inst = this.install();
    if (!inst) return null;
    if (this.isComposedInstall()) return ['/apps/recap', inst.id];
    const appId = this.firstAppId();
    return appId ? ['/apps/applications', appId] : null;
  });

  private readonly clusterLoaded = signal<string | null>(null);
  private readonly internalAppLoaded = signal<string | null>(null);
  protected readonly internalApp = signal<ApplicationResponseDto | null>(null);
  private pollingAbort = false;
  private internalPollingAbort = false;

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
    buildOpenAppUrl(
      this.install()?.resolvedFqdn,
      this.state.catalogDetail()?.entrypointPath,
      this.matchedEndpoint()?.tlsEnabled ?? false,
    ),
  );

  protected readonly readiness = computed(() => evaluateEndpointReadiness(this.matchedEndpoint()));

  protected readonly internalReadiness = computed<InternalReadiness>(() => {
    if (!this.isInternalApp()) {
      return {
        state: 'loading',
        label: 'Checking internal endpoint',
        isReady: false,
        isTerminal: false,
      };
    }
    const app = this.internalApp();
    if (!app) {
      return {
        state: 'loading',
        label: 'Checking internal endpoint',
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
      label: 'Setting up internal endpoint',
      detail: 'Flui is configuring the internal DNS and TLS certificate. This takes a few minutes.',
      isReady: false,
      isTerminal: false,
    };
  });

  protected readonly openTarget = computed<string | null>(() => {
    if (this.install()?.resolvedFqdn && this.readiness().isReady) return this.openAppUrl();
    const internalUrl = this.internalApp()?.internalUrl;
    if (this.isInternalApp() && this.internalReadiness().isReady && internalUrl) return internalUrl;
    return null;
  });

  protected readonly detailsVariant = computed<ButtonVariant>(() => {
    const publicReady = !!this.install()?.resolvedFqdn && this.readiness().isReady;
    const internalReady =
      this.isInternalApp() && this.internalReadiness().isReady && !!this.internalApp()?.internalUrl;
    return publicReady || internalReady ? 'secondary' : 'primary';
  });

  protected toneOf(state: EndpointReadinessState | InternalReadiness['state']): StatusTone {
    if (state === 'ready') return 'success';
    if (state === 'failed') return 'error';
    return 'progress';
  }

  constructor() {
    effect(() => {
      const installId = this.install()?.id;
      if (!installId || this.waitingChecked === installId) return;
      this.waitingChecked = installId;
      void this.checkWaiting(installId);
    });

    effect(() => {
      const inst = this.install();
      if (!inst?.resolvedFqdn || !inst.clusterId) return;
      if (this.clusterLoaded() === inst.clusterId) return;
      this.clusterLoaded.set(inst.clusterId);
      this.bootstrapReadiness(inst.clusterId);
    });

    effect(() => {
      if (!this.isInternalApp()) return;
      if (this.install()?.resolvedFqdn) return;
      const appId = this.firstAppId();
      if (!appId) return;
      if (this.internalAppLoaded() === appId) return;
      this.internalAppLoaded.set(appId);
      this.bootstrapInternalReadiness(appId);
    });
  }

  private async checkWaiting(installId: string): Promise<void> {
    const api = `${this.appConfig.apiBaseUrl}/api/v1`;
    const base = `${api}/applications`;
    const fresh = await firstValueFrom(
      this.http.get<{ applicationIds?: string[] }>(`${api}/catalog/installs/${installId}`),
    ).catch(() => null);
    const ids = fresh?.applicationIds ?? this.install()?.applicationIds ?? [];
    for (const id of ids) {
      try {
        const app = await firstValueFrom(this.http.get<{ status?: string }>(`${base}/${id}`));
        if (app?.status !== 'waiting_for_room') continue;
        const runtime = await firstValueFrom(
          this.http.get<{ waitingForRoom?: { says: string } | null }>(`${base}/${id}/runtime`),
        ).catch(() => null);
        this.waiting.set({ says: runtime?.waitingForRoom?.says ?? null });
        return;
      } catch {
        continue;
      }
    }
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
