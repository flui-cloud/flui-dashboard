import { Component, computed, inject, input, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { ApplicationService, RemovalPreview } from '../../service/application.service';
import { CatalogService } from '../../service/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppGroupView, Application } from '../../model/application.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-delete-dialog',
  host: { class: 'contents' },
  imports: [FormsModule, FlPanel, FlAlert, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (canDelete() && compact()) {
      <fl-panel [title]="deleteButtonText()" data-testid="danger-line">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="min-w-0 text-fl-body-sm text-fl-ink-muted">
            <ng-content />
          </p>
          <button
            flButton="secondary"
            size="sm"
            type="button"
            class="text-fl-danger"
            (click)="openDelete()"
          >
            {{ deleteButtonText() }}
          </button>
        </div>
      </fl-panel>
    } @else if (canDelete()) {
      <fl-panel [title]="deleteButtonText()">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="min-w-0 text-fl-body-sm text-fl-ink-muted">{{ deleteSubtext() }}</p>
          <button
            flButton="secondary"
            size="sm"
            type="button"
            class="text-fl-danger"
            (click)="openDelete()"
          >
            Delete
          </button>
        </div>
      </fl-panel>
    }

    @if (showModal()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="closeDelete()"
      >
        <div
          class="fl-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="app-delete-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="app-delete-title">{{ deleteHeading() }}</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              [disabled]="isDeleting()"
              (click)="closeDelete()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>

          <div class="fl-dialog__body">
            <p class="text-fl-ink-muted">This action is permanent and cannot be undone.</p>

            <div class="flex flex-col gap-2">
              <p>The following will be permanently deleted:</p>
              <ul
                class="flex max-h-48 flex-col gap-1 overflow-auto rounded-fl-md border border-fl-border px-3 py-2"
              >
                @for (c of deleteTargets(); track c.id) {
                  <li class="flex items-center justify-between gap-2">
                    <span class="truncate font-medium text-fl-ink">{{ componentRole(c) }}</span>
                    <span class="fl-mono shrink-0 truncate text-fl-caption text-fl-ink-muted">{{
                      c.slug
                    }}</span>
                  </li>
                }
              </ul>
            </div>

            <div data-testid="data-impact">
              @if (loadingPreview()) {
                <p class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted">
                  <fl-spinner label="Checking what this removes" />
                  Checking what this removes…
                </p>
              } @else {
                @let p = preview();
                @if (!p || !p.volumesKnown) {
                  <fl-alert tone="warning" title="Stored data unknown">
                    The volumes this would delete could not be read from the cluster. Assume data
                    will be lost — it is not known to be none.
                  </fl-alert>
                } @else if (p.volumes.length) {
                  <fl-alert tone="error" title="Data will be deleted">
                    <span class="flex flex-col gap-1.5">
                      <span data-testid="data-warning">{{ p.dataWarning }}</span>
                      <ul class="flex flex-col gap-0.5">
                        @for (v of p.volumes; track v.namespace + '/' + v.name) {
                          <li class="flex items-center justify-between gap-2">
                            <span class="fl-mono truncate">{{ v.name }}</span>
                            <span class="shrink-0 font-medium">{{ v.sizeLabel }}</span>
                          </li>
                        }
                      </ul>
                    </span>
                  </fl-alert>
                } @else {
                  <p class="text-fl-body-sm text-fl-ink-muted">
                    No persistent volume is attached — there is no stored data to lose.
                  </p>
                }
                @if (p?.backupNote) {
                  <p class="mt-2 text-fl-body-sm text-fl-ink-muted" data-testid="backup-note">
                    {{ p?.backupNote }}
                  </p>
                }
              }
            </div>

            <div class="fl-field">
              <label class="fl-field__label" for="app-delete-confirm">
                Type <span class="fl-mono">{{ deleteToken() }}</span> to confirm
              </label>
              <div class="fl-input fl-input--lg">
                <input
                  id="app-delete-confirm"
                  type="text"
                  [ngModel]="confirmInput()"
                  (ngModelChange)="confirmInput.set($event)"
                  [disabled]="isDeleting()"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>
            </div>

            @if (deleteError()) {
              <fl-alert tone="error" title="Deletion failed">{{ deleteError() }}</fl-alert>
            }
          </div>

          <footer class="fl-dialog__footer">
            <button
              flButton="ghost"
              type="button"
              (click)="closeDelete()"
              [disabled]="isDeleting()"
            >
              Cancel
            </button>
            <button
              flButton="danger"
              type="button"
              (click)="executeDelete()"
              [disabled]="!canConfirmDelete()"
            >
              @if (isDeleting()) {
                <fl-spinner label="Deleting" />
                Deleting…
              } @else {
                {{ deleteButtonText() }}
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class AppDeleteDialogComponent {
  private readonly appService = inject(ApplicationService);
  private readonly catalog = inject(CatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly group = input<AppGroupView | null>(null);
  readonly primary = input<Application | null>(null);
  readonly listRoute = input<string>('/apps/applications');
  /** One line with the delete button, beside what the page projects into it. */
  readonly compact = input(false);

  readonly deleted = output<void>();

  protected readonly showModal = signal(false);
  protected readonly confirmInput = signal('');
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly preview = signal<RemovalPreview | null>(null);
  protected readonly loadingPreview = signal(false);

  protected readonly isComposed = computed(() => this.group()?.type === 'composed');
  protected readonly deleteTargets = computed(() => this.group()?.components ?? []);
  protected readonly deleteToken = computed(() => this.group()?.name ?? '');

  protected readonly canDelete = computed(() => {
    const g = this.group();
    const p = this.primary();
    return !!g && !!p && !p.systemProtected && g.status !== 'deleted' && g.status !== 'deleting';
  });

  protected readonly deleteHeading = computed(() =>
    this.isComposed() ? 'Delete this bundle' : 'Delete this application',
  );
  protected readonly deleteSubtext = computed(() =>
    this.isComposed()
      ? `Permanently removes the bundle and all ${this.deleteTargets().length} component(s) and their resources.`
      : 'Permanently removes this application and all its resources.',
  );
  protected readonly deleteButtonText = computed(() =>
    this.isComposed() ? 'Delete bundle' : 'Delete application',
  );
  protected readonly canConfirmDelete = computed(() => {
    const token = this.deleteToken().trim().toLowerCase();
    return (
      !this.isDeleting() && token.length > 0 && this.confirmInput().trim().toLowerCase() === token
    );
  });

  protected componentRole(c: Application): string {
    const labels = c.labels as Record<string, string> | undefined;
    return labels?.['flui.cloud/composed-component'] ?? c.name;
  }

  protected openDelete(): void {
    this.confirmInput.set('');
    this.deleteError.set(null);
    this.preview.set(null);
    this.showModal.set(true);
    void this.loadPreview();
  }

  private async loadPreview(): Promise<void> {
    const p = this.primary();
    if (!p) return;
    this.loadingPreview.set(true);
    try {
      this.preview.set(await this.appService.getRemovalPreview(p.id));
    } catch {
      this.preview.set(null);
    } finally {
      this.loadingPreview.set(false);
    }
  }

  protected closeDelete(): void {
    if (this.isDeleting()) return;
    this.showModal.set(false);
  }

  protected async executeDelete(): Promise<void> {
    if (!this.canConfirmDelete()) return;
    const g = this.group();
    const p = this.primary();
    if (!g || !p) return;

    this.isDeleting.set(true);
    this.deleteError.set(null);
    try {
      if (g.type === 'composed' && g.catalogInstallId) {
        const result = await this.catalog.uninstall(g.catalogInstallId);
        const componentIds = result?.applicationIds?.length
          ? result.applicationIds
          : g.components.map((c) => c.id);
        this.appService.trackBundleUninstall(componentIds, result?.operationId, g.name);
        this.notifications.add({
          title: `Uninstalling ${g.name}`,
          body: 'The bundle and its components are being removed.',
          link: { label: 'View applications', route: this.listRoute() },
          type: 'info',
          source: 'system',
          category: 'app-delete',
        });
      } else {
        await this.appService.deleteApplication(p.id);
      }
      this.showModal.set(false);
      void this.appService.loadApplications();
      this.deleted.emit();
      void this.router.navigate([this.listRoute()]);
    } catch (err) {
      this.deleteError.set(this.messageFrom(err));
      this.isDeleting.set(false);
    }
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Deletion failed.';
  }
}
