import {
  ChangeDetectionStrategy,
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
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBot,
  lucideExternalLink,
  lucideGitBranch,
  lucideStore,
} from '@ng-icons/lucide';
import { catchError, forkJoin, of } from 'rxjs';
import { StatTileComponent } from '../../../shared/components/charts';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { StatTileData } from '../../../shared/components/charts/chart.models';
import { AppConfigService } from '../../../core/services/app-config.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { FleetService } from '../../service/fleet.service';
import { accessOf } from '../../model/app-access';
import { AppGroupView } from '../../model/application.models';
import { DashboardFleetTilesComponent } from './dashboard-fleet-tiles.component';
import { DashboardClustersTableComponent } from './dashboard-clusters-table.component';
import { GuestAppReading, appTiles, copiesOf, historyRange, primaryOf } from './guest-home';

const REFRESH_MS = 60_000;

/**
 * The first screen of a demo guest, laid out like the operator's: the cluster
 * they are on with the same tiles and table, the showcase with its own charts,
 * and the space they get by deploying. Every figure is read from the instance.
 */
@Component({
  selector: 'app-guest-home',
  standalone: true,
  imports: [RouterLink, NgIcon, ExplainComponent, StatTileComponent, DashboardFleetTilesComponent, DashboardClustersTableComponent],
  providers: [provideIcons({ lucideArrowRight, lucideBot, lucideExternalLink, lucideGitBranch, lucideStore })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 md:gap-5" data-testid="guest-home">
      <app-dashboard-fleet-tiles />

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <div class="flex flex-col gap-4 min-w-0">
          @for (item of showcase(); track item.id) {
            <section class="flex flex-col gap-4" data-testid="guest-showcase">
              <div class="card-surface px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-label">In the showcase</p>
                  <h2 class="font-semibold text-foreground">{{ item.name }}</h2>
                  @if (item.note) {
                    <p class="text-sm text-muted-foreground mt-0.5">{{ item.note }}</p>
                  }
                </div>
                <div class="flex items-center gap-3">
                  @if (copiesOf(item.id); as copies) {
                    <span class="text-xs text-muted-foreground">{{ copies }} copies ready</span>
                  }
                  <a [routerLink]="['/apps/recap', item.groupId]" class="text-xs font-medium text-primary hover:underline">How it is built</a>
                  @if (item.url) {
                    <a
                      [href]="item.url"
                      target="_blank"
                      rel="noopener"
                      class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Open it
                      <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
                    </a>
                  }
                </div>
              </div>
              <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
                @for (tile of tilesOf(item.id); track tile.label) {
                  <app-stat-tile [data]="tile" [sparkWidth]="140" />
                }
              </div>
            </section>
          }
          <app-dashboard-clusters-table />
        </div>

        <div class="flex flex-col gap-4">
          <section class="card-surface p-5 flex flex-col gap-3" data-testid="guest-space">
            <p class="text-label">Your space</p>
            @if (sandbox.hasArea()) {
              <app-explain [label]="ownApps().length === 1 ? '1 application' : ownApps().length + ' applications'" labelClass="font-semibold text-foreground" floating>
                They stay while you use them: removed after {{ sandbox.workloadTtlHours() ?? 24 }} hours without activity.
              </app-explain>
              @if (ownApps().length > 0) {
                <ul class="flex flex-col -mx-2">
                  @for (own of ownApps(); track own.id) {
                    <li>
                      <a [routerLink]="['/apps/recap', own.groupId]" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                        <span class="flex-1 truncate text-foreground">{{ own.name }}</span>
                        <span class="text-xs text-muted-foreground">{{ own.status }}</span>
                      </a>
                    </li>
                  }
                </ul>
              }
            } @else {
              <app-explain label="Try the thing that matters" labelClass="font-semibold text-foreground" floating>
                <span data-testid="sandbox-guide-text">
                  The apps in the showcase are real and running: open them, read their logs and metrics. Install one
                  yourself and you get a space of your own.
                </span>
              </app-explain>
              <p class="text-sm text-muted-foreground">Your app, live on a real address with a real certificate, in about a minute.</p>
              <a
                routerLink="/apps/catalog"
                class="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Open the catalogue
                <ng-icon name="lucideArrowRight" class="h-4 w-4" />
              </a>
            }
            @if (sandbox.quota(); as q) {
              <dl class="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                <div class="pt-2"><dt class="text-label">CPU</dt><dd class="text-sm font-semibold text-foreground">{{ q.cpu }}</dd></div>
                <div class="pt-2"><dt class="text-label">Memory</dt><dd class="text-sm font-semibold text-foreground">{{ q.memory }}</dd></div>
                <div class="pt-2"><dt class="text-label">Disk</dt><dd class="text-sm font-semibold text-foreground">{{ q.storage }}</dd></div>
              </dl>
            }
          </section>

          <section class="card-surface p-5 flex flex-col gap-2" data-testid="guest-ways">
            <p class="text-label">Three ways in</p>
            <a routerLink="/apps/catalog" class="guest-way">
              <ng-icon name="lucideStore" class="h-4 w-4 text-muted-foreground" /> From the catalogue
              <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </a>
            <a routerLink="/apps/repositories" class="guest-way">
              <ng-icon name="lucideGitBranch" class="h-4 w-4 text-muted-foreground" /> From your GitHub repository
              <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </a>
            <a routerLink="/agents" class="guest-way">
              <ng-icon name="lucideBot" class="h-4 w-4 text-muted-foreground" /> With your coding agent
              <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </a>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .guest-way {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.375rem;
        padding: 0.5rem 0.5rem;
        margin: 0 -0.5rem;
        font-size: 0.875rem;
        color: var(--foreground);
      }
      .guest-way:hover {
        background: color-mix(in oklab, var(--muted) 40%, transparent);
      }
    `,
  ],
})
export class GuestHomeComponent implements OnInit {
  protected readonly sandbox = inject(SandboxService);
  private readonly applications = inject(ApplicationService);
  private readonly clusters = inject(ClusterService);
  private readonly fleet = inject(FleetService);
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(AppConfigService).apiBaseUrl}/api/v1`;

  private readonly readings = signal<Record<string, GuestAppReading>>({});

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

  ngOnInit(): void {
    void this.applications.loadApplications();
    void this.clusters.loadClusters();
    void this.fleet.loadMetrics();
  }

  constructor() {
    const asked = computed(() => `${this.fleet.window()}|${this.showcase().map((item) => item.id).join(',')}`);
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
        history: this.http.get<Record<string, unknown>>(`${app}/metrics/history`, { params }).pipe(catchError(() => of(null))),
        traffic: this.http.get<Record<string, unknown>>(`${app}/traffic/history`, { params }).pipe(catchError(() => of(null))),
      }).subscribe((reading) => this.readings.update((all) => ({ ...all, [item.id]: reading })));
    }
  }
}
