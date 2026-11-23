import { Component, OnChanges, computed, inject, input, signal, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { CatalogReusableInstanceDto } from '../../../core/api/model/catalogReusableInstanceDto';
import { CatalogService } from '../../service/catalog.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

const STATUS_TONES: Partial<Record<CatalogReusableInstanceDto.StatusEnum, StatusTone>> = {
  running: 'success',
  degraded: 'warning',
  failed: 'error',
  pending: 'progress',
  awaiting_build: 'progress',
  provisioning: 'progress',
  waiting_for_room: 'progress',
  updating: 'progress',
  rolling_back: 'progress',
  deleting: 'progress',
};

@Component({
  selector: 'app-bb-instance-picker-modal',
  imports: [FlDialogFocus, FlAlert, FlLoadingState, FlTable, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bb-picker-title"
        flDialogFocus
        (dismissed)="cancelled.emit()"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="bb-picker-title">{{ title() }}</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p class="text-fl-ink-secondary">
            @if (bbSlugs().length > 1) {
              Pick the install this client connects to ({{ slugList() }}). Credentials are wired
              automatically.
            } @else {
              Pick the {{ bbLabel() }} install to connect to. Credentials are wired automatically,
              no password needed.
            }
          </p>
          @if (bbSlugs().length > 1 && !loading() && allInstances().length > 0) {
            <div class="fl-segmented self-start" role="group" aria-label="Filter by type">
              <button
                type="button"
                [attr.aria-pressed]="slugFilter() === null"
                (click)="setSlugFilter(null)"
              >
                All
              </button>
              @for (s of bbSlugs(); track s) {
                <button
                  type="button"
                  [attr.aria-pressed]="slugFilter() === s"
                  (click)="setSlugFilter(s)"
                >
                  {{ s }}
                </button>
              }
            </div>
          }
          @if (loading()) {
            <fl-loading-state />
          } @else if (error()) {
            <fl-alert tone="error" title="Could not load instances">{{ error() }}</fl-alert>
          } @else if (instances().length === 0) {
            <fl-alert tone="warning" [title]="'No running ' + bbLabel() + ' on this cluster'">
              @if (bbSlugs().length > 1) {
                Install one of {{ slugList() }} first, then come back to connect.
              } @else {
                Install a {{ bbLabel() }} first, then come back to connect.
              }
            </fl-alert>
          } @else {
            <div class="fl-table-wrap rounded-fl-md border border-fl-border">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col" class="is-fit"><span class="fl-sr">Select</span></th>
                    <th scope="col">Install</th>
                    <th scope="col">Application</th>
                    @if (bbSlugs().length > 1) {
                      <th scope="col">Type</th>
                    }
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    instance of instances();
                    track instance.catalogInstallId || instance.applicationId
                  ) {
                    <tr
                      [class.is-selected]="isSelected(instance)"
                      [class.cursor-pointer]="canPick(instance)"
                      (click)="select(instance)"
                    >
                      <td class="is-fit">
                        <input
                          type="radio"
                          name="bb-instance"
                          [attr.aria-label]="'Select ' + instance.displayName"
                          [checked]="isSelected(instance)"
                          [disabled]="!canPick(instance)"
                          (click)="$event.stopPropagation(); select(instance)"
                        />
                      </td>
                      <td class="whitespace-normal">
                        <span class="font-medium">{{ instance.displayName }}</span>
                        @if (
                          instance.catalogInstallId &&
                          instance.catalogInstallId === currentConnectedInstallId()
                        ) {
                          <span class="text-fl-ink-muted"> (current)</span>
                        }
                        @if (!instance.catalogInstallId) {
                          <span class="block text-fl-caption text-fl-ink-muted">
                            Not installed from the catalog, cannot be linked
                          </span>
                        }
                      </td>
                      <td class="fl-mono">{{ instance.applicationName }}</td>
                      @if (bbSlugs().length > 1) {
                        <td class="fl-mono">{{ instance.catalogSlug ?? '' }}</td>
                      }
                      <td>
                        <fl-status
                          [tone]="statusTone(instance.status)"
                          [label]="statusLabel(instance.status)"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            [disabled]="!selectedId() || submitting()"
            (click)="confirmPick()"
          >
            @if (submitting()) {
              <fl-spinner [label]="confirmLabel()" />
            }
            {{ confirmLabel() }}
          </button>
        </footer>
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

  readonly picked = output<string>();
  readonly cancelled = output<void>();

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

  protected canPick(instance: CatalogReusableInstanceDto): boolean {
    return !!instance.catalogInstallId;
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

  protected statusTone(status: CatalogReusableInstanceDto.StatusEnum): StatusTone {
    return STATUS_TONES[status] ?? 'neutral';
  }

  protected statusLabel(status: CatalogReusableInstanceDto.StatusEnum): string {
    const text = status.replaceAll('_', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
