import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { ApplicationStatusEnum } from '../../model/application.models';
import { groupListOf, isTool, primaryComponentOf, workloadEntries } from '../../model/workload-list';

interface Segment {
  key: string;
  label: string;
  count: number;
  swatch: string;
  route: string;
  query: Record<string, string>;
}

@Component({
  selector: 'app-dashboard-workloads',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [provideIcons({ lucideArrowRight })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="card-surface p-5 h-full flex flex-col gap-4" data-testid="workloads">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-foreground">Workloads</h2>
        <a routerLink="/apps/applications" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          View all
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </a>
      </div>

      @if (total() === 0) {
        <div class="flex flex-col gap-1 py-2">
          <p class="text-sm text-muted-foreground">No applications yet</p>
          <a routerLink="/apps/deploy/new" class="text-xs font-medium text-primary hover:underline">Deploy your first app</a>
        </div>
      } @else {
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold tracking-tight text-foreground" data-testid="workloads-running">{{ running() }}</span>
          <span class="text-sm text-muted-foreground">
            running ·
            <span [class]="failed() > 0 ? 'text-destructive font-medium' : ''" data-testid="workloads-failed">{{ failed() }} failed</span>
          </span>
        </div>
        <div class="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-muted" aria-hidden="true">
          @for (s of segments(); track s.key) {
            @if (s.count > 0) {
              <div [class]="s.swatch" [style.flex-grow]="s.count"></div>
            }
          }
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          @for (s of segments(); track s.key) {
            <a [routerLink]="s.route" [queryParams]="s.query" class="inline-flex items-center gap-1.5 hover:text-foreground" [attr.data-testid]="'workloads-' + s.key">
              <span class="h-2 w-2 rounded-sm" [class]="s.swatch"></span>
              {{ s.count }} {{ s.label }}{{ s.count === 1 ? '' : 's' }}
            </a>
          }
        </div>
      }
    </section>
  `,
})
export class DashboardWorkloadsComponent {
  private readonly applications = inject(ApplicationService);

  private readonly userGroups = computed(() =>
    this.applications.applicationGroups().filter((g) => groupListOf(g) !== 'system'),
  );

  readonly total = computed(() => this.userGroups().length);
  readonly running = computed(
    () => this.userGroups().filter((g) => g.status === ApplicationStatusEnum.Running).length,
  );
  readonly failed = computed(
    () => this.userGroups().filter((g) => g.status === ApplicationStatusEnum.Failed).length,
  );

  readonly segments = computed<Segment[]>(() => {
    const groups = this.applications.applicationGroups();
    const applications = workloadEntries(groups, 'applications');
    const tools = applications.filter((e) => isTool(primaryComponentOf(e.group))).length;
    const segments: Segment[] = [
      { key: 'apps', label: 'app', count: applications.length - tools, swatch: 'bg-primary', route: '/apps/applications', query: {} },
      { key: 'data', label: 'data store', count: workloadEntries(groups, 'data').length, swatch: 'bg-violet-500', route: '/apps/data', query: {} },
      { key: 'tools', label: 'tool', count: tools, swatch: 'bg-amber-500', route: '/apps/applications', query: { type: 'tool' } },
    ];
    return segments;
  });
}
