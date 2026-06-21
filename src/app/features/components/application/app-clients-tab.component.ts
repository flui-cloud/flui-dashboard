import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDatabase } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { consoleRouteFor, engineFamilyOf } from '../../model/db-engine';
import { InternalServiceInfoComponent } from './internal-service-info.component';

@Component({
  selector: 'app-app-clients-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, InternalServiceInfoComponent, RouterLink],
  providers: [provideIcons({ lucideDatabase })],
  template: `
    <div class="space-y-5">
      @if (applicationSlug() && namespace()) {
        <app-internal-service-info
          [applicationSlug]="applicationSlug()!"
          [namespace]="namespace()!"
          [port]="port()"
        />
      }

      @if (consoleTarget(); as c) {
        <div class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideDatabase" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground">{{ c.title }}</h3>
              <p class="mt-1 text-xs text-muted-foreground">{{ c.desc }}</p>
              <a
                [routerLink]="[c.route, c.id]"
                class="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <ng-icon name="lucideDatabase" class="h-3 w-3" />
                {{ c.cta }}
              </a>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AppClientsTabComponent {
  private readonly appService = inject(ApplicationService);

  protected readonly applicationSlug = computed(
    () => this.appService.selectedApplication()?.slug ?? null,
  );
  protected readonly namespace = computed(
    () => this.appService.selectedApplication()?.k8sNamespace ?? null,
  );
  protected readonly port = computed(() => this.appService.selectedApplication()?.port);

  protected readonly consoleTarget = computed(() => {
    const app = this.appService.selectedApplication();
    const route = consoleRouteFor(app);
    if (!route || !app) return null;
    const copy = {
      sql: {
        title: 'Access this database',
        desc: 'Run SQL straight from your browser with the built-in console — nothing to install, credentials stay in the cluster, and queries are read-only by default.',
        cta: 'Open Query console',
      },
      keyvalue: {
        title: 'Browse this datastore',
        desc: 'Browse keys and values from your browser with the built-in key browser — nothing to install, credentials stay in the cluster, read-only by default.',
        cta: 'Open Key Browser',
      },
      document: {
        title: 'Browse this database',
        desc: 'Browse databases, collections and documents from your browser with the built-in document browser — nothing to install, credentials stay in the cluster, read-only by default.',
        cta: 'Open Document Browser',
      },
      'object-storage': {
        title: 'Browse this object store',
        desc: 'Browse buckets and files from your browser with the built-in storage browser — upload, download, delete and share, all proxied through Flui so the store stays private.',
        cta: 'Open Storage Browser',
      },
      search: {
        title: 'Search this engine',
        desc: 'Browse indices and run full-text or query-DSL searches from your browser with the built-in search console — nothing to install, credentials stay in the cluster, read-only.',
        cta: 'Open Search Console',
      },
      messaging: {
        title: 'Monitor this server',
        desc: 'Watch server stats and streams/queues, manage them, and publish or peek messages from your browser with the built-in messaging console — nothing to install, credentials stay in the cluster.',
        cta: 'Open Messaging Console',
      },
      cache: {
        title: 'Inspect this cache',
        desc: 'Watch cache stats (hit ratio, items, memory, evictions) and look up, set or delete entries by key from your browser with the built-in cache console — nothing to install, read-only by default.',
        cta: 'Open Cache Console',
      },
      secrets: {
        title: 'Manage secrets',
        desc: 'Browse the secret path tree, read versioned values and write or delete them from your browser with the built-in secrets console — nothing to install, the token stays in the cluster, read-only by default.',
        cta: 'Open Secrets Console',
      },
      streaming: {
        title: 'Operate this cluster',
        desc: 'See topics and consumer-group lag, then run kafka-shell commands (or ask the AI copilot to write them) from your browser with the built-in Kafka console — nothing to install, read-only by default.',
        cta: 'Open Kafka Console',
      },
      fulltext: {
        title: 'Search this engine',
        desc: 'Browse indexes and run text/filter searches from your browser, plus a raw REST Dev Tools console and an AI copilot — nothing to install, the key stays in the cluster, read-only by default.',
        cta: 'Open Meilisearch Console',
      },
    }[engineFamilyOf(app) ?? 'sql'];
    return { route, id: app.id, ...copy };
  });
}
