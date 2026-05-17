import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleCheck,
  lucideExternalLink,
  lucideLoader,
  lucidePlug,
  lucidePlus,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { CatalogService } from '../../service/catalog.service';
import { CatalogClientResponseDto } from '../../../core/api/model/models';
import { Application } from '../../model/application.models';
import { CATALOG_APP_LABEL, buildOpenAppUrl } from '../../model/open-app-url';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { InternalServiceInfoComponent } from './internal-service-info.component';

interface ClientRow {
  catalog: CatalogClientResponseDto;
  installed: Application[];
}

@Component({
  selector: 'app-app-clients-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, InternalServiceInfoComponent],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCircleCheck,
      lucideExternalLink,
      lucideLoader,
      lucidePlug,
      lucidePlus,
    }),
  ],
  template: `
    <div class="space-y-5">
      @if (applicationSlug() && namespace()) {
        <app-internal-service-info
          [applicationSlug]="applicationSlug()!"
          [namespace]="namespace()!"
          [port]="port()"
        />
      }

      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-foreground">Compatible clients</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              Install a browser UI to access this database. Credentials will be wired
              automatically — no passwords to copy.
            </p>
          </div>
          @if (loadingClients()) {
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-muted-foreground" />
          }
        </div>

        @if (!loadingClients() && !buildingBlockSlug()) {
          <p class="mt-3 text-xs text-muted-foreground">
            This app is not linked to a catalog entry, so we can't list compatible
            clients automatically.
          </p>
        } @else if (!loadingClients() && rows().length === 0) {
          <p class="mt-3 text-xs text-muted-foreground">
            No compatible clients are published yet for this building block.
          </p>
        } @else if (rows().length > 0) {
          <ul class="mt-4 space-y-2">
            @for (row of rows(); track row.catalog.slug) {
              <li class="rounded-lg border border-border bg-muted/20 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate text-sm font-medium text-foreground">
                        {{ row.catalog.name }}
                      </span>
                      @if (row.catalog.isDefault) {
                        <span
                          title="Recommended client for this building block"
                          class="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                        >
                          ⭐ Default
                        </span>
                      }
                      @if (row.catalog.clientFor.length > 1) {
                        <span
                          [title]="'Compatible with ' + row.catalog.clientFor.length + ' building blocks'"
                          class="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
                        >
                          Multi-DB
                        </span>
                      }
                      @if (row.installed.length > 0) {
                        <span
                          class="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                        >
                          <ng-icon name="lucideCheck" class="h-3 w-3" />
                          Installed@if (row.installed.length > 1) {
                            &nbsp;· {{ row.installed.length }}
                          }
                        </span>
                      }
                    </div>
                    @if (row.catalog.description) {
                      <div class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {{ row.catalog.description }}
                      </div>
                    }
                  </div>
                  @if (row.installed.length === 0) {
                    <button
                      type="button"
                      (click)="installClient(row.catalog.slug)"
                      class="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      <ng-icon name="lucidePlus" class="h-3 w-3" />
                      Install
                    </button>
                  }
                </div>

                @if (row.installed.length > 0) {
                  <ul class="mt-3 space-y-1.5 border-t border-border pt-3">
                    @for (app of row.installed; track app.id) {
                      <li class="flex items-center justify-between gap-2 text-xs">
                        <a
                          [href]="'#/apps/applications/' + app.id + '/overview'"
                          (click)="openAppPage($event, app.id)"
                          class="truncate text-muted-foreground hover:text-foreground"
                        >
                          {{ app.name || app.slug }}
                        </a>
                        @let openUrl = openUrlFor(app.id);
                        @if (openUrl) {
                          <a
                            [href]="openUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="shrink-0 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 font-medium text-foreground transition hover:bg-muted"
                          >
                            <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                            Open
                          </a>
                        }
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class AppClientsTabComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly catalog = inject(CatalogService);
  private readonly endpoints = inject(AppEndpointsService);
  private readonly router = inject(Router);

  protected readonly applicationSlug = computed(
    () => this.appService.selectedApplication()?.slug ?? null,
  );
  protected readonly namespace = computed(
    () => this.appService.selectedApplication()?.k8sNamespace ?? null,
  );
  protected readonly port = computed(() => this.appService.selectedApplication()?.port);

  private readonly labels = computed<Record<string, string>>(
    () => (this.appService.selectedApplication()?.labels ?? {}) as Record<string, string>,
  );

  protected readonly buildingBlockSlug = computed(
    () => this.labels()[CATALOG_APP_LABEL] || undefined,
  );

  protected readonly clients = signal<CatalogClientResponseDto[]>([]);
  protected readonly loadingClients = signal(false);

  protected readonly rows = computed<ClientRow[]>(() => {
    const all = this.appService.applications();
    return this.clients().map((c) => ({
      catalog: c,
      installed: all.filter((app) => app.catalogSlug === c.slug),
    }));
  });

  ngOnInit(): void {
    void (async () => {
      void this.loadClients();
      if (this.appService.applications().length === 0) {
        void this.appService.loadApplications();
      }
      const clusterId = this.appService.selectedApplication()?.clusterId;
      if (clusterId) void this.endpoints.loadEndpoints(clusterId);
    })();
  }

  private async loadClients(): Promise<void> {
    const bbSlug = this.buildingBlockSlug();
    if (!bbSlug) return;
    this.loadingClients.set(true);
    try {
      const list = await this.catalog.getCompatibleClients(bbSlug);
      this.clients.set(list);
    } finally {
      this.loadingClients.set(false);
    }
  }

  protected installClient(clientSlug: string): void {
    const bbApp = this.appService.selectedApplication();
    const bbInstallId = bbApp?.catalogInstallId;
    const params: Record<string, string> = { catalogSlug: clientSlug };
    if (bbApp?.id) {
      params['returnTo'] = `/apps/applications/${bbApp.id}/clients`;
    }
    if (bbInstallId) params['autoConnectTo'] = bbInstallId;
    this.router.navigate(['/apps/catalog', clientSlug], { queryParams: params });
  }

  protected openAppPage(event: MouseEvent, appId: string): void {
    event.preventDefault();
    this.router.navigate(['/apps/applications', appId, 'overview']);
  }

  protected openUrlFor(appId: string): string {
    const ep = this.endpoints.endpoints().find((e) => e.applicationId === appId);
    if (!ep?.fqdn) return '';
    return buildOpenAppUrl(ep.fqdn);
  }
}
