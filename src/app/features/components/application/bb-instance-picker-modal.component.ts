import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnChanges,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideDatabase,
  lucideLoader,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { CatalogReusableInstanceDto } from '../../../core/api/model/catalogReusableInstanceDto';
import { CatalogService } from '../../service/catalog.service';

@Component({
  selector: 'app-bb-instance-picker-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideDatabase,
      lucideLoader,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-foreground">
              {{ title() }}
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              @if (bbSlugs().length > 1) {
                Pick a target install — this client connects to {{ slugList() }}. Credentials
                are wired automatically.
              } @else {
                Pick the {{ bbLabel() }} install to connect to. Credentials are wired
                automatically — no passwords required.
              }
            </p>
          </div>
          <button
            type="button"
            (click)="cancelled.emit()"
            class="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Close"
          >
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>

        <div class="mt-5 space-y-3">
          @if (bbSlugs().length > 1 && !loading() && allInstances().length > 0) {
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" (click)="setSlugFilter(null)" [class]="slugChipClass(slugFilter() === null)">
                All
              </button>
              @for (s of bbSlugs(); track s) {
                <button type="button" (click)="setSlugFilter(s)" [class]="slugChipClass(slugFilter() === s)">
                  {{ s }}
                </button>
              }
            </div>
          }
          @if (loading()) {
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              Loading running {{ bbLabel() }} instances…
            </div>
          } @else if (error()) {
            <div class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
              <div>{{ error() }}</div>
            </div>
          } @else if (instances().length === 0) {
            <div class="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
              <ng-icon
                name="lucideTriangleAlert"
                class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div class="text-sm">
                <p class="font-medium text-amber-800 dark:text-amber-200">
                  No running {{ bbLabel() }} found on this cluster
                </p>
                <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  @if (bbSlugs().length > 1) {
                    Install one of {{ slugList() }} first, then come back here to connect.
                  } @else {
                    Install a {{ bbLabel() }} first, then come back here to connect.
                  }
                </p>
              </div>
            </div>
          } @else {
            <ul class="space-y-2">
              @for (instance of instances(); track instance.catalogInstallId || instance.applicationId) {
                <li>
                  <button
                    type="button"
                    (click)="select(instance)"
                    [disabled]="!canPick(instance)"
                    [class]="cardClass(isSelected(instance), !canPick(instance))"
                  >
                    <div class="flex items-start gap-3">
                      <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary mt-0.5" />
                      <div class="min-w-0 flex-1 text-left">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-semibold text-foreground">
                            {{ instance.displayName }}
                          </span>
                          <span [class]="statusBadgeClass(instance.status)">
                            {{ instance.status }}
                          </span>
                          @if (bbSlugs().length > 1 && instance.catalogSlug) {
                            <span class="rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                              {{ instance.catalogSlug }}
                            </span>
                          }
                          @if (instance.catalogInstallId && instance.catalogInstallId === currentConnectedInstallId()) {
                            <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Current
                            </span>
                          }
                        </div>
                        <div class="mt-0.5 text-xs text-muted-foreground">
                          {{ instance.applicationName }}
                        </div>
                        @if (!instance.catalogInstallId) {
                          <div class="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                            Not installed via catalog — can't be linked.
                          </div>
                        }
                      </div>
                      @if (isSelected(instance)) {
                        <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-primary" />
                      }
                    </div>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            (click)="cancelled.emit()"
            class="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="confirmPick()"
            [disabled]="!selectedId() || submitting()"
            class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            }
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class BbInstancePickerModalComponent implements OnChanges {
  private readonly catalog = inject(CatalogService);

  readonly bbSlugs = input.required<string[]>();
  readonly clusterId = input.required<string>();
  readonly currentConnectedInstallId = input<string | null>(null);
  readonly initialSlugFilter = input<string | null>(null);
  readonly title = input<string>('Pick target database');
  readonly confirmLabel = input<string>('Connect');
  readonly submitting = input<boolean>(false);

  @Output() readonly picked = new EventEmitter<string>();
  @Output() readonly cancelled = new EventEmitter<void>();

  protected readonly allInstances = signal<CatalogReusableInstanceDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly slugFilter = signal<string | null>(null);

  protected readonly bbLabel = computed(() =>
    this.bbSlugs().length === 1 ? this.bbSlugs()[0] : 'building block',
  );
  protected readonly slugList = computed(() => this.bbSlugs().join(' · '));

  protected readonly instances = computed(() => {
    const filter = this.slugFilter();
    const all = this.allInstances();
    return filter ? all.filter((i) => i.catalogSlug === filter) : all;
  });

  ngOnChanges(): void {
    this.slugFilter.set(this.initialSlugFilter());
    this.load();
  }

  private async load(): Promise<void> {
    const slugs = this.bbSlugs();
    const clusterId = this.clusterId();
    if (slugs.length === 0 || !clusterId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const lists = await Promise.all(
        slugs.map((s) => this.catalog.getReusableInstances(s, clusterId)),
      );
      const seen = new Set<string>();
      const merged = lists.flat().filter((i) => {
        const id = i.catalogInstallId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      this.allInstances.set(merged);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.error.set(e?.error?.message || e?.message || 'Failed to load instances.');
    } finally {
      this.loading.set(false);
    }
  }

  protected setSlugFilter(slug: string | null): void {
    this.slugFilter.set(slug);
  }

  protected slugChipClass(active: boolean): string {
    const base = 'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition';
    return active
      ? `${base} border-primary bg-primary text-primary-foreground`
      : `${base} border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground`;
  }

  protected canPick(instance: CatalogReusableInstanceDto): boolean {
    if (!instance.catalogInstallId) return false;
    // Allow re-picking the current one (Change DB with same target = no-op) but
    // visually nothing will happen — the confirm button stays enabled only when
    // the selection differs from current.
    return true;
  }

  protected isSelected(instance: CatalogReusableInstanceDto): boolean {
    return !!instance.catalogInstallId && this.selectedId() === instance.catalogInstallId;
  }

  protected select(instance: CatalogReusableInstanceDto): void {
    if (!instance.catalogInstallId) return;
    this.selectedId.set(instance.catalogInstallId);
  }

  protected confirmPick(): void {
    const id = this.selectedId();
    if (id) this.picked.emit(id);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelled.emit();
  }

  protected cardClass(selected: boolean, disabled: boolean): string {
    const base = 'flex w-full items-start rounded-lg border p-4 text-left transition';
    if (disabled) return `${base} border-border bg-muted/20 opacity-60 cursor-not-allowed`;
    return selected
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }

  protected statusBadgeClass(status: CatalogReusableInstanceDto.StatusEnum): string {
    const base =
      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize';
    switch (status) {
      case CatalogReusableInstanceDto.StatusEnum.Running:
        return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
      case CatalogReusableInstanceDto.StatusEnum.Degraded:
        return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`;
      case CatalogReusableInstanceDto.StatusEnum.Failed:
        return `${base} bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400`;
      default:
        return `${base} bg-muted text-muted-foreground`;
    }
  }
}
