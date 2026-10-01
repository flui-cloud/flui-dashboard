import { Component, computed, effect, inject, input, model, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../../../core/api/api/applications.service';
import { ApplicationResponseDto } from '../../../../core/api/model/applicationResponseDto';

export interface AppOption {
  id: string;
  name: string;
  slug: string;
  database: boolean;
}

const GONE: string[] = ['deleting', 'deleted'];
const SEARCH_FROM = 8;

/** Platform components are covered by the platform backup, so they are not offered here. */
export function appOptions(
  apps: Pick<ApplicationResponseDto, 'id' | 'name' | 'slug' | 'status' | 'kind'>[],
): AppOption[] {
  return apps
    .filter((a) => !GONE.includes(a.status) && String(a.kind).toUpperCase() !== 'SYSTEM')
    .map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      database: String(a.kind).toUpperCase() === 'DATABASE',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The chosen applications first, so a choice made by a link is in sight. */
export function chosenFirst(options: AppOption[], chosen: string[]): AppOption[] {
  const picked = new Set(chosen);
  return [...options.filter((a) => picked.has(a.id)), ...options.filter((a) => !picked.has(a.id))];
}

export function matchesApp(app: AppOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || app.name.toLowerCase().includes(q) || app.slug.toLowerCase().includes(q);
}

@Component({
  selector: 'app-policy-app-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="block">
      <span class="text-sm font-medium">{{ multiple() ? 'Applications' : 'Application' }} *</span>
      @if (!clusterId()) {
      <p class="mt-1 text-xs text-muted-foreground">Choose a cluster first.</p>
      } @else if (loading()) {
      <p class="mt-1 text-xs text-muted-foreground">Loading applications…</p>
      } @else if (failed()) {
      <p class="mt-1 text-xs text-red-600 dark:text-red-400">Could not load the applications of this cluster.</p>
      } @else if (options().length === 0) {
      <p class="mt-1 text-xs text-muted-foreground">No applications on this cluster.</p>
      } @else {
      @if (options().length > searchFrom) {
      <input
        type="search"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
        placeholder="Search by name"
        class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      }
      <ul class="mt-1 max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border" role="listbox" data-testid="app-picker">
        @for (app of shown(); track app.id) {
        <li>
          <label class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
            <input
              [type]="multiple() ? 'checkbox' : 'radio'"
              name="policy-app"
              [checked]="selected().includes(app.id)"
              (change)="toggle(app.id)"
            />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium">{{ app.name }}</span>
              @if (app.slug !== app.name) {
              <span class="block truncate text-xs text-muted-foreground">{{ app.slug }}</span>
              }
            </span>
          </label>
        </li>
        }
      </ul>
      @if (missing().length) {
      <p class="mt-1 text-xs text-amber-700 dark:text-amber-400">
        The chosen application is not on this cluster.
      </p>
      }
      }
    </div>
  `,
})
export class PolicyAppPickerComponent {
  private readonly applications = inject(ApplicationsService);

  readonly clusterId = input<string>('');
  readonly multiple = input(false);
  readonly selected = model<string[]>([]);
  readonly optionsLoaded = output<AppOption[]>();

  protected readonly searchFrom = SEARCH_FROM;
  protected readonly options = signal<AppOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly query = signal('');

  protected readonly shown = computed(() =>
    chosenFirst(this.options(), this.selected()).filter((a) => matchesApp(a, this.query())),
  );
  protected readonly missing = computed(() => {
    if (this.loading() || this.failed()) return [];
    const known = new Set(this.options().map((a) => a.id));
    return this.selected().filter((id) => !known.has(id));
  });

  constructor() {
    effect(() => {
      const clusterId = this.clusterId();
      void this.load(clusterId);
    });
  }

  protected toggle(id: string): void {
    if (!this.multiple()) {
      this.selected.set([id]);
      return;
    }
    const current = this.selected();
    this.selected.set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  private async load(clusterId: string): Promise<void> {
    this.options.set([]);
    this.failed.set(false);
    if (!clusterId) return;
    this.loading.set(true);
    try {
      const apps = await firstValueFrom(this.applications.applicationsControllerListByCluster(clusterId));
      if (clusterId !== this.clusterId()) return;
      const options = appOptions(apps ?? []);
      this.options.set(options);
      this.optionsLoaded.emit(options);
    } catch {
      if (clusterId === this.clusterId()) this.failed.set(true);
    } finally {
      if (clusterId === this.clusterId()) this.loading.set(false);
    }
  }
}
