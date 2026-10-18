import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideExternalLink, lucideLoader, lucideWaypoints } from '@ng-icons/lucide';
import { Application } from '../../model/application.models';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl, CATALOG_APP_LABEL } from '../../model/open-app-url';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { CatalogService } from '../../service/catalog.service';
import { Tone } from '../dashboard/home-state';
import { AppOverviewFactsComponent } from './app-overview-facts.component';
import { endpointCountsOf } from './app-overview-view';
import { TONE_DOT, TONE_PILL, endpointHealth } from './app-recap-view';

type InternalReadiness = 'pending' | 'failed' | 'ready' | 'not-configured';

@Component({
  selector: 'app-overview-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, AppOverviewFactsComponent],
  providers: [provideIcons({ lucideCircleAlert, lucideExternalLink, lucideLoader, lucideWaypoints })],
  host: { class: 'block' },
  template: `
    @let a = app();
    <section class="card-surface space-y-5 p-6" data-testid="overview-summary">
      @if (isPublic()) {
        @if (counts().primary; as ep) {
          @let r = readiness();
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0 flex-1 basis-full sm:basis-0">
              <p class="text-label">Public endpoint</p>
              <div class="mt-0.5 flex min-w-0 items-center gap-2">
                @if (r.isReady) {
                  <a
                    [href]="openUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group inline-flex min-w-0 items-center gap-1.5 font-mono text-base font-medium text-primary hover:underline"
                    data-testid="overview-endpoint"
                  >
                    <span class="truncate">{{ openUrl() }}</span>
                    <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 shrink-0" />
                  </a>
                } @else {
                  <span class="truncate font-mono text-base font-medium text-foreground" [attr.title]="r.detail">
                    {{ scheme() }}://{{ ep.fqdn }}
                  </span>
                }
                @if (counts().extraInSync > 0) {
                  <span class="shrink-0 text-xs text-muted-foreground">+{{ counts().extraInSync }} more</span>
                }
              </div>
            </div>
            @if (r.isReady) {
              @if (health(); as h) {
                <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [class]="pill[h.tone]">
                  <span class="h-1.5 w-1.5 rounded-full" [class]="dot[h.tone]"></span>
                  {{ h.label }}
                </span>
              }
            } @else {
              <span class="flex shrink-0 items-center gap-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  [class]="pill[r.state === 'failed' ? 'danger' : 'warn']"
                  [attr.title]="r.detail"
                >
                  <ng-icon
                    [name]="r.state === 'failed' ? 'lucideCircleAlert' : 'lucideLoader'"
                    class="h-3 w-3"
                    [class.animate-spin]="r.state !== 'failed'"
                  />
                  {{ r.label }}
                </span>
                <a [routerLink]="['../dns']" class="text-xs font-medium text-primary hover:underline">Details</a>
              </span>
            }
          </div>
        }
      } @else if (!isBuildingBlock()) {
        @let i = internalReadiness();
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0 flex-1 basis-full sm:basis-0">
            <p class="text-label">Internal endpoint</p>
            @if (i === 'ready') {
              <a
                [href]="a.internalUrl!"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-0.5 inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-base font-medium text-primary hover:underline"
              >
                <span class="truncate">{{ a.internalUrl }}</span>
                <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 shrink-0" />
              </a>
            } @else if (i === 'not-configured') {
              <p class="mt-0.5 text-sm text-muted-foreground" title="Internal app hosting not configured for this cluster.">
                Internal app hosting not configured · ask your cluster admin
              </p>
            } @else {
              <p class="mt-0.5 text-sm text-muted-foreground">
                {{ i === 'failed' ? 'Internal endpoint failed' : 'Setting up internal endpoint…' }}
              </p>
            }
          </div>
          @if (internalBadge(); as b) {
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [class]="pill[b.tone]">
              <span class="h-1.5 w-1.5 rounded-full" [class]="dot[b.tone]"></span>
              {{ b.label }}
            </span>
          }
        </div>
      }

      <div [class.border-t]="hasEndpointLine()" [class.pt-5]="hasEndpointLine()" class="border-border">
        <app-overview-facts [app]="a" [showDns]="isPublic()" />
      </div>
      <div class="flex justify-end border-t border-border pt-4">
        <a routerLink="/topology" [queryParams]="serviceMap()" data-testid="overview-service-map"
           class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <ng-icon name="lucideWaypoints" class="h-3.5 w-3.5" />What it connects to
        </a>
      </div>
    </section>
  `,
})
export class AppOverviewSummaryComponent {
  private readonly endpoints = inject(AppEndpointsService);
  private readonly catalog = inject(CatalogService);

  readonly app = input.required<Application>();

  protected readonly serviceMap = computed(() => {
    const a = this.app();
    return { view: 'services', level: 'app', app: a.id, cluster: a.clusterId, focus: `app:${a.id}` };
  });

  protected readonly pill = TONE_PILL;
  protected readonly dot = TONE_DOT;

  protected readonly isPublic = computed(() => hasPublicEndpoint(this.app()));
  protected readonly isBuildingBlock = computed(() => isBuildingBlock(this.app()));
  protected readonly counts = computed(() => endpointCountsOf(this.endpoints.endpoints(), this.app().id));
  protected readonly readiness = computed(() => evaluateEndpointReadiness(this.counts().primary));
  protected readonly scheme = computed(() => (this.counts().primary?.tlsEnabled ? 'https' : 'http'));

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

  protected readonly internalBadge = computed<{ label: string; tone: Tone } | null>(() => {
    switch (this.internalReadiness()) {
      case 'ready':
        return { label: 'Internal', tone: 'info' };
      case 'failed':
        return { label: 'Failed', tone: 'danger' };
      case 'pending':
        return { label: 'Setting up', tone: 'warn' };
      default:
        return null;
    }
  });

  protected readonly hasEndpointLine = computed(() =>
    this.isPublic() ? !!this.counts().primary : !this.isBuildingBlock(),
  );

  constructor() {
    effect(async () => {
      const slug = this.catalogSlug();
      this.entrypointPath.set(slug ? await this.catalog.getEntrypointPathBySlug(slug) : undefined);
    });
  }
}
