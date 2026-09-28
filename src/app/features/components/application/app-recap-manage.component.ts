import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';

const DETAIL_TABS: { label: string; route: string }[] = [
  { label: 'Overview', route: 'overview' },
  { label: 'Logs', route: 'logs' },
  { label: 'Monitoring', route: 'monitoring' },
  { label: 'Configuration', route: 'configuration' },
  { label: 'Resources', route: 'resources' },
  { label: 'Releases', route: 'releases' },
  { label: 'Backup', route: 'snapshots' },
];

@Component({
  selector: 'app-recap-manage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowRight })],
  host: { class: 'block' },
  template: `
    <section class="card-surface p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-foreground">Manage application</h2>
          <p class="text-xs text-muted-foreground">Metrics, logs, configuration, releases and backups in the full panel.</p>
        </div>
        <a
          [routerLink]="['/apps/applications', appId()]"
          [queryParams]="{ returnTo: recapPath() }"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Open panel
          <ng-icon name="lucideArrowRight" class="h-4 w-4" />
        </a>
      </div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        @for (t of detailTabs; track t.route) {
          <a
            [routerLink]="['/apps/applications', appId(), t.route]"
            [queryParams]="{ returnTo: recapPath() }"
            class="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >{{ t.label }}</a>
        }
      </div>
    </section>
  `,
})
export class AppRecapManageComponent {
  readonly appId = input.required<string>();
  readonly recapPath = input.required<string>();

  protected readonly detailTabs = DETAIL_TABS;
}
