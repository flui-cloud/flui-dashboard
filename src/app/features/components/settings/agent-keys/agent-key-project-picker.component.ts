import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlSearchInput } from '../../../../ui/patterns/filter-bar';
import { FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { AgentKeyProjectsService, SelectableProject } from './agent-key-projects.service';

@Component({
  selector: 'app-agent-key-project-picker',
  imports: [FlAlert, FlSearchInput, FlLoadingState, FlButton],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <fl-loading-state [rows]="2" />
    } @else if (loadError()) {
      <fl-alert tone="error" title="Projects not read">
        The project list could not be read. Every project stays reachable, with nothing to narrow it
        with.
      </fl-alert>
    } @else if (projects().length === 0) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        No projects on this instance yet, so there is nothing to limit this key to.
      </p>
    } @else {
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <fl-search-input
            data-testid="project-filter"
            label="Filter projects"
            placeholder="Filter by name"
            [value]="filter()"
            (valueChange)="filter.set($event)"
          />
          @if (picked().size > 0) {
            <span class="text-fl-caption text-fl-ink-muted">{{ picked().size }} selected</span>
          }
          <span class="ml-auto flex items-center gap-1">
            <button
              flButton="ghost"
              size="sm"
              type="button"
              data-testid="select-all-projects"
              (click)="selectAll()"
            >
              Select all
            </button>
            <button
              flButton="ghost"
              size="sm"
              type="button"
              data-testid="clear-projects"
              (click)="clear()"
            >
              Clear
            </button>
          </span>
        </div>

        <div class="flex flex-wrap gap-x-5 gap-y-2">
          @for (project of filtered(); track project.id) {
            <label class="fl-check" [attr.data-testid]="'project-' + project.id">
              <input
                type="checkbox"
                [attr.data-testid]="'project-check-' + project.id"
                [checked]="picked().has(project.id)"
                (change)="toggle(project.id)"
              />
              {{ project.name }}
            </label>
          } @empty {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              No project matches “{{ filter() }}”.
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class AgentKeyProjectPickerComponent implements OnInit {
  /** Preselected project ids — undefined/empty reads as "every project". */
  readonly selected = input<string[] | undefined>(undefined);

  readonly selectionChange = output<string[]>();

  private readonly service = inject(AgentKeyProjectsService);

  protected readonly projects = signal<SelectableProject[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly filter = signal('');

  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.projects();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  });

  ngOnInit(): void {
    this.picked.set(new Set(this.selected() ?? []));
    this.service.list().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (!next.delete(id)) next.add(id);
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  protected selectAll(): void {
    const next = new Set(this.projects().map((p) => p.id));
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  protected clear(): void {
    this.picked.set(new Set());
    this.selectionChange.emit([]);
  }

  reset(ids: string[] = []): void {
    this.picked.set(new Set(ids));
  }
}
