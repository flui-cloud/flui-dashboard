import { Component, EventEmitter, Input, Output, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX, lucideLoader, lucideCheck, lucideCircleCheck, lucideTriangleAlert,
  lucideGithub, lucideServer, lucideRocket, lucideLock, lucideGlobe, lucideInfo, lucideTrash, lucideExternalLink,
} from '@ng-icons/lucide';

import { TemplateService } from '../../service/template.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { ApplicationService } from '../../service/application.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { GitProvider } from '../../model/application.models';

type FlowStep =
  | 'form'
  | 'creating-repo'
  | 'registering-repo'
  | 'creating-app'
  | 'generating-workflow'
  | 'done'
  | 'error';

interface OrchestrationPhase {
  id: Exclude<FlowStep, 'form' | 'done' | 'error'>;
  label: string;
}

const PHASES: OrchestrationPhase[] = [
  { id: 'creating-repo',       label: 'Creating GitHub repository from template' },
  { id: 'registering-repo',    label: 'Registering repository with Flui' },
  { id: 'creating-app',        label: 'Creating Flui application' },
  { id: 'generating-workflow', label: 'Committing build workflow to repository' },
];

const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

@Component({
  selector: 'app-use-template-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon],
  providers: [provideIcons({
    lucideX, lucideLoader, lucideCheck, lucideCircleCheck, lucideTriangleAlert,
    lucideGithub, lucideServer, lucideRocket, lucideLock, lucideGlobe, lucideInfo, lucideTrash, lucideExternalLink,
  })],
  template: `
    <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
         (click)="onBackdropClick($event)">
      <div class="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
           (click)="onCardClick($event)">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ng-icon name="lucideRocket" class="h-4 w-4" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h2 class="font-semibold text-base leading-tight truncate">Create repo from template</h2>
                <button type="button" (click)="togglePopover('intro', $event)" class="text-muted-foreground hover:text-foreground transition-colors flex">
                  <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
                </button>
              </div>
              <p class="text-xs text-muted-foreground truncate">{{ template.displayName }}</p>
            </div>
          </div>
          <button type="button" (click)="onClose()" [disabled]="isBusy()"
            class="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">

          @if (currentStep() === 'form') {
            <!-- GitHub scope warning -->
            @if (!repositoryService.hasRepoScope()) {
              <div class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                <ng-icon name="lucideTriangleAlert" class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div class="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                  <p class="font-medium">GitHub connection required</p>
                  <p>Connect GitHub with the <code class="font-mono">repo</code> scope to create a new repository.</p>
                  <a routerLink="/apps/repositories/github-setup" class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:underline font-medium">
                    Connect GitHub →
                  </a>
                </div>
              </div>
            }

            <!-- Repo name -->
            <div class="space-y-1.5">
              <label class="text-sm font-medium">Repository name <span class="text-destructive">*</span></label>
              <input
                type="text"
                [value]="name()"
                (input)="name.set($any($event.target).value)"
                placeholder="my-awesome-app"
                class="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono"
              />
              @if (nameError(); as err) {
                <p class="text-xs text-destructive">{{ err }}</p>
              }
            </div>

            <!-- Owner (optional) -->
            <div class="space-y-1.5">
              <div class="flex items-center gap-1.5">
                <label class="text-sm font-medium">Owner <span class="text-muted-foreground font-normal">(optional)</span></label>
                <button type="button" (click)="togglePopover('owner', $event)" class="text-muted-foreground hover:text-foreground transition-colors flex">
                  <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                [value]="owner()"
                (input)="owner.set($any($event.target).value)"
                [placeholder]="defaultOwnerPlaceholder()"
                class="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono"
              />
            </div>

            <!-- Visibility -->
            <div class="space-y-1.5">
              <div class="flex items-center gap-1.5">
                <label class="text-sm font-medium">Visibility</label>
                <button type="button" (click)="togglePopover('visibility', $event)" class="text-muted-foreground hover:text-foreground transition-colors flex">
                  <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
                </button>
              </div>
              <div class="flex gap-2">
                <button type="button" (click)="isPrivate.set(true)" [class]="getVisibilityButtonClass(true)">
                  <ng-icon name="lucideLock" class="h-3.5 w-3.5" /> Private
                </button>
                <button type="button" (click)="isPrivate.set(false)" [class]="getVisibilityButtonClass(false)">
                  <ng-icon name="lucideGlobe" class="h-3.5 w-3.5" /> Public
                </button>
              </div>
            </div>

            <!-- Cluster picker (only when multiple) -->
            @if (clusters().length > 1) {
              <div class="space-y-1.5">
                <label class="text-sm font-medium">Target cluster <span class="text-destructive">*</span></label>
                <select
                  [value]="selectedClusterId()"
                  (change)="selectedClusterId.set($any($event.target).value)"
                  class="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="" disabled>Select a cluster...</option>
                  @for (cluster of clusters(); track cluster.id) {
                    <option [value]="cluster.id">{{ cluster.name }} — {{ cluster.region }}</option>
                  }
                </select>
              </div>
            } @else if (clusters().length === 1) {
              <p class="text-xs text-muted-foreground">
                Deploying to <span class="font-medium text-foreground">{{ clusters()[0].name }}</span>
              </p>
            } @else if (!isLoadingClusters()) {
              <div class="flex items-start gap-2 p-3 rounded-md border border-destructive/20 bg-destructive/5 text-xs text-destructive">
                <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                <span>No clusters available. Create a cluster first.</span>
              </div>
            }

            <!-- Template info summary -->
            <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
              <p class="font-medium text-foreground">Runtime defaults from this template</p>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                <span>Framework:</span>
                <span class="font-medium text-foreground">{{ template.displayName }} {{ template.version }}</span>
                <span>Port:</span>
                <span class="font-mono text-foreground">{{ template.port }}</span>
                <span>Healthcheck:</span>
                <span class="font-mono text-foreground">{{ template.healthcheckPath }}</span>
                <span>Build tool:</span>
                <span class="text-foreground">{{ template.buildTool }}</span>
              </div>
            </div>
          }

          @if (currentStep() !== 'form') {
            <!-- Progress stepper -->
            <div class="space-y-2.5">
              @for (phase of phases; track phase.id) {
                <div class="flex items-center gap-3 text-sm">
                  <div [class]="getPhaseIconClass(phase.id)">
                    @if (isPhaseDone(phase.id)) {
                      <ng-icon name="lucideCheck" class="h-3.5 w-3.5" />
                    } @else if (isPhaseActive(phase.id)) {
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    }
                  </div>
                  <span [class]="isPhasePending(phase.id) ? 'text-muted-foreground' : 'text-foreground'">
                    {{ phase.label }}
                  </span>
                </div>
              }
            </div>

            @if (currentStep() === 'done') {
              <div class="flex items-start gap-2 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-xs text-green-900 dark:text-green-100">
                <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <span>
                  @if (reusedExisting()) {
                    Reused an existing repository from a previous attempt. Taking you to the build monitor...
                  } @else {
                    All set! Taking you to the build monitor...
                  }
                </span>
              </div>
            }

            @if (currentStep() === 'error' && errorMessage()) {
              <div class="flex items-start gap-2 p-3 rounded-md border border-destructive/20 bg-destructive/5 text-xs text-destructive">
                <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                <span>{{ errorMessage() }}</span>
              </div>

              @if (cleanupDone()) {
                <div class="flex items-start gap-2 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-xs text-green-900 dark:text-green-100">
                  <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div class="space-y-1">
                    <p class="font-medium">Flui resources removed.</p>
                    @if (createdGithubRepoFullName()) {
                      <p>
                        The GitHub repository
                        <a [href]="getGithubRepoUrl()" target="_blank" rel="noopener" class="font-mono underline hover:no-underline">{{ createdGithubRepoFullName() }}</a>
                        is still in your GitHub account — delete it manually if you don't want to keep it.
                      </p>
                    }
                  </div>
                </div>
              } @else if (hasResourcesToCleanup()) {
                <div class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-900 dark:text-amber-100">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div class="space-y-2">
                    <p>
                      Some resources were already created before the failure. You can either
                      <span class="font-medium">retry</span> (the steps that already succeeded will be reused),
                      or <span class="font-medium">clean them up</span> to start fresh.
                    </p>
                    <ul class="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200/80">
                      @if (createdAppId()) {
                        <li>Flui application <span class="font-mono">{{ name() }}</span></li>
                      }
                      @if (createdFluiRepoId()) {
                        <li>Flui repository link to <span class="font-mono">{{ createdGithubRepoFullName() }}</span></li>
                      }
                    </ul>
                    @if (createdGithubRepoFullName()) {
                      <div class="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/60">
                        <p class="font-medium mb-1">⚠ The GitHub repository will not be deleted</p>
                        <p>
                          Flui won't touch
                          <a [href]="getGithubRepoUrl()" target="_blank" rel="noopener" class="font-mono underline hover:no-underline inline-flex items-center gap-1">
                            {{ createdGithubRepoFullName() }}<ng-icon name="lucideExternalLink" class="h-3 w-3" />
                          </a>
                          — it lives in your GitHub account. If you don't want to keep it, open it on GitHub and delete it manually before retrying with a new name.
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
            }
          }
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          @if (currentStep() === 'form' || currentStep() === 'error') {
            <button type="button" (click)="onClose()" [disabled]="isBusy() || isCleaningUp()"
              class="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50">
              Cancel
            </button>

            @if (currentStep() === 'error' && hasResourcesToCleanup()) {
              <button type="button" (click)="cleanupCreatedResources()" [disabled]="isCleaningUp()"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                @if (isCleaningUp()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                } @else {
                  <ng-icon name="lucideTrash" class="h-4 w-4" />
                }
                Clean up resources
              </button>
            }

            <button type="button" (click)="onSubmit()" [disabled]="!canSubmit() || isCleaningUp()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              {{ currentStep() === 'error' ? 'Retry' : 'Create & Deploy' }}
            </button>
          } @else if (currentStep() !== 'done') {
            <span class="text-xs text-muted-foreground italic">Please wait...</span>
          }
        </div>
      </div>

      <!-- Floating popover (fixed positioning escapes the modal card overflow) -->
      @if (openPopover() && popoverPosition(); as pos) {
        <div
          class="fixed z-[60] w-72 -translate-x-1/2 p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-xl text-xs"
          [style.top.px]="pos.top"
          [style.left.px]="pos.left"
          (click)="$event.stopPropagation()"
        >
          <!-- Arrow -->
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45"></div>

          @switch (openPopover()) {
            @case ('intro') {
              <p>
                Flui will create a brand-new GitHub repository in your account starting from the
                <span class="font-semibold">{{ template.displayName }}</span> template, then deploy it on your cluster.
                The original template won't be touched.
              </p>
            }
            @case ('owner') {
              <p>
                GitHub user or organization that will own the new repo. Leave empty to use your personal account.
                Use an org name (e.g. <code class="font-mono bg-muted px-1 rounded">acme-corp</code>)
                to create the repo inside that organization — you must have permission to create repos there.
              </p>
            }
            @case ('visibility') {
              <p>
                <span class="font-medium">Private</span>: only you and people you invite can see the repo.
                <span class="font-medium">Public</span>: anyone on GitHub can see the source code.
                You can change this later in GitHub settings.
              </p>
            }
          }
        </div>
      }
    </div>
  `,
})
export class UseTemplateModalComponent implements OnInit {
  @Input({ required: true }) template!: TemplateResponseDto;
  @Output() closed = new EventEmitter<void>();
  @Output() success = new EventEmitter<{ applicationId: string }>();

  private readonly templateService = inject(TemplateService);
  repositoryService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);
  private readonly applicationsApi = inject(ApplicationsService);

  // Form state
  name = signal('');
  owner = signal('');
  isPrivate = signal(true);
  selectedClusterId = signal('');

  // Flow state
  currentStep = signal<FlowStep>('form');
  errorMessage = signal<string | null>(null);
  isLoadingClusters = signal(false);
  /** Set to true when the API returns an idempotent re-use (alreadyExisted or already_imported). */
  reusedExisting = signal(false);

  // Resources created during orchestration — used by the cleanup action on error.
  // Each is set as soon as the corresponding step succeeds. Cleanup walks them
  // in reverse order. The GitHub repo itself (created in step 1) is intentionally
  // NOT cleaned up automatically — it lives in the user's account and we surface
  // a manual hint instead of deleting it.
  createdGithubRepoFullName = signal<string | null>(null);
  createdFluiRepoId = signal<string | null>(null);
  createdAppId = signal<string | null>(null);
  isCleaningUp = signal(false);
  cleanupDone = signal(false);

  // Popover state — only one open at a time. Position is computed from the
  // icon button's bounding rect on click so the popover can escape the modal
  // body's overflow clipping via `position: fixed`.
  openPopover = signal<'intro' | 'owner' | 'visibility' | null>(null);
  popoverPosition = signal<{ top: number; left: number } | null>(null);

  readonly phases = PHASES;
  readonly clusters = computed(() => this.clusterService.clusters().filter(c => !!c.id));

  readonly nameError = computed(() => {
    const value = this.name();
    if (!value) return null;
    if (value.length > 100) return 'Maximum 100 characters.';
    if (!NAME_PATTERN.test(value)) return 'Only letters, numbers, dots, dashes, and underscores.';
    return null;
  });

  readonly canSubmit = computed(() => {
    if (this.isBusy()) return false;
    if (!this.name() || this.nameError()) return false;
    if (!this.selectedClusterId()) return false;
    if (!this.repositoryService.hasRepoScope()) return false;
    return true;
  });

  readonly isBusy = computed(() => {
    const s = this.currentStep();
    return s === 'creating-repo' || s === 'registering-repo' || s === 'creating-app' || s === 'generating-workflow';
  });

  readonly defaultOwnerPlaceholder = computed(() => {
    const status = this.repositoryService.oauth().get(GitProvider.GitHub);
    return status?.username || 'Your GitHub username';
  });

  ngOnInit(): void {
    void (async () => {
      // Pre-fill name from template framework
      this.name.set(`${this.template.framework}-app`.replaceAll(/[^a-zA-Z0-9._-]/g, '-'));
  
      // Make sure OAuth status is loaded so hasRepoScope is accurate
      if (!this.repositoryService.oauth().size) {
        try { await this.repositoryService.checkOAuthStatus(); } catch { /* non-fatal */ }
      }
  
      // Load clusters and auto-select if only one
      this.isLoadingClusters.set(true);
      try {
        if (this.clusterService.clusters().length === 0) {
          await this.clusterService.loadClusters();
        }
        const list = this.clusters();
        if (list.length === 1 && list[0].id) {
          this.selectedClusterId.set(list[0].id);
        }
      } finally {
        this.isLoadingClusters.set(false);
      }
    })();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only allow closing via backdrop when on the form step
    if (this.currentStep() === 'form' || this.currentStep() === 'error') {
      this.onClose();
    }
  }

  togglePopover(id: 'intro' | 'owner' | 'visibility', event: MouseEvent): void {
    event.stopPropagation();
    if (this.openPopover() === id) {
      this.closePopover();
      return;
    }
    // Find the icon trigger element — event.currentTarget on the click handler
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    this.popoverPosition.set({
      top: rect.bottom + 8,                // 8px gap below the icon
      left: rect.left + rect.width / 2,    // horizontally centered on the icon
    });
    this.openPopover.set(id);
  }

  closePopover(): void {
    this.openPopover.set(null);
    this.popoverPosition.set(null);
  }

  /**
   * Click on the modal card body (outside any popover) closes any open popover
   * but keeps the modal itself open. The popover container has its own
   * stopPropagation to keep clicks inside it from triggering this handler.
   */
  onCardClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.openPopover()) {
      this.closePopover();
    }
  }

  onClose(): void {
    if (this.isBusy()) return;
    this.closed.emit();
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    this.reusedExisting.set(false);
    this.cleanupDone.set(false);

    try {
      // Step 1: Create GitHub repo from template (idempotent — safe to retry)
      this.currentStep.set('creating-repo');
      const repo = await this.templateService.useTemplate(this.template.framework, {
        name: this.name(),
        owner: this.owner().trim() || undefined,
        'private': this.isPrivate(),
        description: this.template.description,
      });
      this.createdGithubRepoFullName.set(repo.fullName);
      if (repo.alreadyExisted) {
        this.reusedExisting.set(true);
      }

      // Step 2: Register the new repo with Flui (idempotent — `skipped` is success).
      // Per the API contract: success = `failed === 0` AND `repositories.length > 0`.
      // The `repositories[]` array now contains both newly imported AND already-imported
      // entries; `repositories[0].id` is always the Flui UUID we need.
      this.currentStep.set('registering-repo');
      const importResult = await this.repositoryService.importRepositories([repo.fullName], false);
      if (importResult.failed > 0 || !importResult.repositories?.length) {
        const errs = importResult.errors?.join(' ') ?? 'Unknown error';
        throw new Error(`Could not register repository with Flui: ${errs}`);
      }
      const importRef = importResult.repositories[0];
      const fluiRepoId = importRef.id;
      this.createdFluiRepoId.set(fluiRepoId);
      if (importRef.status === 'already_imported') {
        this.reusedExisting.set(true);
      }

      // Step 3: Create Flui application linked to the new repo
      this.currentStep.set('creating-app');
      const appName = this.name().toLowerCase().replaceAll(/[^a-z0-9-]/g, '-').replaceAll(/^-+|-+$/g, '');
      const appResponse = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(this.selectedClusterId(), {
          name: appName,
          category: CreateApplicationDto.CategoryEnum.User,
          sourceType: CreateApplicationDto.SourceTypeEnum.GitBuild,
          sourceConfig: {
            type: 'git_build',
            repositoryId: fluiRepoId,
            branch: repo.defaultBranch,
            framework: this.template.framework,
          },
          port: this.template.port,
          replicas: 1,
          resourceProfile: CreateApplicationDto.ResourceProfileEnum.Small,
          healthProbe: {
            type: 'http',
            httpPath: this.template.healthcheckPath,
            httpPort: this.template.port,
          },
          autoDeploy: false,
        } as any)
      );
      const appId = appResponse.application?.id;
      if (!appId) throw new Error('Application created but no ID was returned.');
      this.createdAppId.set(appId);

      // Step 4: Generate the V3 workflow (Dockerfile is already in the template)
      this.currentStep.set('generating-workflow');
      await this.applicationService.generateWorkflowV3(appId, {
        branch: repo.defaultBranch,
        isFluiManaged: true,
      });

      // Done
      this.currentStep.set('done');
      this.success.emit({ applicationId: appId });
    } catch (e: any) {
      this.currentStep.set('error');
      this.errorMessage.set(this.parseError(e));
    }
  }

  /** True when at least one resource was created during the failed attempt and is still around. */
  readonly hasResourcesToCleanup = computed(() =>
    !this.cleanupDone() && (
      !!this.createdAppId() ||
      !!this.createdFluiRepoId() ||
      !!this.createdGithubRepoFullName()
    )
  );

  /**
   * Walk back the orchestration in reverse order, deleting Flui-side resources.
   * The GitHub repository in step 1 is intentionally left alone — it lives in the
   * user's account and removing it from a recovery flow would be too destructive.
   * The user is shown a hint with the repo URL so they can delete it manually if
   * they want.
   */
  async cleanupCreatedResources(): Promise<void> {
    if (this.isCleaningUp()) return;
    this.isCleaningUp.set(true);
    this.errorMessage.set(null);

    const failures: string[] = [];

    // 1. Delete the Flui application (if any) — this also tears down K8s resources
    const appId = this.createdAppId();
    if (appId) {
      try {
        await this.applicationService.deleteApplication(appId);
        this.createdAppId.set(null);
      } catch (e: any) {
        failures.push(`application: ${e?.error?.message ?? e?.message ?? 'unknown error'}`);
      }
    }

    // 2. Disconnect the Flui repository entry (if any)
    const repoId = this.createdFluiRepoId();
    if (repoId) {
      try {
        await this.repositoryService.disconnectRepository(repoId);
        this.createdFluiRepoId.set(null);
      } catch (e: any) {
        failures.push(`repository: ${e?.error?.message ?? e?.message ?? 'unknown error'}`);
      }
    }

    this.isCleaningUp.set(false);

    if (failures.length === 0) {
      this.cleanupDone.set(true);
    } else {
      this.errorMessage.set(`Cleanup partially failed: ${failures.join('; ')}`);
    }
  }

  getGithubRepoUrl(): string {
    const fullName = this.createdGithubRepoFullName();
    return fullName ? `https://github.com/${fullName}` : '';
  }

  private parseError(e: any): string {
    const status = e?.status;
    const apiMsg = e?.error?.message ?? e?.message;
    if (status === 400 && /scope/i.test(apiMsg ?? '')) {
      return 'GitHub token is missing the "repo" scope. Please reconnect GitHub.';
    }
    if (status === 409) {
      // The template-create endpoint is idempotent, so a 409 only happens when a
      // repo with that name exists but was NOT created from this template.
      return 'A repository with that name already exists in your GitHub account but was not created from this template. Choose a different name.';
    }
    if (status === 403 || (status === 400 && /permission/i.test(apiMsg ?? ''))) {
      return `You don't have permission to create a repository under "${this.owner() || 'your account'}".`;
    }
    if (status === 404) {
      return 'Template not found. It may have been removed.';
    }
    return apiMsg || 'Something went wrong. Please try again.';
  }

  // ===== UI helpers =====

  getVisibilityButtonClass(privateBtn: boolean): string {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors';
    return this.isPrivate() === privateBtn
      ? `${base} border-primary bg-primary/10 text-foreground`
      : `${base} border-border text-muted-foreground hover:bg-accent`;
  }

  isPhaseDone(phaseId: OrchestrationPhase['id']): boolean {
    const order = PHASES.map(p => p.id);
    const currentIdx = order.indexOf(this.currentStep() as OrchestrationPhase['id']);
    const phaseIdx = order.indexOf(phaseId);
    if (this.currentStep() === 'done') return true;
    if (currentIdx === -1) return false;
    return phaseIdx < currentIdx;
  }

  isPhaseActive(phaseId: OrchestrationPhase['id']): boolean {
    return this.currentStep() === phaseId;
  }

  isPhasePending(phaseId: OrchestrationPhase['id']): boolean {
    return !this.isPhaseDone(phaseId) && !this.isPhaseActive(phaseId);
  }

  getPhaseIconClass(phaseId: OrchestrationPhase['id']): string {
    const base = 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border';
    if (this.isPhaseDone(phaseId)) {
      return `${base} bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300`;
    }
    if (this.isPhaseActive(phaseId)) {
      return `${base} bg-primary/10 border-primary text-primary`;
    }
    return `${base} border-border text-muted-foreground`;
  }
}
