import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { GitRepository, GitProvider, Framework } from '../model/application.models';
import { RepositoriesService } from '../../core/api/api/repositories.service';
import { GitHubOAuthService } from '../../core/api/api/gitHubOAuth.service';
import { GitHubSetupService } from '../../core/api/api/gitHubSetup.service';
import { ImportRepositoriesResponseDto } from '../../core/api/model/importRepositoriesResponseDto';
import { GitHubSetupStatusResponseDto } from '../../core/api/model/gitHubSetupStatusResponseDto';
import { PublicRepoSearchResultDto } from '../../core/api/model/publicRepoSearchResultDto';
import { RepositoryAnalysisDto } from '../../core/api/model/repositoryAnalysisDto';
import { ExtractedEnvVarDto } from '../../core/api/model/extractedEnvVarDto';

interface ImportedRepositoryDto {
  id: string;
  repositoryName: string;
  repositoryFullName: string;
  description?: string;
  provider: string;
  htmlUrl?: string;
  cloneUrl?: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string;
  createdAt: string;
  webhookActive?: boolean;
  autoDeployEnabled?: boolean;
}

export interface ConnectedRepository extends GitRepository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  stars?: number;
  forks?: number;
  language?: string;
  detectedFramework?: Framework;
  hasDockerfile: boolean;
  hasPackageJson: boolean;
  connected: boolean;
  connectedAt?: string;
}

export interface OAuthStatus {
  provider: GitProvider;
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  expiresAt?: string;
  scopes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RepositoryService {
  // Inject API services
  private readonly repositoriesApi = inject(RepositoriesService);
  private readonly gitHubOAuthApi = inject(GitHubOAuthService);
  private readonly gitHubSetupApi = inject(GitHubSetupService);

  // Private signals
  private readonly repositoriesList = signal<ConnectedRepository[]>([]);
  private readonly availableReposList = signal<any[]>([]);
  private readonly oauthStatus = signal<Map<GitProvider, OAuthStatus>>(new Map());
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly selectedRepositoryId = signal<string | null>(null);
  private readonly githubSetupStatus = signal<GitHubSetupStatusResponseDto | null>(null);

  // Public readonly signals
  readonly repositories = this.repositoriesList.asReadonly();
  readonly availableRepositories = this.availableReposList.asReadonly();
  readonly oauth = this.oauthStatus.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly selectedId = this.selectedRepositoryId.asReadonly();
  readonly setupStatus = this.githubSetupStatus.asReadonly();

  // Computed signals
  readonly hasRepositories = computed(() => this.repositoriesList().length > 0);
  readonly connectedRepositories = computed(() =>
    this.repositoriesList().filter((repo) => repo.connected)
  );
  readonly connectedCount = computed(() => this.connectedRepositories().length);

  readonly selectedRepository = computed(() => {
    const id = this.selectedRepositoryId();
    if (!id) return null;
    return this.repositoriesList().find((repo) => repo.id === id) || null;
  });

  readonly isGitHubConnected = computed(() => {
    const status = this.oauthStatus().get(GitProvider.GitHub);
    return status?.connected || false;
  });

  readonly isGitLabConnected = computed(() => {
    const status = this.oauthStatus().get(GitProvider.GitLab);
    return status?.connected || false;
  });

  /**
   * True when the GitHub OAuth token includes the `repo` scope (required to create
   * private repositories from templates). The backend returns scopes as a single
   * comma- or space-separated string per the GitHub API convention.
   */
  readonly hasRepoScope = computed(() => {
    const setup = this.setupStatus();
    if (setup?.authMethod === 'github_app' && setup.configured) return true;
    const status = this.oauthStatus().get(GitProvider.GitHub);
    if (!status?.connected) return false;
    return /(^|[,\s])repo([,\s]|$)/.test(status.scopes ?? '');
  });

  constructor() {
    this.initOAuthStatus();
  }

  private applyOAuthResult(status: { connected?: boolean; githubUsername?: string; connectedAt?: string; scopes?: string } | null): void {
    const oauthMap = new Map<GitProvider, OAuthStatus>();
    oauthMap.set(GitProvider.GitHub, status
      ? { provider: GitProvider.GitHub, connected: status.connected || false, username: status.githubUsername, expiresAt: status.connectedAt, scopes: status.scopes }
      : { provider: GitProvider.GitHub, connected: false }
    );
    oauthMap.set(GitProvider.GitLab, { provider: GitProvider.GitLab, connected: false });
    this.oauthStatus.set(oauthMap);
  }

  private initOAuthStatus(): void {
    this.gitHubOAuthApi.gitHubOAuthControllerGetStatus()
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(status => this.applyOAuthResult(status));
  }

  async checkOAuthStatus(): Promise<void> {
    try {
      const status = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerGetStatus()
      );
      this.applyOAuthResult(status);
    } catch {
      this.applyOAuthResult(null);
    }
  }

  /**
   * Check GitHub system-level setup status (admin configured or not)
   */
  async checkSetupStatus(): Promise<GitHubSetupStatusResponseDto> {
    try {
      const status = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerGetStatus()
      );
      this.githubSetupStatus.set(status);
      return status;
    } catch (error: any) {
      const fallback: GitHubSetupStatusResponseDto = { configured: false, authMethod: null };
      this.githubSetupStatus.set(fallback);
      return fallback;
    }
  }

  /**
   * Load imported repositories from API
   */
  async loadRepositories(provider?: GitProvider): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const repositories = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerListRepositories()
      );

      const mappedRepos: ConnectedRepository[] = (repositories as ImportedRepositoryDto[]).map((repo) => ({
        id: repo.id,
        name: repo.repositoryName,
        fullName: repo.repositoryFullName,
        description: repo.description,
        provider: repo.provider === 'github' ? GitProvider.GitHub : GitProvider.GitLab,
        url: repo.htmlUrl || repo.cloneUrl || '',
        branch: repo.defaultBranch,
        private: repo.isPrivate,
        language: repo.language,
        hasDockerfile: false, // Need to detect
        hasPackageJson: true, // Assume true
        connected: true, // Already imported means connected
        connectedAt: repo.createdAt,
        webhookEnabled: repo.webhookActive || false,
        autoDeployEnabled: repo.autoDeployEnabled || false,
        lastCommit: undefined, // Will be loaded separately if needed
      }));

      if (provider) {
        const filtered = mappedRepos.filter((repo) => repo.provider === provider);
        this.repositoriesList.set(filtered);
      } else {
        this.repositoriesList.set(mappedRepos);
      }
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load repositories';
      console.error('❌ Failed to load repositories:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load available repositories from GitHub (not yet imported)
   */
  async loadAvailableRepositories(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const available = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerListAvailableRepositories()
      );

      this.availableReposList.set(available);
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load available repositories';
      console.error('❌ Failed to load available repositories:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Connect OAuth provider (GitHub)
   */
  async connectOAuth(provider: GitProvider): Promise<string> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (provider !== GitProvider.GitHub) {
        throw new Error('Only GitHub OAuth is currently supported');
      }

      const response = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerConnect()
      );

      return response.url || '';
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to connect OAuth';
      console.error('❌ Failed to connect OAuth:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Disconnect OAuth provider
   */
  async disconnectOAuth(provider: GitProvider): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (provider !== GitProvider.GitHub) {
        throw new Error('Only GitHub OAuth is currently supported');
      }

      await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerDisconnect()
      );

      this.oauthStatus.update((current) => {
        const updated = new Map(current);
        updated.set(provider, {
          provider,
          connected: false,
        });
        return updated;
      });

      this.repositoriesList.set([]);
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to disconnect OAuth';
      console.error('❌ Failed to disconnect OAuth:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Import repositories from GitHub
   * Returns the import response with details about success/failures
   */
  async importRepositories(repositoryIds: string[], autoDeployEnabled = false): Promise<ImportRepositoriesResponseDto> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerImportRepositories({
          repositoryIds,
          autoDeployEnabled,
        })
      );

      return response;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to import repositories';
      console.error('❌ Failed to import repositories:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Connect a repository for deployments (legacy method - now handled by importRepositories)
   */
  async connectRepository(repositoryId: string): Promise<void> {
    // For backward compatibility, we map this to importing a single repository
    await this.importRepositories([repositoryId]);
    // Void return for backward compatibility
  }

  /**
   * Delete/disconnect a repository
   */
  async disconnectRepository(repositoryId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.repositoriesApi.repositoriesControllerDeleteRepository(repositoryId)
      );

      // Remove from local list
      this.repositoriesList.update((repos) =>
        repos.filter((repo) => repo.id !== repositoryId)
      );

    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to disconnect repository';
      console.error('❌ Failed to disconnect repository:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle webhook for a repository
   * Note: This functionality may need to be added to the backend API
   */
  async toggleWebhook(repositoryId: string, enabled: boolean): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.repositoriesList.update((repos) =>
        repos.map((repo) =>
          repo.id === repositoryId ? { ...repo, webhookEnabled: enabled } : repo
        )
      );

    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to toggle webhook';
      console.error('❌ Failed to toggle webhook:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle auto-deploy for a repository
   * Note: This functionality may need to be added to the backend API
   */
  async toggleAutoDeploy(repositoryId: string, enabled: boolean): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.repositoriesList.update((repos) =>
        repos.map((repo) =>
          repo.id === repositoryId ? { ...repo, autoDeployEnabled: enabled } : repo
        )
      );

    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to toggle auto-deploy';
      console.error('❌ Failed to toggle auto-deploy:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if a repository contains a Dockerfile (V3 lightweight check, no clone)
   */
  async checkDockerfile(repositoryId: string): Promise<{ hasDockerfile: boolean }> {
    try {
      return await firstValueFrom(
        this.repositoriesApi.repositoriesControllerCheckDockerfilePresence(repositoryId)
      );
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to check Dockerfile presence';
      console.error('Failed to check Dockerfile:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Analyze repository for framework detection
   */
  async analyzeRepository(repositoryId: string, branch: string): Promise<any> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const analysis = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerAnalyzeRepository(repositoryId, { branch })
      );

      return analysis;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to analyze repository';
      console.error('❌ Failed to analyze repository:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Extract environment variables from a repository
   */
  async extractEnvVars(repositoryId: string, branch: string, framework: string): Promise<ExtractedEnvVarDto[]> {
    try {
      return await firstValueFrom(
        this.repositoriesApi.repositoriesControllerExtractEnv(repositoryId, { branch, framework })
      );
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to extract env vars';
      console.error('❌ Failed to extract env vars:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Detect framework from repository (legacy - use analyzeRepository instead)
   */
  async detectFramework(repositoryId: string, branch = 'main'): Promise<Framework | null> {
    try {
      const analysis = await this.analyzeRepository(repositoryId, branch);
      const frameworkMap: Record<string, Framework> = {
        nextjs: Framework.NextJS,
        angular: Framework.Angular,
        nestjs: Framework.NestJS,
        react: Framework.React,
        vue: Framework.Vue,
        nuxt: Framework.Nuxt,
        express: Framework.Express,
        fastify: Framework.Fastify,
        django: Framework.Django,
        flask: Framework.Flask,
        laravel: Framework.Laravel,
      };

      return frameworkMap[analysis.detection?.framework] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get repository branches
   */
  async getRepositoryBranches(repositoryId: string): Promise<any[]> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const branches = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerListBranches(repositoryId)
      );

      return branches;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load branches';
      console.error('❌ Failed to load branches:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get repository commits
   */
  async getRepositoryCommits(repositoryId: string, branch?: string, limit = 10): Promise<any[]> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const commits = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerListCommits(repositoryId, branch || 'main', limit)
      );

      return commits;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load commits';
      console.error('❌ Failed to load commits:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Analyze a public GitHub repository (no import required)
   */
  async analyzePublicRepository(cloneUrl: string, branch?: string): Promise<RepositoryAnalysisDto> {
    return firstValueFrom(
      this.repositoriesApi.repositoriesControllerAnalyzePublicRepository({ cloneUrl, branch })
    );
  }

  /**
   * Search public GitHub repositories
   */
  async searchPublicRepositories(query: string, limit = 15): Promise<PublicRepoSearchResultDto[]> {
    return firstValueFrom(
      this.gitHubOAuthApi.gitHubOAuthControllerSearchPublicRepositories(query, limit)
    );
  }

  /**
   * List branches of a public GitHub repository
   */
  async getPublicRepositoryBranches(fullName: string): Promise<string[]> {
    const branches = await firstValueFrom(
      this.gitHubOAuthApi.gitHubOAuthControllerGetPublicRepoBranches(fullName)
    );
    return branches.map(b => b.name);
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.error.set(null);
  }
}
