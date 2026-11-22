import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { FlIcon } from '../../../ui/primitives/icon';
import { lucideSearch } from '@ng-icons/lucide';
import { ListFilters, ListView } from './applications-list-rows';
import { WorkloadType } from '../../model/workload-list';

export type FilterChange = {
  [K in keyof ListFilters]: { field: K; value: ListFilters[K] };
}[keyof ListFilters];

const VIEWS: { key: ListView; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'no_backup', label: 'No backup' },
];

@Component({
  selector: 'app-applications-list-toolbar',
  imports: [FormsModule, FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'fl-toolbar', role: 'toolbar', 'aria-label': 'Filters' },
  template: `
    <div class="fl-toolbar__group">
      <label class="fl-input">
        <fl-icon name="lucideSearch" [size]="14" />
        <span class="fl-sr">Search</span>
        <input
          type="search"
          [ngModel]="filters().search"
          (ngModelChange)="change('search', $event)"
          placeholder="Search by name, domain or image"
          aria-label="Search applications"
        />
      </label>
      @if (typeOptions().length > 0) {
        <div class="fl-segmented" role="group" aria-label="Type" data-testid="apps-types">
          <button
            type="button"
            [attr.aria-pressed]="filters().type === ''"
            (click)="change('type', '')"
            data-testid="apps-type-all"
          >
            All
          </button>
          @for (t of typeOptions(); track t.key) {
            <button
              type="button"
              [attr.aria-pressed]="filters().type === t.key"
              (click)="change('type', t.key)"
              [attr.data-testid]="'apps-type-' + t.key"
            >
              {{ t.label }}
            </button>
          }
        </div>
      }
      <span class="fl-select-wrap">
        <select
          class="fl-select fl-select--sm"
          [ngModel]="filters().cluster"
          (ngModelChange)="change('cluster', $event)"
          aria-label="Cluster"
        >
          <option value="">Cluster: All</option>
          @for (cluster of clusterOptions(); track cluster.id) {
            <option [value]="cluster.id">{{ cluster.name }}</option>
          }
        </select>
      </span>
      @if (projectOptions().length > 0) {
        <span class="fl-select-wrap">
          <select
            class="fl-select fl-select--sm"
            [ngModel]="filters().project"
            (ngModelChange)="change('project', $event)"
            aria-label="Project"
          >
            <option value="">Project: All</option>
            @for (project of projectOptions(); track project.id) {
              <option [value]="project.id">{{ project.name }}</option>
            }
          </select>
        </span>
      }
      <div class="fl-row" role="group" aria-label="Quick filters" data-testid="apps-views">
        @for (v of views; track v.key) {
          <button
            type="button"
            class="fl-chip"
            [attr.aria-pressed]="filters().view === v.key"
            (click)="toggleView(v.key)"
            [attr.data-testid]="'apps-view-' + v.key"
          >
            {{ v.label }}
            @if (countFor(v.key); as n) {
              <span class="fl-chip__count">({{ n }})</span>
            }
          </button>
        }
      </div>
    </div>
    <div class="fl-toolbar__group">
      <span class="fl-toolbar__info"
        >{{ resultCount() }} {{ resultCount() === 1 ? 'item' : 'items' }}</span
      >
    </div>
  `,
})
export class ApplicationsListToolbarComponent {
  readonly filters = input.required<ListFilters>();
  readonly counts = input.required<Record<ListView, number>>();
  readonly typeOptions = input<WorkloadType[]>([]);
  readonly backupKnown = input(true);
  readonly clusterOptions = input.required<{ id: string; name: string }[]>();
  readonly projectOptions = input.required<{ id: string; name: string }[]>();
  readonly resultCount = input(0);
  readonly filterChange = output<FilterChange>();

  protected readonly views = VIEWS;

  protected change<K extends keyof ListFilters>(field: K, value: ListFilters[K]): void {
    this.filterChange.emit({ field, value } as FilterChange);
  }

  protected countFor(view: ListView): number | null {
    if (view === 'no_backup' && !this.backupKnown()) return null;
    return this.counts()[view];
  }

  protected toggleView(view: ListView): void {
    this.change('view', this.filters().view === view ? 'all' : view);
  }
}
