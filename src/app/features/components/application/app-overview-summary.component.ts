import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideWaypoints } from '@ng-icons/lucide';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { accessOf } from '../../model/app-access';
import { Application } from '../../model/application.models';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl, CATALOG_APP_LABEL } from '../../model/open-app-url';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { CatalogService } from '../../service/catalog.service';
import { Tone, statusToneOf } from '../dashboard/home-state';
import { endpointCountsOf, plural, replicasTone } from './app-overview-view';
import { endpointHealth } from './app-recap-view';
import { replicaCountsOf } from './replica-counts';
import { placementOf, replicaPodsOf } from './replica-pods';

type InternalReadiness = 'pending' | 'failed' | 'ready' | 'not-configured';

@Component({
  selector: 'app-overview-summary',
  imports: [RouterLink, FlPanel, FlKeyValue, FlKvItem, FlStatus, FlIcon],
  providers: [provideIcons({ lucideExternalLink, lucideWaypoints })],
  host: { class: 'block' },
  template: `
    @let a = app();
    <fl-panel title="Details" data-testid="overview-summary">
      <a
        panelActions
        routerLink="/topology"
        [queryParams]="serviceMap()"
        data-testid="overview-service-map"
        class="fl-link inline-flex items-center gap-1.5 text-fl-body-sm"
      >
        <fl-icon name="lucideWaypoints" [size]="14" />What it connects to
      </a>
      <fl-key-value data-testid="overview-facts">
        @if (isPublic()) {
          @if (counts().primary; as ep) {
            @let r = readiness();
            <fl-kv-item key="Public endpoint" class="col-span-full">
              <span class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                @if (r.isReady) {
                  <a
                    [href]="openUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="fl-link fl-mono inline-flex min-w-0 items-center gap-1.5"
                    data-testid="overview-endpoint"
                  >
                    <span class="truncate">{{ openUrl() }}</span>
                    <fl-icon name="lucideExternalLink" [size]="13" />
                  </a>
                } @else {
                  <span class="fl-mono truncate text-fl-ink" [attr.title]="r.detail">
                    {{ scheme() }}://{{ ep.fqdn }}
                  </span>
                }
                @if (counts().extraInSync > 0) {
                  <span class="text-fl-caption text-fl-ink-muted"
                    >+{{ counts().extraInSync }} more</span
                  >
                }
                @if (r.isReady) {
                  @if (health(); as h) {
                    <fl-status [tone]="tone(h.tone)" [label]="h.label" />
                  }
                } @else {
                  <fl-status
                    [tone]="r.state === 'failed' ? 'error' : 'progress'"
                    [label]="r.label"
                    [attr.title]="r.detail"
                  />
                  <a [routerLink]="['../dns']" class="fl-link text-fl-body-sm">Details</a>
                }
              </span>
            </fl-kv-item>
          }
        } @else if (!isBuildingBlock()) {
          @let i = internalReadiness();
          <fl-kv-item key="Internal endpoint" class="col-span-full">
            <span class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              @if (i === 'ready') {
                <a
                  [href]="a.internalUrl!"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="fl-link fl-mono inline-flex min-w-0 items-center gap-1.5"
                >
                  <span class="truncate">{{ a.internalUrl }}</span>
                  <fl-icon name="lucideExternalLink" [size]="13" />
                </a>
              } @else if (i === 'not-configured') {
                <span
                  class="text-fl-ink-muted"
                  title="Internal app hosting not configured for this cluster."
                  >Internal app hosting not configured · ask your cluster admin</span
                >
              } @else {
                <span class="text-fl-ink-muted">{{
                  i === 'failed' ? 'Internal endpoint failed' : 'Setting up internal endpoint…'
                }}</span>
              }
              @if (internalBadge(); as b) {
                <fl-status [tone]="b.tone" [label]="b.label" />
              }
            </span>
          </fl-kv-item>
        }

        <fl-kv-item key="Replicas">
          <span class="flex flex-col items-start gap-1.5">
            <fl-status
              [tone]="tone(replicaTone())"
              [label]="replicas().ready + ' / ' + replicas().desired + ' ready'"
            />
            @if (pods().current.length || pods().older) {
              <ul class="flex flex-col gap-1 text-fl-caption" data-testid="replica-nodes">
                @for (pod of pods().current; track pod.name) {
                  <li class="flex min-w-0 items-center gap-1.5">
                    @if (pod.node) {
                      <fl-status
                        [tone]="pod.ready ? 'success' : 'warning'"
                        [label]="pod.node"
                        [attr.title]="pod.name"
                      />
                      <span class="shrink-0 text-fl-ink-muted">{{ placement(pod) }}</span>
                    } @else {
                      <fl-status
                        tone="warning"
                        label="Waiting for a node"
                        [attr.title]="pod.name"
                      />
                    }
                  </li>
                }
                @if (pods().older) {
                  <li class="text-fl-ink-muted" data-testid="replica-older">
                    {{ plural(pods().older, 'older pod') }} ending
                  </li>
                }
              </ul>
            }
            @if (!readOnly()) {
              <a [routerLink]="['../resources']" class="fl-link text-fl-body-sm">Edit</a>
            }
          </span>
        </fl-kv-item>

        <fl-kv-item key="Resources">
          <span class="flex flex-col items-start gap-0.5">
            @if (container(); as c) {
              <span class="fl-num" title="CPU request / limit"
                >CPU {{ c.requests.cpu ?? '—' }} / {{ c.limits.cpu ?? '—' }}</span
              >
              <span class="fl-num" title="Memory request / limit"
                >Memory {{ c.requests.memory ?? '—' }} / {{ c.limits.memory ?? '—' }}</span
              >
              <span class="text-fl-caption text-fl-ink-muted">request / limit</span>
            } @else {
              <span class="text-fl-ink-muted">—</span>
            }
            @if (!readOnly()) {
              <a [routerLink]="['../resources']" class="fl-link mt-1 text-fl-body-sm">Edit</a>
            }
          </span>
        </fl-kv-item>

        <fl-kv-item key="Configuration">
          <span class="flex flex-col items-start gap-0.5">
            @if (valuesHidden()) {
              <span class="fl-num">{{ plural(a.env?.length ?? 0, 'env var') }}</span>
              <span class="text-fl-caption text-fl-ink-muted">Values not shown</span>
            } @else if (variables.loading()) {
              <span class="text-fl-ink-muted">Loading…</span>
            } @else {
              <span class="fl-num">{{ plural(varCount(), 'env var') }}</span>
              <span class="text-fl-caption text-fl-ink-muted">{{
                plural(secretCount(), 'secret')
              }}</span>
            }
            @if (!readOnly()) {
              <a [routerLink]="['../configuration']" class="fl-link mt-1 text-fl-body-sm">Manage</a>
            }
          </span>
        </fl-kv-item>

        @if (isPublic()) {
          @let e = counts();
          <fl-kv-item key="DNS endpoints">
            <span class="flex flex-col items-start gap-0.5">
              @if (endpointsService.loading()) {
                <span class="text-fl-ink-muted">Loading…</span>
              } @else {
                <fl-status [tone]="tone(dnsTone())" [label]="plural(e.count, 'endpoint')" />
                @if (e.primary; as ep) {
                  <span class="fl-mono max-w-full truncate" [title]="ep.fqdn">{{ ep.fqdn }}</span>
                }
                @if (e.count > 0) {
                  <span class="text-fl-caption text-fl-ink-muted"
                    >{{ e.synced }} in sync
                    @if (e.drift > 0) {
                      · {{ e.drift }} drift
                    }
                  </span>
                }
              }
              @if (!readOnly()) {
                <a [routerLink]="['../dns']" class="fl-link mt-1 text-fl-body-sm">Manage</a>
              }
            </span>
          </fl-kv-item>
        }
      </fl-key-value>
    </fl-panel>
  `,
})
export class AppOverviewSummaryComponent {
  private readonly catalog = inject(CatalogService);
  private readonly runtimeService = inject(AppRuntimeService);
  private readonly monitoring = inject(ApplicationMonitoringService);
  protected readonly variables = inject(AppVariablesService);
  protected readonly endpointsService = inject(AppEndpointsService);

  readonly app = input.required<Application>();

  protected readonly serviceMap = computed(() => {
    const a = this.app();
    return {
      view: 'services',
      level: 'app',
      app: a.id,
      cluster: a.clusterId,
      focus: `app:${a.id}`,
    };
  });

  protected readonly tone = statusToneOf;
  protected readonly plural = plural;
  protected readonly placement = placementOf;

  protected readonly readOnly = computed(() => accessOf(this.app())?.readOnly === true);
  protected readonly valuesHidden = computed(() => accessOf(this.app())?.dataAccess === false);

  protected readonly isPublic = computed(() => hasPublicEndpoint(this.app()));
  protected readonly isBuildingBlock = computed(() => isBuildingBlock(this.app()));
  protected readonly counts = computed(() =>
    endpointCountsOf(this.endpointsService.endpoints(), this.app().id),
  );
  protected readonly readiness = computed(() => evaluateEndpointReadiness(this.counts().primary));
  protected readonly scheme = computed(() =>
    this.counts().primary?.tlsEnabled ? 'https' : 'http',
  );

  protected readonly health = computed(() => {
    const h = endpointHealth(this.app(), this.counts().primary?.tlsEnabled ?? null);
    return h.label ? h : null;
  });

  private readonly catalogSlug = computed(
    () => (this.app() as { labels?: Record<string, string> }).labels?.[CATALOG_APP_LABEL],
  );
  private readonly entrypointPath = signal<string | undefined>(undefined);

  protected readonly openUrl = computed(() => {
    const ep = this.counts().primary;
    return buildOpenAppUrl(ep?.fqdn, this.entrypointPath(), ep?.tlsEnabled ?? false);
  });

  protected readonly internalReadiness = computed<InternalReadiness>(() => {
    const app = this.app();
    if (app.internalUrl) return 'ready';
    const r = app.reconciliationStatus as string;
    if (r === 'ERROR') return 'failed';
    if (r === 'RECONCILING' || r === 'PENDING' || app.status === 'provisioning') return 'pending';
    return 'not-configured';
  });

  protected readonly internalBadge = computed<{ label: string; tone: StatusTone } | null>(() => {
    switch (this.internalReadiness()) {
      case 'ready':
        return { label: 'Internal', tone: 'success' };
      case 'failed':
        return { label: 'Failed', tone: 'error' };
      case 'pending':
        return { label: 'Setting up', tone: 'progress' };
      default:
        return null;
    }
  });

  protected readonly replicas = computed(() =>
    replicaCountsOf(
      this.runtimeService.runtime(),
      this.monitoring.statusMetrics(),
      this.app().replicas,
    ),
  );
  protected readonly replicaTone = computed(() =>
    replicasTone(this.replicas().ready, this.replicas().desired),
  );
  protected readonly pods = computed(() =>
    replicaPodsOf(this.runtimeService.runtime()?.pods, this.replicas().desired),
  );
  protected readonly container = computed(
    () => this.runtimeService.runtime()?.containers?.[0] ?? null,
  );

  protected readonly varCount = computed(() => Object.keys(this.variables.plainData()).length);
  protected readonly secretCount = computed(() => this.variables.sensitiveKeys().length);

  protected readonly dnsTone = computed<Tone>(() => {
    const e = this.counts();
    if (e.count === 0) return 'muted';
    if (e.drift > 0) return 'warn';
    return e.synced === e.count ? 'ok' : 'info';
  });

  constructor() {
    effect(async () => {
      const slug = this.catalogSlug();
      this.entrypointPath.set(slug ? await this.catalog.getEntrypointPathBySlug(slug) : undefined);
    });
  }
}
