import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { StatTileData } from '../../../shared/components/charts/chart.models';
import { AppConfigService } from '../../../core/services/app-config.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { FleetService } from '../../service/fleet.service';
import { accessOf } from '../../model/app-access';
import { AppGroupView, getStatusLabel } from '../../model/application.models';
import { FlLineChart } from '../../../ui/patterns/chart';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { statusTone } from '../application/applications-list-rows';
import { DashboardFleetTilesComponent } from './dashboard-fleet-tiles.component';
import { DashboardClustersTableComponent } from './dashboard-clusters-table.component';
import { GuestAppReading, appTiles, copiesOf, historyRange, primaryOf } from './guest-home';
import { statusToneOf } from './home-state';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { DashboardSurfaceRevision } from './dashboard-surface';
import {
  buildGuestHomeSurface,
  guestHomeContent,
  GuestHomeSurfaceInput,
} from './guest-home-surface';

const EXPLORE_TEXT =
  'The apps here are real and running. Open them, read their logs and metrics, look inside their database.';
const INSTALL_TEXT =
  'This demo is read-only. Install Flui on your own server: it is free and open source.';

const REFRESH_MS = 60_000;

/**
 * The first screen of a demo guest, laid out like the operator's: the cluster
 * they are on with the same tiles and table, the showcase with its own charts,
 * and the ways to install Flui for themselves. Every figure is read from the instance.
 */
@Component({
  selector: 'app-guest-home',
  imports: [
    RouterLink,
    FlLineChart,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlTable,
    FlButton,
    FlStatus,
    DashboardFleetTilesComponent,
    DashboardClustersTableComponent,
  ],
  host: { class: 'fl-stack' },
  template: `
    <div class="fl-stack" data-testid="guest-home">
      <app-dashboard-fleet-tiles />

      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div class="fl-stack min-w-0 lg:col-span-2">
          @for (item of showcase(); track item.id) {
            <fl-panel [title]="item.name" data-testid="guest-showcase">
              <ng-container panelActions>
                @if (copiesOf(item.id); as copies) {
                  <span class="fl-toolbar__info">{{ copies }} copies ready</span>
                }
                <a flButton="ghost" size="sm" [routerLink]="['/apps/recap', item.groupId]"
                  >How it is built</a
                >
                @if (item.url) {
                  <a flButton size="sm" [href]="item.url" target="_blank" rel="noopener">Open it</a>
                }
              </ng-container>
              <div class="flex flex-col gap-4">
                @if (item.note) {
                  <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ item.note }}</p>
                }
                <div class="fl-util-grid">
                  @for (tile of tilesOf(item.id); track tile.label) {
                    <figure class="fl-util">
                      <figcaption class="fl-util__head">
                        <span class="fl-util__label">{{ tile.label }}</span>
                        <span class="fl-util__value">{{ tile.value }}{{ tile.unit }}</span>
                      </figcaption>
                      @if (tile.spark && tile.spark.length > 1) {
                        <fl-line-chart
                          [compact]="true"
                          [series]="[{ label: tile.label, points: tile.spark }]"
                          [max]="scaleOf(tile)"
                          [xLabels]="['−' + fleetWindow(), 'Now']"
                          [reading]="tile.label + ' ' + tile.value + (tile.unit ?? '') + ' now'"
                        />
                      }
                      <span class="fl-util__caption" [title]="tile.deltaHint ?? ''">
                        {{ tile.footnote }}{{ tile.delta ? ' · ' + tile.delta : '' }}
                      </span>
                    </figure>
                  }
                </div>
              </div>
            </fl-panel>
          }
          <app-dashboard-clusters-table />
        </div>

        <div class="fl-stack">
          @if (sandbox.hasArea()) {
            <fl-panel title="Your space" [count]="ownApps().length" data-testid="guest-space">
              <div class="flex flex-col gap-3">
                <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                  Your applications stay while you use them: they are removed after
                  {{ sandbox.workloadTtlHours() ?? 24 }} hours without activity.
                </p>
                @if (ownApps().length > 0) {
                  <div class="fl-table-wrap">
                    <table flTable density="dense">
                      <thead>
                        <tr>
                          <th scope="col">Application</th>
                          <th scope="col" class="is-fit">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (own of ownApps(); track own.id) {
                          <tr>
                            <td class="fl-cell-name">
                              <a class="fl-link" [routerLink]="['/apps/recap', own.groupId]">{{
                                own.name
                              }}</a>
                            </td>
                            <td class="is-fit">
                              <fl-status
                                [tone]="toneOf(own.status)"
                                [label]="labelOf(own.status)"
                              />
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
                @if (sandbox.quota(); as q) {
                  <fl-key-value>
                    <fl-kv-item key="CPU">{{ q.cpu }}</fl-kv-item>
                    <fl-kv-item key="Memory">{{ q.memory }}</fl-kv-item>
                    <fl-kv-item key="Disk">{{ q.storage }}</fl-kv-item>
                  </fl-key-value>
                }
              </div>
            </fl-panel>
          }

          <fl-panel title="Explore the showcase" data-testid="guest-explore">
            <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="sandbox-guide-text">
              {{ exploreText }}
            </p>
          </fl-panel>

          <fl-panel title="Run it yourself" data-testid="guest-install">
            <div class="flex flex-col gap-3">
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ installText }}</p>
              <a
                flButton="primary"
                class="self-start"
                [href]="installUrl"
                target="_blank"
                rel="noopener"
                data-testid="guest-install-link"
                >Install Flui</a
              >
              <div
                class="flex flex-col gap-2 border-t border-fl-border pt-3"
                data-testid="guest-ways"
              >
                <span class="text-fl-body-sm font-semibold">Three ways to install</span>
                <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
                  @for (way of installWays; track way.label) {
                    <li>
                      <a class="fl-link" [href]="installUrl" target="_blank" rel="noopener">{{
                        way.label
                      }}</a>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </fl-panel>
        </div>
      </div>
    </div>
  `,
})
export class GuestHomeComponent implements OnInit {
  protected readonly sandbox = inject(SandboxService);
  protected readonly installUrl = INSTALL_FLUI_URL;
  protected readonly exploreText = EXPLORE_TEXT;
  protected readonly installText = INSTALL_TEXT;
  protected readonly installWays = [
    { label: 'Guided, with your provider API key' },
    { label: 'On a server you already have' },
    { label: 'From the command line' },
  ];
  private readonly applications = inject(ApplicationService);
  private readonly clusters = inject(ClusterService);
  private readonly fleet = inject(FleetService);
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(AppConfigService).apiBaseUrl}/api/v1`;

  private readonly readings = signal<Record<string, GuestAppReading>>({});
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new DashboardSurfaceRevision();
  private readonly loaded = signal(false);

  protected readonly showcase = computed(() =>
    this.applications
      .applicationGroups()
      .filter((group: AppGroupView) => accessOf(primaryOf(group))?.showcase)
      .map((group) => {
        const primary = primaryOf(group);
        return {
          id: primary?.id ?? group.id,
          groupId: group.id,
          name: group.name,
          note: primary?.description ?? null,
          url: group.url ?? primary?.url ?? null,
        };
      }),
  );

  protected readonly ownApps = computed(() =>
    this.applications
      .applicationGroups()
      .filter((group: AppGroupView) => !accessOf(primaryOf(group))?.showcase)
      .map((group) => ({
        id: primaryOf(group)?.id ?? group.id,
        groupId: group.id,
        name: group.name,
        status: String(group.status),
      })),
  );

  private readonly surfaceInput = computed<GuestHomeSurfaceInput>(() => ({
    loading: !this.loaded(),
    showcase: this.showcase().map((item) => ({
      id: item.id,
      name: item.name,
      note: item.note,
      hasLink: !!item.url,
    })),
    hasArea: this.sandbox.hasArea(),
    visitor: this.sandbox.visitor(),
    ownApps: this.ownApps(),
    workloadTtlHours: this.sandbox.workloadTtlHours(),
    quota: this.sandbox.quota(),
    areas: this.sandbox.areas(),
    exploreText: EXPLORE_TEXT,
    installText: INSTALL_TEXT,
    installWays: this.installWays.map((way) => way.label),
  }));

  private readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildGuestHomeSurface(input, {
      revision: this.surfaceRevision.next(guestHomeContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnInit(): void {
    void this.applications.loadApplications().finally(() => this.loaded.set(true));
    void this.clusters.loadClusters();
    void this.fleet.loadMetrics();
  }

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
    const asked = computed(
      () =>
        `${this.fleet.window()}|${this.showcase()
          .map((item) => item.id)
          .join(',')}`,
    );
    effect(() => {
      asked();
      untracked(() => this.read());
    });
    const timer = setInterval(() => {
      void this.fleet.loadMetrics();
      this.read();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected readonly fleetWindow = computed(() => this.fleet.window());

  protected scaleOf(tile: StatTileData): number {
    if (tile.unit === '%') return 100;
    const peak = Math.max(...(tile.spark ?? [0]));
    return peak > 0 ? peak * 1.2 : 1;
  }

  protected toneOf(status: string): StatusTone {
    return statusToneOf(statusTone(status));
  }

  protected labelOf(status: string): string {
    return getStatusLabel(status as AppGroupView['status']);
  }

  protected tilesOf(appId: string): StatTileData[] {
    return appTiles(this.readings()[appId]);
  }

  protected copiesOf(appId: string): string | null {
    return copiesOf(this.readings()[appId]);
  }

  private read(): void {
    const params = historyRange(this.fleet.window());
    for (const item of this.showcase()) {
      const app = `${this.base}/observability/applications/${item.id}`;
      forkJoin({
        history: this.http
          .get<Record<string, unknown>>(`${app}/metrics/history`, { params })
          .pipe(catchError(() => of(null))),
        traffic: this.http
          .get<Record<string, unknown>>(`${app}/traffic/history`, { params })
          .pipe(catchError(() => of(null))),
      }).subscribe((reading) => this.readings.update((all) => ({ ...all, [item.id]: reading })));
    }
  }
}
