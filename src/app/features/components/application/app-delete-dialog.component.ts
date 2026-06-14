import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideTrash2, lucideTriangleAlert } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { CatalogService } from '../../service/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppGroupView, Application } from '../../model/application.models';

@Component({
  selector: 'app-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [NgIcon, FormsModule],
  providers: [
    provideIcons({ lucideLoader, lucideTrash2, lucideTriangleAlert }),
  ],
  template: `
    @if (canDelete()) {
      <section class="rounded-2xl border border-red-200 dark:border-red-900/40 bg-card p-6">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-500">
          Danger zone
        </h2>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground">{{ deleteHeading() }}</p>
            <p class="text-xs text-muted-foreground">{{ deleteSubtext() }}</p>
          </div>
          <button
            type="button"
            (click)="openDelete()"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-sm
                   font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <ng-icon name="lucideTrash2" class="h-4 w-4" />
            Delete
          </button>
        </div>
      </section>
    }

    @if (showModal()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="closeDelete()"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-destructive" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold text-foreground">{{ deleteHeading() }}</h3>
              <p class="mt-0.5 text-sm text-muted-foreground">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <p class="text-sm text-foreground">The following will be permanently deleted:</p>
            <div class="max-h-48 space-y-1 overflow-auto rounded-md border border-border bg-muted/40 p-2">
              @for (c of deleteTargets(); track c.id) {
                <div class="flex items-center justify-between gap-2 px-1 text-sm">
                  <span class="truncate font-medium text-foreground">{{ componentRole(c) }}</span>
                  <span class="shrink-0 truncate font-mono text-xs text-muted-foreground">{{ c.slug }}</span>
                </div>
              }
            </div>
          </div>

          <div class="mt-4 space-y-1.5">
            <label class="block text-xs text-muted-foreground">
              Type
              <span class="font-mono font-semibold text-foreground">{{ deleteToken() }}</span>
              to confirm
            </label>
            <input
              type="text"
              [ngModel]="confirmInput()"
              (ngModelChange)="confirmInput.set($event)"
              [disabled]="isDeleting()"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground
                     focus:border-transparent focus:outline-none focus:ring-2 focus:ring-destructive/50"
            />
          </div>

          @if (deleteError()) {
            <p class="mt-2 text-xs text-destructive">{{ deleteError() }}</p>
          }

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              (click)="closeDelete()"
              [disabled]="isDeleting()"
              class="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="executeDelete()"
              [disabled]="!canConfirmDelete()"
              class="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium
                     text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              @if (isDeleting()) {
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                Deleting…
              } @else {
                {{ deleteButtonText() }}
              }
            </button>
          </div>
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

  @Output() readonly deleted = new EventEmitter<void>();

  protected readonly showModal = signal(false);
  protected readonly confirmInput = signal('');
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly isComposed = computed(() => this.group()?.type === 'composed');
  protected readonly deleteTargets = computed(() => this.group()?.components ?? []);
  protected readonly deleteToken = computed(() => this.group()?.name ?? '');

  protected readonly canDelete = computed(() => {
    const g = this.group();
    const p = this.primary();
    return (
      !!g &&
      !!p &&
      !p.systemProtected &&
      g.status !== 'deleted' &&
      g.status !== 'deleting'
    );
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
      !this.isDeleting() &&
      token.length > 0 &&
      this.confirmInput().trim().toLowerCase() === token
    );
  });

  protected componentRole(c: Application): string {
    const labels = c.labels as Record<string, string> | undefined;
    return labels?.['flui.cloud/composed-component'] ?? c.name;
  }

  protected openDelete(): void {
    this.confirmInput.set('');
    this.deleteError.set(null);
    this.showModal.set(true);
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
