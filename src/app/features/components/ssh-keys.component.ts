import {
  Component,
  OnDestroy,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideTrash2 } from '@ng-icons/lucide';
import { forkJoin, map } from 'rxjs';
import {
  SSHKeyDto,
  CreateSSHKeyDto,
  UpdateSSHKeyDto,
  AccessManagementService,
} from '../../core/api';
import { ProvidersService } from '../service/providers.service';
import { ReadOnlySectionDirective } from '../../shared/directives/read-only-section.directive';
import { sandboxFailureMessage } from '../../core/services/sandbox.service';
import { CurrentSurfaceService } from '../../core/services/current-surface.service';
import { FlPageHeader } from '../../ui/patterns/page-header';
import { FlPanel } from '../../ui/patterns/panel';
import { FlAlert } from '../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../ui/patterns/states';
import { FlButton } from '../../ui/primitives/button';
import { FlIcon } from '../../ui/primitives/icon';
import {
  SshKeysSurfaceInput,
  SshKeysSurfaceRevision,
  buildSshKeysSurface,
  presentedContent,
} from './ssh-keys-surface';
import {
  ProviderRef,
  ProviderSlug,
  bulkDeleteMessage,
  bulkDeleteTarget,
  dedupeByFingerprint,
  deleteTarget,
  downloadPublicKey,
  keysSummary,
  providerRefs,
  providerSyncOf,
  runInSequence,
  sortByCreated,
  syncToken,
  toggled,
  withToken,
  withoutToken,
} from './ssh-keys/ssh-keys-rows';
import { KeyAction, SshKeysTable } from './ssh-keys/ssh-keys-table';
import { NewKeyRequest, SshKeyAddDialog } from './ssh-keys/ssh-key-add-dialog';
import { SshKeyDeleteDialog } from './ssh-keys/ssh-key-delete-dialog';
import { SshKeysBulkDeleteDialog } from './ssh-keys/ssh-keys-bulk-delete-dialog';

@Component({
  selector: 'app-ssh-keys',
  imports: [
    ReadOnlySectionDirective,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    SshKeysTable,
    SshKeyAddDialog,
    SshKeyDeleteDialog,
    SshKeysBulkDeleteDialog,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw, lucideTrash2 })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'SSH keys (' + sshKeys().length + ')'">
        <span headerMeta>{{ summary() }}</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="isLoading()"
            (click)="loadSshKeys()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <button flButton="primary" type="button" appReadOnlySection (click)="openAddModal()">
            <fl-icon name="lucidePlus" />
            Add SSH key
          </button>
        </ng-container>
      </fl-page-header>

      @if (error()) {
        <fl-alert tone="error" title="Something went wrong">{{ error() }}</fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Selection">
          <div class="fl-toolbar__group">
            @if (selectedKeys().size > 0) {
              <span class="fl-toolbar__info">{{ selectedKeys().size }} selected</span>
              <button flButton="ghost" size="sm" type="button" (click)="clearSelection()">
                Deselect all
              </button>
              <button flButton="danger" size="sm" type="button" (click)="openBulkDeleteModal()">
                <fl-icon name="lucideTrash2" [size]="14" />
                Delete selected
              </button>
            } @else {
              <span class="fl-toolbar__info">Select keys to delete several at once</span>
            }
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ sshKeys().length }} {{ sshKeys().length === 1 ? 'key' : 'keys' }}</span
            >
          </div>
        </div>

        @if (isLoading() && sshKeys().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (sshKeys().length === 0) {
          @if (!error()) {
            <fl-empty-state
              title="No SSH keys yet"
              body="Add a key to reach your servers over SSH."
            >
              <button
                flButton="primary"
                size="sm"
                type="button"
                appReadOnlySection
                (click)="openAddModal()"
              >
                Add SSH key
              </button>
            </fl-empty-state>
          }
        } @else {
          <app-ssh-keys-table
            [keys]="sortedSshKeys()"
            [providers]="providers()"
            [selected]="selectedKeys()"
            [syncing]="syncingSet()"
            [unsyncing]="unsyncingSet()"
            [dateSort]="dateSort()"
            (toggleKey)="toggleKeySelection($event)"
            (toggleAll)="toggleSelectAll()"
            (toggleSort)="toggleDateSort()"
            (action)="onKeyAction($event)"
          />
        }
      </fl-panel>
    </div>

    @if (showBulkDeleteModal()) {
      <app-ssh-keys-bulk-delete-dialog
        [count]="bulkDeleteCount()"
        [scope]="bulkDeleteScope()"
        [providers]="providers()"
        [deleting]="isBulkDeleting()"
        [progress]="bulkDeleteProgress()"
        [error]="bulkDeleteError()"
        [success]="bulkDeleteSuccess()"
        [successMessage]="bulkDeleteSuccessMessage()"
        (scopeChange)="bulkDeleteScope.set($event)"
        (confirmed)="confirmBulkDelete()"
        (cancelled)="closeBulkDeleteModal()"
      />
    }

    @if (keyToDelete(); as key) {
      <app-ssh-key-delete-dialog
        [key]="key"
        [scope]="deleteScope()"
        [syncedProviders]="deleteSyncedProviders()"
        [deleting]="isDeleting()"
        [error]="deleteError()"
        [success]="deleteSuccess()"
        (scopeChange)="deleteScope.set($event)"
        (confirmed)="confirmDelete()"
        (cancelled)="cancelDelete()"
      />
    }

    @if (showAddModal()) {
      <app-ssh-key-add-dialog
        [providers]="providers()"
        [saving]="isLoading()"
        [error]="addError()"
        (submitted)="onSubmitNewKey($event)"
        (cancelled)="showAddModal.set(false)"
      />
    }
  `,
})
export class SshKeysComponent implements OnDestroy {
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new SshKeysSurfaceRevision();
  protected readonly accessManagementService = inject(AccessManagementService);
  private readonly providersService = inject(ProvidersService);

  readonly showAddModal = signal(false);
  readonly keyToDelete = signal<SSHKeyDto | null>(null);
  readonly deleteScope = signal<string>('all');
  readonly deleteSyncedProviders = signal<ProviderRef[]>([]);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteSuccess = signal(false);

  readonly selectedKeys = signal<Set<string>>(new Set());
  readonly showBulkDeleteModal = signal(false);
  readonly bulkDeleteCount = signal(0);
  readonly bulkDeleteScope = signal<string>('all');
  readonly isBulkDeleting = signal(false);
  readonly bulkDeleteProgress = signal(0);
  readonly bulkDeleteError = signal<string | null>(null);
  readonly bulkDeleteSuccess = signal(false);
  readonly bulkDeleteSuccessMessage = signal('');

  readonly sshKeys = signal<SSHKeyDto[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly addError = signal<string | null>(null);
  readonly dateSort = signal<'desc' | 'asc'>('desc');
  readonly syncingSet = signal<Set<string>>(new Set());
  readonly unsyncingSet = signal<Set<string>>(new Set());

  readonly sortedSshKeys = computed(() => sortByCreated(this.sshKeys(), this.dateSort()));
  readonly providers = computed(() =>
    providerRefs(
      this.providersService.activeProviders(),
      this.providersService.availableProviders(),
    ),
  );
  readonly summary = computed(() => keysSummary(this.sshKeys()));
  readonly isAllSelected = computed(
    () =>
      this.sortedSshKeys().length > 0 &&
      this.sortedSshKeys().every((k) => this.selectedKeys().has(k.id)),
  );

  readonly surface = computed(() => {
    const input: SshKeysSurfaceInput = {
      keys: this.sortedSshKeys(),
      isLoading: this.isLoading(),
      selectedKeyIds: this.selectedKeys(),
      dateSort: this.dateSort(),
    };
    return buildSshKeysSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
    this.providersService.loadProviders();
    this.providersService.loadConfigurations$().subscribe(() => {
      this.loadSshKeys();
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  loadSshKeys(): void {
    this.isLoading.set(true);
    this.error.set(null);
    const active = this.providersService
      .activeProviders()
      .map((c) => c.provider.toLowerCase() as ProviderSlug);
    const calls =
      active.length > 0
        ? active.map((p) =>
            this.accessManagementService.accessControllerListSSHKeys(
              undefined,
              undefined,
              undefined,
              p,
            ),
          )
        : [this.accessManagementService.accessControllerListSSHKeys()];

    forkJoin(calls)
      .pipe(map((results) => dedupeByFingerprint(results.flat())))
      .subscribe({
        next: (keys) => {
          this.sshKeys.set(keys);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading SSH keys:', err);
          this.error.set(sandboxFailureMessage(err, 'Failed to load SSH keys. Please try again.'));
          this.isLoading.set(false);
        },
      });
  }

  onKeyAction({ key, action }: KeyAction): void {
    if (action === 'copy') void navigator.clipboard.writeText(key.publicKey);
    else if (action === 'download') downloadPublicKey(key);
    else if (action === 'delete') this.deleteKey(key);
    else if (action.startsWith('sync:')) this.syncKeyToProvider(key, action.slice(5));
    else if (action.startsWith('unsync:')) this.unsyncKeyFromProvider(key, action.slice(7));
  }

  syncKeyToProvider(key: SSHKeyDto, providerId: string): void {
    const dto: UpdateSSHKeyDto = {
      syncProviders: [providerId as UpdateSSHKeyDto.SyncProvidersEnum],
    };
    this.updateSync(key, providerId, dto, this.syncingSet, 'Failed to sync key to provider:');
  }

  unsyncKeyFromProvider(key: SSHKeyDto, providerId: string): void {
    const dto: UpdateSSHKeyDto = {
      unsyncProviders: [providerId as UpdateSSHKeyDto.UnsyncProvidersEnum],
    };
    this.updateSync(key, providerId, dto, this.unsyncingSet, 'Failed to unsync key from provider:');
  }

  private updateSync(
    key: SSHKeyDto,
    providerId: string,
    dto: UpdateSSHKeyDto,
    busy: WritableSignal<Set<string>>,
    failure: string,
  ): void {
    const token = syncToken(key.id, providerId);
    busy.update((s) => withToken(s, token));
    this.accessManagementService.accessControllerUpdateSSHKey(key.id, dto, 'response').subscribe({
      next: (response) => {
        this.sshKeys.update((keys) =>
          keys.map((k) => (k.id === response.body?.id ? response.body : k)),
        );
        busy.update((s) => withoutToken(s, token));
      },
      error: (err) => {
        console.error(failure, err);
        busy.update((s) => withoutToken(s, token));
      },
    });
  }

  toggleDateSort(): void {
    this.dateSort.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  toggleKeySelection(id: string): void {
    this.selectedKeys.update((s) => toggled(s, id));
  }

  toggleSelectAll(): void {
    this.selectedKeys.set(
      this.isAllSelected() ? new Set() : new Set(this.sortedSshKeys().map((k) => k.id)),
    );
  }

  clearSelection(): void {
    this.selectedKeys.set(new Set());
  }

  openBulkDeleteModal(): void {
    this.bulkDeleteScope.set('all');
    this.bulkDeleteCount.set(this.selectedKeys().size);
    this.bulkDeleteError.set(null);
    this.bulkDeleteSuccess.set(false);
    this.bulkDeleteProgress.set(0);
    this.showBulkDeleteModal.set(true);
  }

  closeBulkDeleteModal(): void {
    this.showBulkDeleteModal.set(false);
    this.isBulkDeleting.set(false);
    this.bulkDeleteError.set(null);
    this.bulkDeleteSuccess.set(false);
    this.bulkDeleteProgress.set(0);
  }

  confirmBulkDelete(): void {
    const keys = this.sshKeys().filter((k) => this.selectedKeys().has(k.id));
    if (keys.length === 0) return;
    const scope = this.bulkDeleteScope();
    this.isBulkDeleting.set(true);
    this.bulkDeleteError.set(null);
    this.bulkDeleteProgress.set(0);

    runInSequence(
      keys,
      (key) => {
        const target = bulkDeleteTarget(key, scope);
        return this.accessManagementService.accessControllerRemoveSSHKey(
          key.id,
          target.removeFromProviders,
          target.provider,
        );
      },
      (key, ok) => {
        if (ok) this.sshKeys.update((ks) => ks.filter((k) => k.id !== key.id));
        this.bulkDeleteProgress.update((p) => p + 1);
      },
      (failed) => {
        this.isBulkDeleting.set(false);
        this.bulkDeleteSuccessMessage.set(bulkDeleteMessage(keys.length, failed));
        this.bulkDeleteSuccess.set(true);
        this.clearSelection();
        setTimeout(() => this.closeBulkDeleteModal(), 2000);
      },
    );
  }

  deleteKey(key: SSHKeyDto): void {
    this.deleteScope.set(
      key.syncedFromProvider && key.source !== 'local' ? (key.source as string) : 'all',
    );
    this.deleteSyncedProviders.set(
      providerSyncOf(key, this.providers())
        .filter((p) => p.synced)
        .map((p) => ({ id: p.id, displayName: p.displayName })),
    );
    this.keyToDelete.set(key);
  }

  confirmDelete(): void {
    const key = this.keyToDelete();
    if (!key) return;
    const target = deleteTarget(this.deleteScope());
    this.isDeleting.set(true);
    this.deleteError.set(null);
    this.accessManagementService
      .accessControllerRemoveSSHKey(key.id, target.removeFromProviders, target.provider)
      .subscribe({
        next: () => {
          this.sshKeys.update((keys) => keys.filter((k) => k.id !== key.id));
          this.isDeleting.set(false);
          this.deleteSuccess.set(true);
          setTimeout(() => this.cancelDelete(), 1500);
        },
        error: (err) => {
          console.error('Error deleting SSH key:', err);
          this.deleteError.set(
            err?.error?.message ?? 'Failed to delete SSH key. Please try again.',
          );
          this.isDeleting.set(false);
        },
      });
  }

  cancelDelete(): void {
    this.keyToDelete.set(null);
    this.deleteScope.set('all');
    this.deleteSyncedProviders.set([]);
    this.isDeleting.set(false);
    this.deleteError.set(null);
    this.deleteSuccess.set(false);
  }

  openAddModal(): void {
    this.addError.set(null);
    this.showAddModal.set(true);
  }

  onSubmitNewKey(request: NewKeyRequest): void {
    const createDto: CreateSSHKeyDto = {
      name: request.name,
      userName: request.userName,
      ...(request.providers.length > 0 && {
        providers: request.providers as CreateSSHKeyDto.ProvidersEnum[],
      }),
    };
    this.isLoading.set(true);
    this.error.set(null);
    this.accessManagementService.accessControllerAddSSHKey(createDto).subscribe({
      next: () => {
        this.showAddModal.set(false);
        this.loadSshKeys();
      },
      error: (err) => {
        console.error('Error creating SSH key:', err);
        this.error.set('Failed to create SSH key. Please try again.');
        this.addError.set('Failed to create SSH key. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
