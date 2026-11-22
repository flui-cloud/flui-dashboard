import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../../../core/api/api/applications.service';
import { ApplicationResponseDto } from '../../../../core/api/model/applicationResponseDto';
import { FlAlert } from '../../../../ui/patterns/alert';

export interface AppOption {
  id: string;
  name: string;
  slug: string;
  database: boolean;
}

const GONE = new Set<string>(['deleting', 'deleted']);
const SEARCH_FROM = 8;

/** Platform components are covered by the platform backup, so they are not offered here. */
export function appOptions(
  apps: Pick<ApplicationResponseDto, 'id' | 'name' | 'slug' | 'status' | 'kind'>[],
): AppOption[] {
  return apps
    .filter((a) => !GONE.has(a.status) && String(a.kind).toUpperCase() !== 'SYSTEM')
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
  imports: [FlAlert],
  host: { class: 'fl-field' },
  template: `
    <span class="fl-field__label">{{ multiple() ? 'Applications' : 'Application' }}</span>
    @if (!clusterId()) {
      <span class="fl-field__hint">Choose a cluster first.</span>
    } @else if (loading()) {
      <span class="fl-field__hint">Loading applications…</span>
    } @else if (failed()) {
      <fl-alert tone="error" title="Could not load the applications of this cluster" />
    } @else if (options().length === 0) {
      <span class="fl-field__hint">No applications on this cluster.</span>
    } @else {
      @if (options().length > searchFrom) {
        <div class="fl-input">
          <input
            type="search"
            aria-label="Search applications"
            placeholder="Search by name"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </div>
      }
      <ul
        class="m-0 flex max-h-64 list-none flex-col overflow-y-auto rounded-fl-md border border-fl-border p-0"
        role="listbox"
        data-testid="app-picker"
      >
        @for (app of shown(); track app.id) {
          <li class="border-b border-fl-border-subtle px-3 py-2 last:border-b-0">
            <label class="fl-check w-full">
              <input
                [type]="multiple() ? 'checkbox' : 'radio'"
                name="policy-app"
                [checked]="selected().includes(app.id)"
                (change)="toggle(app.id)"
              />
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{ app.name }}</span>
                @if (app.slug !== app.name) {
                  <span class="fl-mono truncate text-fl-ink-muted">{{ app.slug }}</span>
                }
              </span>
            </label>
          </li>
        }
      </ul>
      @if (missing().length) {
        <fl-alert tone="warning" title="The chosen application is not on this cluster" />
      }
    }
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
      const apps = await firstValueFrom(
        this.applications.applicationsControllerListByCluster(clusterId),
      );
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
