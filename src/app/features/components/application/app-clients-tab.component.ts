import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { consoleRouteFor, engineFamilyOf } from '../../model/db-engine';
import { InternalServiceInfoComponent } from './internal-service-info.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-app-clients-tab',
  standalone: true,
  imports: [InternalServiceInfoComponent, RouterLink, FlPanel, FlButton, FlIcon],
  providers: [provideIcons({ lucideDatabase })],
  host: { class: 'fl-stack' },
  template: `
    @if (applicationSlug() && namespace()) {
      <app-internal-service-info
        [applicationSlug]="applicationSlug()!"
        [namespace]="namespace()!"
        [port]="port()"
      />
    }

    @if (consoleTarget(); as c) {
      <fl-panel [title]="c.title">
        <div class="flex flex-col items-start gap-4">
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ c.desc }}</p>
          <a flButton="primary" size="sm" [routerLink]="[c.route, c.id]">
            <fl-icon name="lucideDatabase" />
            {{ c.cta }}
          </a>
        </div>
      </fl-panel>
    }
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
        desc: 'Run SQL from your browser with the built-in console. Nothing to install, credentials stay in the cluster, queries are read-only by default.',
        cta: 'Open query console',
      },
      keyvalue: {
        title: 'Browse this datastore',
        desc: 'Browse keys and values from your browser. Nothing to install, credentials stay in the cluster, read-only by default.',
        cta: 'Open key browser',
      },
      document: {
        title: 'Browse this database',
        desc: 'Browse databases, collections and documents from your browser. Nothing to install, credentials stay in the cluster, read-only by default.',
        cta: 'Open document browser',
      },
      'object-storage': {
        title: 'Browse this object store',
        desc: 'Browse buckets and files from your browser: upload, download, delete and share. Everything goes through Flui, so the store stays private.',
        cta: 'Open storage browser',
      },
      search: {
        title: 'Search this engine',
        desc: 'Browse indices and run full-text or query DSL searches from your browser. Nothing to install, credentials stay in the cluster, read-only.',
        cta: 'Open search console',
      },
      messaging: {
        title: 'Monitor this server',
        desc: 'Watch server stats, streams and queues, manage them, and publish or peek messages from your browser. Nothing to install, credentials stay in the cluster.',
        cta: 'Open messaging console',
      },
      cache: {
        title: 'Inspect this cache',
        desc: 'Watch hit ratio, items, memory and evictions, and look up, set or delete entries by key from your browser. Nothing to install, read-only by default.',
        cta: 'Open cache console',
      },
      secrets: {
        title: 'Manage secrets',
        desc: 'Browse the secret path tree, read versioned values and write or delete them from your browser. Nothing to install, the token stays in the cluster, read-only by default.',
        cta: 'Open secrets console',
      },
      streaming: {
        title: 'Operate this cluster',
        desc: 'See topics and consumer group lag, then run kafka-shell commands, or ask the AI copilot to write them, from your browser. Nothing to install, read-only by default.',
        cta: 'Open Kafka console',
      },
      fulltext: {
        title: 'Search this engine',
        desc: 'Browse indexes and run text and filter searches from your browser, with a REST console and an AI copilot. Nothing to install, the key stays in the cluster, read-only by default.',
        cta: 'Open Meilisearch console',
      },
    }[engineFamilyOf(app) ?? 'sql'];
    return { route, id: app.id, ...copy };
  });
}
