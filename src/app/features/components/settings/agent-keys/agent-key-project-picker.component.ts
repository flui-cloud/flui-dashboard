import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideSearch, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import {
  AgentKeyProjectsService,
  SelectableProject,
} from './agent-key-projects.service';

@Component({
  selector: 'app-agent-key-project-picker',
  standalone: true,
  imports: [FormsModule, NgIcon, HlmInputDirective],
  providers: [provideIcons({ lucideLoader, lucideSearch, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
        Reading which projects there are…
      </div>
    } @else if (loadError()) {
      <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>The project list could not be read. Every project stays reachable — nothing to narrow it with.</span>
      </div>
    } @else if (projects().length === 0) {
      <p class="text-sm text-muted-foreground">
        No projects on this instance yet — there is nothing to limit this key to.
      </p>
    } @else {
      <div class="space-y-3">
        <div class="relative">
          <ng-icon
            name="lucideSearch"
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            hlmInput
            type="text"
            data-testid="project-filter"
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
            placeholder="Filter by name…"
            class="w-full pl-8 text-sm"
          />
        </div>

        <div class="flex items-center justify-between">
          @if (picked().size > 0) {
            <p class="text-xs text-muted-foreground">{{ picked().size }} selected</p>
          } @else {
            <span></span>
          }
          <span class="flex items-center gap-2 text-xs">
            <button
              type="button"
              data-testid="select-all-projects"
              (click)="selectAll()"
              class="font-medium text-primary underline underline-offset-2"
            >
              Select all
            </button>
            <button
              type="button"
              data-testid="clear-projects"
              (click)="clear()"
              class="font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          @for (project of filtered(); track project.id) {
            <label
              [attr.data-testid]="'project-' + project.id"
              class="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5 accent-primary"
                [attr.data-testid]="'project-check-' + project.id"
                [checked]="picked().has(project.id)"
                (change)="toggle(project.id)"
              />
              {{ project.name }}
            </label>
          } @empty {
            <p class="text-sm text-muted-foreground">No project matches “{{ filter() }}”.</p>
          }
        </div>
      </div>
    }
  `,
})
export class AgentKeyProjectPickerComponent implements OnInit {
  /** Preselected project ids — undefined/empty reads as "every project". */
  readonly selected = input<string[] | undefined>(undefined);

  // Never `change`: see the same collision note on the application picker —
  // a native DOM event of that name bubbles from the checkboxes below.
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
    // Signal inputs resolve their bound value by ngOnInit, not in the
    // constructor — reading `selected()` there sees only its default.
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
