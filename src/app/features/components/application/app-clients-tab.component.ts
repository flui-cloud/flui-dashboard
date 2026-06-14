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
import { consoleRouteFor, isKeyValueDatabase } from '../../model/db-engine';
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
    const kv = isKeyValueDatabase(app);
    return {
      route,
      id: app.id,
      title: kv ? 'Browse this datastore' : 'Access this database',
      desc: kv
        ? 'Browse keys and values from your browser with the built-in key browser — nothing to install, credentials stay in the cluster, read-only by default.'
        : 'Run SQL straight from your browser with the built-in console — nothing to install, credentials stay in the cluster, and queries are read-only by default.',
      cta: kv ? 'Open Key Browser' : 'Open Query console',
    };
  });
}
