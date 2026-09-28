import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { ListFilters, ListView } from './applications-list-rows';

export type FilterChange = { [K in keyof ListFilters]: { field: K; value: ListFilters[K] } }[keyof ListFilters];

const VIEWS: { key: ListView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'no_backup', label: 'No backup' },
];

@Component({
  selector: 'app-applications-list-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <div class="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" data-testid="apps-views">
        @for (v of views; track v.key) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="filters().view === v.key"
            (click)="change('view', v.key)"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            [class]="viewClass(v.key)"
            [attr.data-testid]="'apps-view-' + v.key"
          >
            {{ v.label }}
            @if (countFor(v.key); as n) {
              <span class="ml-1 tabular-nums">{{ n }}</span>
            }
          </button>
        }
      </div>
      <div class="relative flex-1">
        <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          [ngModel]="filters().search"
          (ngModelChange)="change('search', $event)"
          placeholder="Search by name, domain or image"
          aria-label="Search applications"
          class="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>
      <select
        [ngModel]="filters().cluster"
        (ngModelChange)="change('cluster', $event)"
        aria-label="Cluster"
        class="px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground"
      >
        <option value="">Cluster: all</option>
        @for (cluster of clusterOptions(); track cluster.id) {
          <option [value]="cluster.id">{{ cluster.name }}</option>
        }
      </select>
      @if (projectOptions().length > 0) {
        <select
          [ngModel]="filters().project"
          (ngModelChange)="change('project', $event)"
          aria-label="Project"
          class="px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground"
        >
          <option value="">Project: all</option>
          @for (project of projectOptions(); track project.id) {
            <option [value]="project.id">{{ project.name }}</option>
          }
        </select>
      }
    </div>
  `,
})
export class ApplicationsListToolbarComponent {
  readonly filters = input.required<ListFilters>();
  readonly counts = input.required<Record<ListView, number>>();
  readonly backupKnown = input(true);
  readonly clusterOptions = input.required<{ id: string; name: string }[]>();
  readonly projectOptions = input.required<{ id: string; name: string }[]>();
  readonly filterChange = output<FilterChange>();

  protected readonly views = VIEWS;

  protected change<K extends keyof ListFilters>(field: K, value: ListFilters[K]): void {
    this.filterChange.emit({ field, value } as FilterChange);
  }

  protected countFor(view: ListView): number | null {
    if (view === 'no_backup' && !this.backupKnown()) return null;
    return this.counts()[view];
  }

  protected viewClass(view: ListView): string {
    if (this.filters().view === view) return 'bg-background text-foreground shadow-sm';
    if (view === 'attention' && this.counts().attention > 0) return 'text-destructive hover:text-foreground';
    if (view === 'no_backup' && this.counts().no_backup > 0) return 'text-amber-700 dark:text-amber-400 hover:text-foreground';
    return 'text-muted-foreground hover:text-foreground';
  }
}
