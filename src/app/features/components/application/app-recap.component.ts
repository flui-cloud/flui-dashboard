import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideCircleAlert, lucideLoader, lucideShieldAlert } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ClusterService } from '../../service/cluster.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { databaseEngineOf } from '../../model/db-engine';
import { Application, getSourceTypeLabel } from '../../model/application.models';
import { AppDeleteDialogComponent } from './app-delete-dialog.component';
import { AppRecapActivityComponent } from './app-recap-activity.component';
import { AppRecapDatabaseComponent } from './app-recap-database.component';
import { AppRecapHeaderComponent } from './app-recap-header.component';
import { AppRecapManageComponent } from './app-recap-manage.component';
import { AppRecapStore } from './app-recap-store';
import { AppRecapSummaryComponent } from './app-recap-summary.component';
import { AppRecapTopologyComponent } from './app-recap-topology.component';
import {
  backupAlarms,
  componentCard,
  internalNote,
  runningSummary,
  splitCards,
} from './app-recap-bundle';
import {
  backLabel,
  backLink,
  endpointHostOf,
  headerMeta,
  hostnameOf,
  kindChip,
  kindLabel,
  listRouteForKind,
  openUrlOf,
} from './app-recap-header';
import { RecapFact, backupBand, endpointHealth, releaseFact, replicasFact, resourcesFact, routeOf } from './app-recap-view';
import {
  AppRecapSurfaceInput,
  AppRecapSurfaceRevision,
  buildAppRecapSurface,
  presentedContent as appRecapPresentedContent,
} from './app-recap-surface';

@Component({
  selector: 'app-recap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    MaskIdPipe,
    AppDeleteDialogComponent,
    AppRecapActivityComponent,
    AppRecapDatabaseComponent,
    AppRecapHeaderComponent,
    AppRecapManageComponent,
    AppRecapSummaryComponent,
    AppRecapTopologyComponent,
  ],
  providers: [AppRecapStore, provideIcons({ lucideArrowLeft, lucideCircleAlert, lucideLoader, lucideShieldAlert })],
  template: `
    <div class="mx-auto max-w-6xl space-y-5 p-6">
      @let g = group();
      @if (g) {
        @let p = primary();
        <app-recap-header
          [group]="g"
          [kindChip]="kindChip()"
          [meta]="headerMeta()"
          [backLink]="backLink()"
          [backLabel]="backLabel()"
          [logsAppId]="isComposed() && p ? p.id : null"
          [recapPath]="recapPath()"
          [openUrl]="openUrl()"
        />

        @if (!isComposed() && p) {
          <app-recap-summary
            [app]="p"
            [endpointHost]="endpointHost()"
            [openUrl]="openUrl()"
            [health]="health()"
            [facts]="facts()"
            [band]="primaryBackup()"
            [protectionLoaded]="store.protectionLoaded()"
            [runState]="store.runState()"
            [recapPath]="recapPath()"
            (backUp)="store.backUpNow($event)"
          />

          @if (isDatabase(p)) {
            <app-recap-database
              [app]="p"
              [named]="dbComponents().length > 1"
              [metrics]="store.metrics()[p.id]"
              [protection]="store.protection()[p.id]"
              [connInfo]="connInfoFor(p.id)"
            />
          }

          <app-recap-manage [appId]="p.id" [recapPath]="recapPath()" />

          <app-delete-dialog [group]="g" [primary]="p" [listRoute]="listRouteForKind()" [compact]="true">
            {{ sourceLabel(p) }} · {{ p.exposure }} · namespace <span class="font-mono">{{ p.k8sNamespace | maskId }}</span>
          </app-delete-dialog>
        } @else if (p) {
          @for (alarm of alarms(); track alarm.app.id) {
            <a
              [routerLink]="route(alarm.path).path"
              [queryParams]="route(alarm.path).query"
              class="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100/70 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              data-testid="recap-backup-alarm"
            >
              <ng-icon name="lucideShieldAlert" class="h-5 w-5 text-amber-700 dark:text-amber-400" />
              <span class="text-sm font-semibold text-foreground">{{ alarm.title }}</span>
              <span class="flex-1 text-sm text-muted-foreground">{{ alarm.detail }}</span>
              <span class="text-sm font-semibold text-primary">Protect it</span>
            </a>
          }

          <app-recap-topology
            [endpointHost]="endpointHost()"
            [health]="health()"
            [front]="topology().front"
            [back]="topology().back"
            [summary]="runningSummary()"
            [note]="internalNote()"
            [protectionLoaded]="store.protectionLoaded()"
            [runState]="store.runState()"
            (backUp)="store.backUpNow($event)"
          />

          <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div class="space-y-5">
              @for (db of dbComponents(); track db.id) {
                <app-recap-database
                  [app]="db"
                  [named]="dbComponents().length > 1"
                  [metrics]="store.metrics()[db.id]"
                  [protection]="store.protection()[db.id]"
                  [connInfo]="connInfoFor(db.id)"
                />
              }
            </div>
            <app-recap-activity [events]="store.events()" [loaded]="store.eventsLoaded()" [appId]="p.id" [recapPath]="recapPath()" />
          </div>

          <app-delete-dialog [group]="g" [primary]="p" [listRoute]="listRouteForKind()" [compact]="true">
            ID <span class="font-mono">{{ p.slug | maskId }}</span> · components
            @for (c of g.components; track c.id; let last = $last) {
              <span class="font-mono">{{ c.slug | maskId }}</span>{{ last ? '' : ', ' }}
            }
          </app-delete-dialog>
        }
      } @else if (loadAttempted()) {
        <a
          [routerLink]="backLink()"
          [attr.aria-label]="backLabel()"
          [title]="backLabel()"
          class="inline-flex rounded-lg border border-border p-2 transition-colors hover:bg-muted"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </a>
        <div class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          <ng-icon name="lucideCircleAlert" class="h-8 w-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Application not found.</p>
        </div>
      } @else {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Loading…
        </div>
      }
    </div>
  `,
})
export class AppRecapComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly endpointsService = inject(AppEndpointsService);
  private readonly clusterService = inject(ClusterService);
  private readonly route$ = inject(ActivatedRoute);
  private readonly maskMode = inject(MaskModeService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  protected readonly store = inject(AppRecapStore);

  protected readonly loadAttempted = signal(false);
  private readonly surfaceRevision = new AppRecapSurfaceRevision();
  private loadedFor: string | null = null;

  private readonly id = toSignal(
    this.route$.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route$.snapshot.paramMap.get('id') },
  );

  private readonly from = toSignal(
    this.route$.queryParamMap.pipe(map((p) => p.get('from'))),
    { initialValue: this.route$.snapshot.queryParamMap.get('from') },
  );

  protected readonly group = computed(
    () => this.appService.applicationGroups().find((x) => x.id === this.id()) ?? null,
  );

  protected readonly primary = computed(() => {
    const g = this.group();
    if (!g) return null;
    return g.components.find((c) => c.id === g.primaryComponentId) ?? g.components[0] ?? null;
  });

  protected readonly listRouteForKind = computed(() => listRouteForKind(this.primary()?.kind));
  protected readonly backLink = computed(() => backLink(this.from(), this.primary()?.kind));
  protected readonly backLabel = computed(() => backLabel(this.from(), this.primary()?.kind));

  protected readonly isComposed = computed(() => this.group()?.type === 'composed');
  protected readonly recapPath = computed(() => `/apps/recap/${this.group()?.id ?? ''}`);

  protected readonly dbComponents = computed(() =>
    (this.group()?.components ?? []).filter((c) => databaseEngineOf(c)),
  );

  private readonly rawUrl = computed(() => this.group()?.url ?? this.primary()?.url ?? '');
  protected readonly endpointHost = computed(() => endpointHostOf(this.rawUrl()));

  private readonly webTls = computed(() => {
    const raw = this.rawUrl();
    if (!raw) return null;
    const host = hostnameOf(raw);
    const ep = this.endpointsService.endpoints().find((e) => e.fqdn === host);
    return ep ? !!ep.tlsEnabled : null;
  });

  protected readonly openUrl = computed(() => openUrlOf(this.rawUrl(), this.webTls()));
  protected readonly health = computed(() => endpointHealth(this.primary(), this.webTls()));

  private readonly clusterName = computed(() => {
    const id = this.group()?.clusterId;
    return this.clusterService.clusters().find((c) => c.id === id)?.name ?? '';
  });

  protected readonly kindChip = computed(() => {
    const g = this.group();
    return g ? kindChip(g, this.primary()) : '';
  });

  protected readonly headerMeta = computed(() => {
    const g = this.group();
    return g ? headerMeta(g, this.primary(), this.clusterName()) : [];
  });

  protected readonly facts = computed<RecapFact[]>(() => {
    const p = this.primary();
    const m = p ? this.store.metrics()[p.id] : null;
    return [replicasFact(m), resourcesFact(m), releaseFact(this.store.release())];
  });

  protected readonly primaryBackup = computed(() => {
    const p = this.primary();
    return p ? backupBand(this.store.protection()[p.id]) : null;
  });

  protected readonly topology = computed(() => {
    const primaryId = this.primary()?.id;
    const cards = (this.group()?.components ?? []).map((c) =>
      componentCard(c, this.store.metrics()[c.id], this.store.protection()[c.id], c.id === primaryId),
    );
    return splitCards(cards, primaryId);
  });

  protected readonly runningSummary = computed(() => runningSummary(this.group()?.components ?? []));
  protected readonly internalNote = computed(() => internalNote(this.topology().back));
  protected readonly alarms = computed(() =>
    backupAlarms(this.group()?.components ?? [], this.store.protection(), this.store.metrics()),
  );

  private readonly accessKind = computed<'db' | 'web' | 'none'>(() => {
    const p = this.primary();
    if (!p) return 'none';
    if (databaseEngineOf(p)) return 'db';
    if (this.rawUrl()) return 'web';
    return 'none';
  });

  private readonly surfaceInput = computed<AppRecapSurfaceInput>(() => {
    const g = this.group();
    const p = this.primary();
    return {
      groupId: this.id(),
      group: g
        ? {
            id: g.id,
            name: g.name,
            type: g.type,
            status: g.status,
            category: g.category,
            createdAt: g.createdAt,
            clusterId: g.clusterId,
            clusterName: this.clusterName() || undefined,
          }
        : null,
      primary: p
        ? {
            id: p.id,
            slug: p.slug,
            kindLabel: kindLabel(p.kind),
            sourceLabel: getSourceTypeLabel(p.sourceType),
            exposure: p.exposure,
            replicas: p.replicas ?? 0,
            catalogVersion: p.catalogVersion,
          }
        : null,
      accessKind: this.accessKind(),
      notFound: this.loadAttempted() && !g,
      isLoading: !this.loadAttempted(),
      extraDatabases: this.dbComponents()
        .filter((db) => db.id !== p?.id)
        .map((db) => ({ id: db.id, name: db.name, status: db.status })),
      backupCoverage: p ? (this.store.protection()[p.id]?.coverage?.coverage ?? null) : null,
    };
  });

  protected readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildAppRecapSurface(input, {
      revision: this.surfaceRevision.next(appRecapPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });

    effect(() => {
      this.store.requestConnInfo(this.dbComponents().map((db) => db.id));
    });

    effect(() => {
      const g = this.group();
      if (!g || this.loadedFor === g.id) return;
      this.loadedFor = g.id;
      void this.store.load(g, this.primary());
    });

    // Connection info is fetched once per app, so a mask-mode toggle mid-visit
    // would leave the connect card showing the host fetched under the previous state.
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.store.reloadConnInfo(this.dbComponents().map((db) => db.id));
    });
  }

  ngOnInit(): void {
    void (async () => {
      if (this.appService.applications().length === 0 || !this.group()) {
        try {
          await this.appService.loadApplications();
        } catch {
          return;
        }
      }
      this.loadAttempted.set(true);
      if (this.clusterService.clusters().length === 0) {
        this.clusterService.loadClusters().catch(() => undefined);
      }
      const clusterId = this.group()?.clusterId;
      if (clusterId && this.rawUrl()) {
        void this.endpointsService.loadEndpoints(clusterId);
      }
    })();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  protected connInfoFor(appId: string) {
    return this.store.connInfo()[appId] ?? null;
  }

  protected isDatabase(app: Application): boolean {
    return !!databaseEngineOf(app);
  }

  protected sourceLabel(app: Application): string {
    return getSourceTypeLabel(app.sourceType);
  }

  protected route(path: string) {
    return routeOf(path);
  }
}
