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
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
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
  standalone: true,
  imports: [FormsModule, NgIcon, HlmBadgeDirective, HlmInputDirective],
  providers: [provideIcons({ lucideLoader, lucideSearch, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
        Reading which applications there are…
      </div>
    } @else if (loadError()) {
      <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>The application list could not be read. Every application stays reachable — nothing to narrow it with.</span>
      </div>
    } @else if (apps().length === 0) {
      <p class="text-sm text-muted-foreground">
        No applications on this instance yet — there is nothing to limit this key to.
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
            data-testid="app-filter"
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
            placeholder="Filter by name…"
            class="w-full pl-8 text-sm"
          />
        </div>

        @if (picked().size > 0) {
          <p class="text-xs text-muted-foreground">{{ picked().size }} selected</p>
        }

        @for (section of sections(); track section.category) {
          <div
            class="space-y-2 rounded-md p-2.5"
            [class]="section.category === 'system' ? 'bg-muted/30' : ''"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ section.label }}
              </p>
              @if (section.category === 'system') {
                <span hlmBadge variant="secondary" class="text-[10px]">Platform-run</span>
              }
              <span class="ml-auto flex items-center gap-2 text-xs">
                <button
                  type="button"
                  [attr.data-testid]="'select-all-' + section.category"
                  (click)="selectAll(section)"
                  class="font-medium text-primary underline underline-offset-2"
                >
                  Select all
                </button>
                <button
                  type="button"
                  [attr.data-testid]="'clear-' + section.category"
                  (click)="clearSection(section)"
                  class="font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Clear
                </button>
              </span>
            </div>
            @for (cluster of section.clusters; track cluster.name) {
              <div class="space-y-1.5">
                @if (section.clusters.length > 1) {
                  <p class="text-[11px] font-medium text-muted-foreground/70">{{ cluster.name }}</p>
                }
                <div class="flex flex-wrap gap-2">
                  @for (app of cluster.apps; track app.id) {
                    <label
                      [attr.data-testid]="'app-' + app.id"
                      class="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors"
                      [class]="section.category === 'system'
                        ? 'border-border/70 bg-background/60 hover:border-primary/40'
                        : 'border-border hover:border-primary/40 hover:bg-accent/40'"
                    >
                      <input
                        type="checkbox"
                        class="h-3.5 w-3.5 accent-primary"
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
          <p class="text-sm text-muted-foreground">No application matches “{{ filter() }}”.</p>
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

  // Never `change`: a native DOM event of that name bubbling from the
  // checkboxes below would collide with a same-named custom output.
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

  /**
   * User applications first, system ones marked apart — a key is almost
   * always meant to reach what its owner built, not the platform components
   * running underneath it. Splitting by category says that at a glance
   * instead of leaving Grafana and Loki indistinguishable from an app a
   * person deployed themselves.
   */
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
    // Signal inputs resolve their bound value by ngOnInit, not in the
    // constructor — reading `selected()` there sees only its default.
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

  /**
   * The one default that needs no guessing: a single application on the
   * whole instance is unambiguously the one a fresh key is "for". With more
   * than one, silence is the honest answer — nothing here says which of them
   * this agent is meant to touch, and picking one anyway would be a guess
   * wearing a default's clothes.
   */
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
    const inSection = new Set(
      section.clusters.flatMap((c) => c.apps.map((a) => a.id)),
    );
    const next = new Set([...this.picked()].filter((id) => !inSection.has(id)));
    this.picked.set(next);
    this.selectionChange.emit([...next]);
  }

  reset(ids: string[] = []): void {
    this.picked.set(new Set(ids));
  }
}
