import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideGitBranch, lucideRefreshCw } from '@ng-icons/lucide';

import { RepositoryService, ConnectedRepository } from '../../service/repository.service';
import { GitProvider } from '../../model/application.models';
import { GhcrPatModalComponent } from './ghcr-pat-modal.component';
import { RepoDeployChoiceModalComponent } from './repo-deploy-choice-modal.component';
import { PermissionService } from '../../../core/services/permission.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  RepositoriesListSurfaceInput,
  RepositoriesListSurfaceRevision,
  RepositoriesPageState,
  buildRepositoriesListSurface,
  presentedContent,
} from './repositories-list-surface';
import { githubAppConfigUrl } from './repositories-format';
import { RepoToasts, RepositoriesToastStack } from './repositories-toasts';
import { RepositoriesConfirmDialog } from './repositories-confirm-dialog';
import { RepositoriesConnection } from './repositories-connection';
import { RepositoriesGhcrPanel } from './repositories-ghcr-panel';
import { RepositoriesTable } from './repositories-table';
import { RepositoriesImportDialog } from './repositories-import-dialog';
import { RepositoriesImportStore } from './repositories-import-store';
import { RepositoriesPatStore } from './repositories-pat-store';
import { RepositoriesDeployStore } from './repositories-deploy-store';

@Component({
  selector: 'app-repositories-list',
  imports: [
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    GhcrPatModalComponent,
    RepoDeployChoiceModalComponent,
    RepositoriesToastStack,
    RepositoriesConfirmDialog,
    RepositoriesConnection,
    RepositoriesGhcrPanel,
    RepositoriesTable,
    RepositoriesImportDialog,
  ],
  providers: [
    RepoToasts,
    RepositoriesImportStore,
    RepositoriesPatStore,
    RepositoriesDeployStore,
    provideIcons({ lucideDownload, lucideGitBranch, lucideRefreshCw }),
  ],
  template: `
    <app-repositories-toasts [toasts]="toasts" />

    <div class="fl-page">
      <fl-page-header [title]="pageTitle()">
        <span headerMeta>{{ summary() }}</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="isLoading()"
            (click)="refreshRepos()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          @if (isGitHubConnected()) {
            <button flButton="primary" type="button" (click)="importer.open()">
              <fl-icon name="lucideDownload" />
              Import repositories
            </button>
          }
        </ng-container>
      </fl-page-header>

      @if (pageState() === 'connected') {
        @if (errorMessage() && !isLoading()) {
          <fl-alert tone="error" title="Could not load the repositories">{{
            errorMessage()
          }}</fl-alert>
        }

        <fl-panel
          title="Imported repositories"
          [count]="isLoading() ? null : allRepos().length"
          [flush]="true"
        >
          @if (isLoading()) {
            <fl-loading-state [rows]="4" />
          } @else if (allRepos().length === 0) {
            <fl-empty-state
              icon="lucideGitBranch"
              title="No repositories imported yet"
              body="Import repositories from GitHub to build and deploy them."
            >
              <button flButton size="sm" type="button" (click)="importer.open()">
                Import repositories
              </button>
            </fl-empty-state>
          } @else {
            <app-repositories-table
              [repos]="allRepos()"
              [checking]="deployer.checking()"
              (deploy)="deployer.deploy($event)"
              (openMap)="openReadinessMap($event)"
              (remove)="confirmDelete($event)"
            />
          }
        </fl-panel>
      }

      <div class="fl-grid-2">
        <app-repositories-connection
          [state]="pageState()"
          [authMethod]="setupStatus()?.authMethod ?? null"
          [appSlug]="setupStatus()?.appSlug"
          [username]="gitHubUsername()"
          [configUrl]="githubAppConfigUrl()"
          [healthError]="setupHealthError()"
          (setup)="navigateToSetup()"
          (disconnect)="disconnectOAuth('github')"
          (connected)="onGithubConnected($event)"
        />
        @if (showGhcrPanel()) {
          <app-repositories-ghcr-panel
            [pat]="pat.status()"
            (edit)="pat.modalMode.set($event)"
            (remove)="pat.confirmingRemove.set(true)"
          />
        }
      </div>
    </div>

    @if (importer.isOpen()) {
      <app-repositories-import-dialog
        [repos]="importer.available()"
        [loading]="importer.loadingAvailable()"
        [importing]="importer.importing()"
        [selected]="importer.selected()"
        [authMethod]="setupStatus()?.authMethod"
        [configUrl]="githubAppConfigUrl()"
        (closed)="importer.close()"
        (toggled)="importer.toggle($event)"
        (importSelected)="importer.importSelected()"
        (retry)="importer.refresh()"
      />
    }

    @if (showDeleteModalFlag()) {
      <app-repositories-confirm-dialog
        title="Remove repository"
        [body]="
          'Remove ' +
          (repoToDelete()?.fullName ?? 'this repository') +
          ' from Flui? The repository stays on GitHub.'
        "
        confirmLabel="Remove"
        busyLabel="Removing…"
        [busy]="isDeleting()"
        (cancelled)="cancelDelete()"
        (confirmed)="executeDelete()"
      />
    }

    @if (providerToDisconnect()) {
      <app-repositories-confirm-dialog
        [title]="'Disconnect ' + providerLabel()"
        [body]="'Disconnect ' + providerLabel() + '? Every repository imported from it is removed.'"
        confirmLabel="Disconnect"
        busyLabel="Disconnecting…"
        [busy]="isDisconnecting()"
        (cancelled)="cancelDisconnect()"
        (confirmed)="executeDisconnect()"
      />
    }

    @if (pat.confirmingRemove()) {
      <app-repositories-confirm-dialog
        title="Remove GHCR token"
        body="Without this token Flui cannot pull private container images from GHCR. You can add a new token at any time."
        confirmLabel="Remove"
        busyLabel="Removing…"
        [busy]="pat.removing()"
        (cancelled)="pat.confirmingRemove.set(false)"
        (confirmed)="pat.remove()"
      />
    }

    @if (pat.modalMode(); as mode) {
      <app-ghcr-pat-modal
        [mode]="mode"
        [initialExpiresAt]="pat.status()?.expiresAt"
        (cancelled)="pat.modalMode.set(null)"
        (saved)="pat.onSaved()"
      />
    }

    @if (deployer.choiceRepo(); as choiceRepo) {
      <app-repo-deploy-choice-modal
        [repo]="{ id: choiceRepo.id, fullName: choiceRepo.fullName }"
        [matchedApps]="deployer.choiceApps()"
        (closed)="deployer.closeChoice()"
        (triggerBuild)="deployer.triggerBuild($event)"
        (createNewApp)="deployer.createNewApp()"
      />
    }
  `,
})
export class RepositoriesListComponent implements OnInit, OnDestroy {
  private readonly repoService = inject(RepositoryService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  readonly toasts = inject(RepoToasts);
  readonly importer = inject(RepositoriesImportStore);
  readonly pat = inject(RepositoriesPatStore);
  readonly deployer = inject(RepositoriesDeployStore);

  allRepos = this.repoService.repositories;
  isLoading = this.repoService.loading;
  errorMessage = this.repoService.errorMessage;
  isGitHubConnected = this.repoService.isGitHubConnected;
  connectedCount = this.repoService.connectedCount;
  setupStatus = this.repoService.setupStatus;
  setupRefused = this.repoService.setupRefused;
  readonly setupHealth = this.repoService.setupHealth;

  private readonly isAdmin = computed(() => this.permissions.isAdmin());

  readonly isInitializing = signal(true);

  readonly pageState = computed<RepositoriesPageState>(() => {
    if (this.isInitializing()) return 'initializing';
    if (this.setupRefused()) return 'refused';
    const setup = this.setupStatus();
    if (!setup?.configured) {
      return this.isAdmin() ? 'not-configured-admin' : 'not-configured-user';
    }
    if (this.setupHealth()?.ok === false) {
      return this.isAdmin() ? 'misconfigured-admin' : 'misconfigured-user';
    }
    return this.isGitHubConnected() ? 'connected' : 'not-connected';
  });

  readonly setupHealthError = computed(() => {
    const details = this.setupHealth()?.details as { error?: string; message?: string } | undefined;
    return details?.message ?? details?.error ?? 'unreachable';
  });

  autoDeployCount = computed(() => this.allRepos().filter((r) => r.autoDeployEnabled).length);

  gitHubUsername = computed(() => this.repoService.oauth().get(GitProvider.GitHub)?.username);

  githubAppConfigUrl = computed(() => githubAppConfigUrl(this.setupStatus()?.appSlug));

  readonly pageTitle = computed(() =>
    this.pageState() === 'connected' && !this.isLoading()
      ? `Repositories (${this.allRepos().length})`
      : 'Repositories',
  );

  readonly summary = computed(() => {
    if (this.pageState() !== 'connected') return 'Connect GitHub to import and deploy repositories';
    return `${this.connectedCount()} imported, ${this.autoDeployCount()} with auto-deploy`;
  });

  readonly showGhcrPanel = computed(
    () =>
      this.pageState() === 'connected' &&
      this.setupStatus()?.authMethod === 'github_app' &&
      this.setupStatus()?.imageRegistry !== 'flui',
  );

  showDeleteModalFlag = signal(false);
  repoToDelete = signal<ConnectedRepository | null>(null);
  isDeleting = signal(false);

  providerToDisconnect = signal<'github' | 'gitlab' | null>(null);
  readonly isDisconnecting = signal(false);
  readonly providerLabel = computed(() =>
    this.providerToDisconnect() === 'gitlab' ? 'GitLab' : 'GitHub',
  );

  private readonly surfaceRevision = new RepositoriesListSurfaceRevision();

  readonly surface = computed(() => {
    const input: RepositoriesListSurfaceInput = {
      pageState: this.pageState(),
      authMethod: this.setupStatus()?.authMethod
        ? String(this.setupStatus()?.authMethod)
        : undefined,
      gitHubUsername: this.gitHubUsername(),
      allRepos: this.allRepos(),
      connectedCount: this.connectedCount(),
      autoDeployCount: this.autoDeployCount(),
      importModalOpen: this.importer.isOpen(),
      importSelectedCount: this.importer.selected().length,
      deleteModalOpen: this.showDeleteModalFlag(),
      repoToDelete: this.repoToDelete(),
    };
    return buildRepositoriesListSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    void (async () => {
      this.route.queryParams.pipe(take(1)).subscribe(async (params) => {
        if (params['connected'] === 'true') {
          await this.handleOAuthSuccess();
        } else if (params['error']) {
          this.handleOAuthError(params['error']);
        }
      });

      await Promise.all([
        this.repoService.checkSetupStatus(),
        this.repoService.checkSetupHealth(),
        this.repoService.checkOAuthStatus(),
      ]);

      const setup = this.repoService.setupStatus();
      if (setup?.configured && this.isGitHubConnected()) {
        await this.loadRepos();
      }

      if (setup?.authMethod === 'github_app' && this.isGitHubConnected()) {
        void this.pat.load();
      }

      this.isInitializing.set(false);
    })();
  }

  navigateToSetup(): void {
    this.router.navigate(['/apps/repositories/github-setup']);
  }

  openReadinessMap(repo: ConnectedRepository): void {
    this.router.navigate(['/apps/repositories', repo.id, 'map']);
  }

  async onGithubConnected(event: { username: string }): Promise<void> {
    await this.repoService.checkOAuthStatus();
    await this.loadRepos();
    this.toasts.show('success', 'GitHub connected', `Connected as @${event.username}`, 5000);
  }

  async loadRepos() {
    try {
      await this.repoService.loadRepositories();
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  }

  async refreshRepos() {
    await this.loadRepos();
  }

  private async handleOAuthSuccess() {
    this.toasts.show(
      'success',
      'GitHub connected',
      'Your GitHub account is connected. You can import repositories now.',
      5000,
    );
    await this.repoService.checkOAuthStatus();
    await this.loadRepos();
    this.clearQueryParams();
  }

  private handleOAuthError(error: string) {
    console.error('OAuth error:', error);
    if (error === 'access_denied') {
      this.toasts.show(
        'warning',
        'Connection cancelled',
        'You cancelled the GitHub connection. Try again and authorize the application to connect your account.',
        8000,
      );
    } else {
      this.toasts.show(
        'error',
        'GitHub connection failed',
        error || 'Failed to connect GitHub account',
        10000,
      );
    }
    this.clearQueryParams();
  }

  private clearQueryParams(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  disconnectOAuth(provider: 'github' | 'gitlab') {
    this.providerToDisconnect.set(provider);
  }

  async executeDisconnect() {
    const provider = this.providerToDisconnect();
    if (!provider) return;

    this.isDisconnecting.set(true);
    try {
      const gitProvider = provider === 'github' ? GitProvider.GitHub : GitProvider.GitLab;
      await this.repoService.disconnectOAuth(gitProvider);
      await this.loadRepos();
      this.providerToDisconnect.set(null);
    } catch (error) {
      console.error('Failed to disconnect OAuth:', error);
    } finally {
      this.isDisconnecting.set(false);
    }
  }

  cancelDisconnect() {
    this.providerToDisconnect.set(null);
  }

  confirmDelete(repo: ConnectedRepository) {
    this.repoToDelete.set(repo);
    this.showDeleteModalFlag.set(true);
  }

  cancelDelete() {
    this.showDeleteModalFlag.set(false);
    this.repoToDelete.set(null);
  }

  async executeDelete() {
    const repo = this.repoToDelete();
    if (!repo?.id) return;

    this.isDeleting.set(true);
    try {
      await this.repoService.disconnectRepository(repo.id);
      this.showDeleteModalFlag.set(false);
      this.repoToDelete.set(null);
      await this.loadRepos();
    } catch (error) {
      console.error('Failed to delete repository:', error);
    } finally {
      this.isDeleting.set(false);
    }
  }
}
