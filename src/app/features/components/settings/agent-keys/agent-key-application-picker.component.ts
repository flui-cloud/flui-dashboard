import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlSearchInput } from '../../../../ui/patterns/filter-bar';
import { FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { FlTag } from '../../../../ui/primitives/tag';
import {
  AgentKeyApplicationsService,
  SelectableApplication,
} from './agent-key-applications.service';

interface AppSection {
  category: 'user' | 'system';
  label: string;
  clusters: { name: string; apps: SelectableApplication[] }[];
}

@Component({
  selector: 'app-agent-key-application-picker',
  imports: [FlAlert, FlSearchInput, FlLoadingState, FlButton, FlTag],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <fl-loading-state [rows]="2" />
    } @else if (loadError()) {
      <fl-alert tone="error" title="Applications not read">
        The application list could not be read. Every application stays reachable, with nothing to
        narrow it with.
      </fl-alert>
    } @else if (apps().length === 0) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        No applications on this instance yet, so there is nothing to limit this key to.
      </p>
    } @else {
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <fl-search-input
            data-testid="app-filter"
            label="Filter applications"
            placeholder="Filter by name"
            [value]="filter()"
            (valueChange)="filter.set($event)"
          />
          @if (picked().size > 0) {
            <span class="text-fl-caption text-fl-ink-muted">{{ picked().size }} selected</span>
          }
        </div>

        @for (section of sections(); track section.category) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="m-0 text-fl-body-sm font-semibold">{{ section.label }}</h4>
              @if (section.category === 'system') {
                <fl-tag>Platform-run</fl-tag>
              }
              <span class="ml-auto flex items-center gap-1">
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [attr.data-testid]="'select-all-' + section.category"
                  (click)="selectAll(section)"
                >
                  Select all
                </button>
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [attr.data-testid]="'clear-' + section.category"
                  (click)="clearSection(section)"
                >
                  Clear
                </button>
              </span>
            </div>
            @for (cluster of section.clusters; track cluster.name) {
              <div class="flex flex-col gap-1.5">
                @if (section.clusters.length > 1) {
                  <p class="m-0 text-fl-caption text-fl-ink-muted">{{ cluster.name }}</p>
                }
                <div class="flex flex-wrap gap-x-5 gap-y-2">
                  @for (app of cluster.apps; track app.id) {
                    <label class="fl-check" [attr.data-testid]="'app-' + app.id">
                      <input
                        type="checkbox"
                        [attr.data-testid]="'app-check-' + app.id"
                        [checked]="picked().has(app.id)"
                        (change)="toggle(app.id)"
                      />
                      {{ app.name }}
                    </label>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            No application matches “{{ filter() }}”.
          </p>
        }
      </div>
    }
  `,
})
export class AgentKeyApplicationPickerComponent implements OnInit {
  /** Preselected application ids — undefined/empty reads as "every application". */
  readonly selected = input<string[] | undefined>(undefined);

  /**
   * Offer a starting point instead of an empty picker — but only when nothing
   * was handed in to begin with. Set by the mint form alone: editing an
   * existing key always shows exactly what that key already has, even when
   * that happens to be "nothing" (an unrestricted key mid-edit is not a blank
   * slate to guess a default for).
   */
  readonly suggestDefault = input(false);

  readonly selectionChange = output<string[]>();

  private readonly service = inject(AgentKeyApplicationsService);

  protected readonly apps = signal<SelectableApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly filter = signal('');

  private readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.apps();
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  });

  protected readonly sections = computed<AppSection[]>(() => {
    const grouped = this.filtered();
    const bySections: AppSection[] = [
      { category: 'user', label: 'Your applications', clusters: [] },
      { category: 'system', label: 'System applications', clusters: [] },
    ];
    for (const section of bySections) {
      const inCategory = grouped.filter((a) => a.category === section.category);
      const order: string[] = [];
      const byCluster = new Map<string, SelectableApplication[]>();
      for (const app of inCategory) {
        if (!byCluster.has(app.clusterName)) {
          byCluster.set(app.clusterName, []);
          order.push(app.clusterName);
        }
        byCluster.get(app.clusterName)!.push(app);
      }
      section.clusters = order.map((name) => ({ name, apps: byCluster.get(name)! }));
    }
    return bySections.filter((s) => s.clusters.length > 0);
  });

  ngOnInit(): void {
    this.picked.set(new Set(this.selected() ?? []));
    this.service.list().subscribe({
      next: (apps) => {
        this.apps.set(apps);
        this.loading.set(false);
        this.applyDefaultIfOffered(apps);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private applyDefaultIfOffered(apps: SelectableApplication[]): void {
    if (!this.suggestDefault() || this.selected()?.length) return;
    const userApps = apps.filter((a) => a.category === 'user');
    if (userApps.length !== 1) return;
    this.picked.set(new Set([userApps[0].id]));
    this.selectionChange.emit([userApps[0].id]);
  }

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (!next.delete(id)) next.add(id);
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  protected selectAll(section: AppSection): void {
    const next = new Set(this.picked());
    for (const cluster of section.clusters) {
      for (const app of cluster.apps) next.add(app.id);
    }
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  protected clearSection(section: AppSection): void {
    const inSection = new Set(section.clusters.flatMap((c) => c.apps.map((a) => a.id)));
    const next = new Set([...this.picked()].filter((id) => !inSection.has(id)));
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  reset(ids: string[] = []): void {
    this.picked.set(new Set(ids));
  }
}
