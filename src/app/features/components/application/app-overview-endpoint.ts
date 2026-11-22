import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { Application } from '../../model/application.models';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl, CATALOG_APP_LABEL } from '../../model/open-app-url';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { CatalogService } from '../../service/catalog.service';
import { statusToneOf } from '../dashboard/home-state';
import { endpointCountsOf } from './app-overview-view';
import { endpointHealth } from './app-recap-view';

type InternalReadiness = 'pending' | 'failed' | 'ready' | 'not-configured';

@Component({
  selector: 'app-overview-endpoint',
  imports: [RouterLink, FlIcon, FlStatus],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'fl-kv__item col-span-full', '[hidden]': '!visible()' },
  template: `
    @let a = app();
    @if (isPublic()) {
      @if (counts().primary; as ep) {
        @let r = readiness();
        <span class="fl-kv__key">Public endpoint</span>
        <span class="fl-kv__value">
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
        </span>
      }
    } @else if (!isBuildingBlock()) {
      @let i = internalReadiness();
      <span class="fl-kv__key">Internal endpoint</span>
      <span class="fl-kv__value">
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
      </span>
    }
  `,
})
export class AppOverviewEndpoint {
  private readonly catalog = inject(CatalogService);
  private readonly endpointsService = inject(AppEndpointsService);

  readonly app = input.required<Application>();

  protected readonly tone = statusToneOf;
  protected readonly isPublic = computed(() => hasPublicEndpoint(this.app()));
  protected readonly isBuildingBlock = computed(() => isBuildingBlock(this.app()));
  protected readonly counts = computed(() =>
    endpointCountsOf(this.endpointsService.endpoints(), this.app().id),
  );
  protected readonly visible = computed(() =>
    this.isPublic() ? !!this.counts().primary : !this.isBuildingBlock(),
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

  constructor() {
    effect(async () => {
      const slug = this.catalogSlug();
      this.entrypointPath.set(slug ? await this.catalog.getEntrypointPathBySlug(slug) : undefined);
    });
  }
}
