import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { WizardStepperComponent, WizardStepperStep } from '../../../shared/components/wizard-stepper/wizard-stepper.component';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideLoader,
  lucideCloud,
  lucideGitBranch,
  lucidePackage,
  lucideKey,
  lucidePlay,
  lucideSettings,
  lucideServer,
  lucideFileCode,
  lucideX,
  lucidePlus,
  lucideTrash,
  lucideCircleAlert,
  lucideAlertCircle,
  lucideBox,
  lucideInfo,
  lucideTriangleAlert,
  lucideContainer,
  lucideGitMerge,
  lucideCpu,
  lucideCircleCheck,
  lucideCircleX,
  lucideChevronDown,
  lucideChevronUp,
  lucideGithub,
  lucideRocket,
  lucideStore,
  lucideDatabase,
  lucideSlidersHorizontal,
} from '@ng-icons/lucide';
import { RepositoryService, ConnectedRepository, RepositoryFluiManifest, RepositoryManifestEntry } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { TemplateService } from '../../service/template.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { ImagesService } from '../../../core/api/api/images.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { DockerImagePickerComponent } from './docker-image-picker.component';
import { EnvSuggestionsPanelComponent } from './env-suggestions-panel.component';
import { PublicRepoPickerComponent } from './public-repo-picker.component';
import { CatalogOverviewStepComponent } from './deploy-wizard-catalog-steps/catalog-overview-step.component';
import { CatalogInputsStepComponent } from './deploy-wizard-catalog-steps/catalog-inputs-step.component';
import { CatalogConfigStepComponent } from './deploy-wizard-catalog-steps/catalog-config-step.component';
import { CatalogDomainStepComponent } from './deploy-wizard-catalog-steps/catalog-domain-step.component';
import { CatalogFeaturesStepComponent, catalogAuthLabel } from './deploy-wizard-catalog-steps/catalog-features-step.component';
import { CatalogLinkedBbStepComponent } from './deploy-wizard-catalog-steps/catalog-linked-bb-step.component';
import { CatalogDependenciesStepComponent } from './deploy-wizard-catalog-steps/catalog-dependencies-step.component';
import { CatalogSuccessStepComponent } from './deploy-wizard-catalog-steps/catalog-success-step.component';
import { CatalogResourcesReviewComponent } from './deploy-wizard-catalog-steps/catalog-resources-review.component';
import { CatalogService } from '../../service/catalog.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import {
  EnvironmentVariable,
  ApplicationKind,
  ApplicationKindEnum,
  suggestKindFromImageRef,
} from '../../model/application.models';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import { ClusterInfo } from '../../model/cluster.models';
import { internalHostingErrorMessage } from '../../model/app-exposure';
import { AuthzInstallService } from '../../service/authz-install.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';

@Component({
  selector: 'app-deploy-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgIcon,
    WizardStepperComponent,
    DockerImagePickerComponent,
    EnvSuggestionsPanelComponent,
    PublicRepoPickerComponent,
    CatalogOverviewStepComponent,
    CatalogInputsStepComponent,
    CatalogConfigStepComponent,
    CatalogDomainStepComponent,
    CatalogFeaturesStepComponent,
    CatalogLinkedBbStepComponent,
    CatalogDependenciesStepComponent,
    CatalogSuccessStepComponent,
    CatalogResourcesReviewComponent,
  ],
  providers: [
    DeployWizardStateService,
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideLoader,
      lucideCloud,
      lucideGitBranch,
      lucidePackage,
      lucideKey,
      lucidePlay,
      lucideSettings,
      lucideServer,
      lucideFileCode,
      lucideX,
      lucidePlus,
      lucideTrash,
      lucideCircleAlert,
      lucideInfo,
      lucideTriangleAlert,
      lucideContainer,
      lucideGitMerge,
      lucideCpu,
      lucideCircleCheck,
      lucideCircleX,
      lucideChevronDown,
      lucideChevronUp,
      lucideAlertCircle,
      lucideBox,
      lucideGithub,
      lucideRocket,
      lucideStore,
      lucideDatabase,
      lucideSlidersHorizontal,
    }),
  ],
  template: `
    <div class="max-w-4xl mx-auto p-6">
      <!-- Back Button -->
      <div class="mb-6">
        <button
          (click)="navigateBack()"
          class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Back to Applications
        </button>
      </div>

      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold mb-2">Deploy New Application</h1>
        <p class="text-muted-foreground">
          Deploy your application in a few simple steps
        </p>

        <!-- Progress Steps -->
        <div class="mt-6">
          <app-wizard-stepper
            [steps]="steps()"
            [currentStepIndex]="currentStepIndex()"
            [allowStepClick]="false"
          />
        </div>
      </div>

      <!-- Step Content -->
      <div class="bg-card border border-border rounded-lg p-6 mb-6">
        @switch (currentStepId()) {
          <!-- Step: Source Type Selection -->
          @case ('source') {
            <div class="space-y-5">
              <div>
                <h3 class="text-base font-semibold mb-1">Choose how to deploy</h3>
                <p class="text-sm text-muted-foreground">Pick the starting point for your application.</p>
              </div>

              <!-- Four entry points, same level. Marketplace is a coming-soon placeholder. -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Flow B — Template (try-it-out demo) -->
                <button
                  type="button"
                  [class]="getFlowCardClass('template')"
                  (click)="selectFlow('template')"
                >
                  <ng-icon name="lucideRocket" class="h-8 w-8 mb-3 text-purple-500" />
                  <div class="font-medium mb-1">From a Flui template</div>
                  <p class="text-xs text-muted-foreground">
                    A ready-made framework starter (Next.js, Spring Boot, FastAPI…). Flui creates a new repo in your GitHub, wires up the build and deploys it — the fastest way to see an end-to-end deploy in action.
                  </p>
                  @if (flowSubtype() === 'template') {
                    <ng-icon name="lucideCheck" class="absolute top-3 right-3 h-4 w-4 text-primary" />
                  }
                </button>

                <!-- Flow A — Docker image -->
                <button
                  type="button"
                  [class]="getFlowCardClass('image')"
                  (click)="selectFlow('image')"
                >
                  <ng-icon name="lucideContainer" class="h-8 w-8 mb-3 text-blue-500" />
                  <div class="font-medium mb-1">From a Docker image</div>
                  <p class="text-xs text-muted-foreground">
                    Ship a pre-built image from DockerHub or GHCR. No source build step. If the image is not Flui-compliant you'll be asked to fill in the required variables and runtime settings during the next steps.
                  </p>
                  @if (flowSubtype() === 'image') {
                    <ng-icon name="lucideCheck" class="absolute top-3 right-3 h-4 w-4 text-primary" />
                  }
                </button>

                <!-- Flow C — Existing repo -->
                <button
                  type="button"
                  [class]="getFlowCardClass('existing-repo')"
                  (click)="selectFlow('existing-repo')"
                >
                  <ng-icon name="lucideGitMerge" class="h-8 w-8 mb-3 text-green-500" />
                  <div class="font-medium mb-1">From an existing repository</div>
                  <p class="text-xs text-muted-foreground">
                    Deploy from a Git repo you already have. Your repo must follow the Flui layout — a Flui-managed Dockerfile at the root is strongly recommended.
                  </p>
                  @if (flowSubtype() === 'existing-repo') {
                    <ng-icon name="lucideCheck" class="absolute top-3 right-3 h-4 w-4 text-primary" />
                  }
                </button>

                <!-- Flow D — Marketplace -->
                <button
                  type="button"
                  [class]="getFlowCardClass('marketplace')"
                  (click)="selectFlow('marketplace')"
                >
                  <ng-icon name="lucideStore" class="h-8 w-8 mb-3 text-amber-500" />
                  <div class="font-medium mb-1">From the Marketplace</div>
                  <p class="text-xs text-muted-foreground">
                    One-click install of pre-packaged apps curated by Flui (databases, CMS, analytics, queues…). No code, no Dockerfile — pick it and it runs.
                  </p>
                  @if (flowSubtype() === 'marketplace') {
                    <ng-icon name="lucideCheck" class="absolute top-3 right-3 h-4 w-4 text-primary" />
                  }
                </button>
              </div>

              <!-- Docker image: what happens during deploy -->
              @if (flowSubtype() === 'image') {
                <div class="flex items-start gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
                  <ng-icon name="lucideInfo" class="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div class="text-xs text-blue-900 dark:text-blue-100 space-y-2">
                    <p class="font-medium">What happens next</p>
                    <p>
                      Flui treats your image as an opaque artefact — it won't rebuild it or patch it. If the image is
                      <span class="font-medium">Flui-compliant</span> (exposes a single port, has a healthcheck endpoint,
                      runs as non-root) most of the deploy settings will be filled in automatically. Otherwise you'll be
                      asked to configure port, healthcheck, environment variables and resource limits by hand in the
                      next steps.
                    </p>
                    <p>
                      Want to see what a Flui-compliant image looks like? Every image published by
                      <button type="button" (click)="navigateToTemplates()" class="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 hover:underline font-medium">
                        a Flui template
                        <ng-icon name="lucideArrowRight" class="h-3 w-3" />
                      </button>
                      follows these conventions — use it as a reference.
                    </p>
                  </div>
                </div>
              }

              <!-- Structure requirements for the existing-repo flow -->
              @if (flowSubtype() === 'existing-repo') {
                <div class="flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                  <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div class="text-xs text-amber-900 dark:text-amber-100 space-y-2">
                    <p class="font-medium">Your repository must follow the Flui layout</p>
                    <p>
                      At minimum we expect a <code class="font-mono bg-amber-100/60 dark:bg-amber-900/40 px-1 rounded">Dockerfile</code> at the repo root.
                      For reliable builds, start its first line with <code class="font-mono bg-amber-100/60 dark:bg-amber-900/40 px-1 rounded"># flui-managed</code>
                      — that's the marker Flui uses to trust the Dockerfile's port, runtime and build steps. If the Dockerfile is missing
                      or doesn't match, the deploy will fail or you'll be asked to fill in port / healthcheck / resources by hand.
                    </p>
                    <p>
                      Not sure what Flui expects? The
                      <button type="button" (click)="navigateToTemplates()" class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:underline font-medium">
                        template catalog
                        <ng-icon name="lucideArrowRight" class="h-3 w-3" />
                      </button>
                      shows working examples for every supported framework — clone one and adapt your repo to match.
                    </p>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Step: Template Picker (Flow B) -->
          @case ('template-picker') {
            <div class="space-y-4">
              <div>
                <h3 class="text-base font-semibold mb-1">Choose a template</h3>
                <p class="text-sm text-muted-foreground">Each template ships a Flui-managed Dockerfile with sensible defaults — port, healthcheck, resources are pre-configured.</p>
              </div>
              @if (isLoadingTemplates()) {
                <div class="flex items-center justify-center py-10">
                  <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-primary" />
                  <span class="ml-2 text-sm text-muted-foreground">Loading templates...</span>
                </div>
              } @else if (templates().length === 0) {
                <p class="text-sm text-muted-foreground py-6 text-center">No templates available.</p>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  @for (tpl of templates(); track tpl.framework) {
                    <button
                      type="button"
                      (click)="selectTemplate(tpl)"
                      [class]="getTemplateCardClass(tpl.framework)"
                    >
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <ng-icon name="lucidePackage" class="h-5 w-5 text-muted-foreground" />
                          <div class="font-semibold text-sm">{{ tpl.displayName }} <span class="text-muted-foreground font-normal">{{ tpl.version }}</span></div>
                        </div>
                        @if (state.selectedTemplate()?.framework === tpl.framework) {
                          <ng-icon name="lucideCheck" class="h-4 w-4 text-primary shrink-0" />
                        }
                      </div>
                      <p class="text-xs text-muted-foreground line-clamp-2 mb-3">{{ tpl.description }}</p>
                      <div class="flex flex-wrap gap-1.5 text-[11px]">
                        <span class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Port {{ tpl.port }}</span>
                        <span class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{{ tpl.healthcheckPath }}</span>
                        <span class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ tpl.buildTool }}</span>
                      </div>
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Step: Template Settings (Flow B) -->
          @case ('template-settings') {
            <div class="space-y-5">
              <div>
                <h3 class="text-base font-semibold mb-1">New repository settings</h3>
                <p class="text-sm text-muted-foreground">Flui will create a new GitHub repository from the <span class="font-medium text-foreground">{{ state.selectedTemplate()?.displayName }}</span> template in your account.</p>
              </div>

              @if (!repoService.hasRepoScope()) {
                <div class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-sm">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div class="text-xs text-amber-900 dark:text-amber-100">
                    <p class="font-medium">GitHub connection required</p>
                    <p>Connect GitHub with the <code class="font-mono">repo</code> scope to create a new repository.</p>
                    <button type="button" (click)="navigateToRepositories()" class="mt-1 text-amber-700 dark:text-amber-300 hover:underline font-medium">Connect GitHub →</button>
                  </div>
                </div>
              }

              <!-- Repo name -->
              <div>
                <label class="text-sm font-medium block mb-1.5">Repository name <span class="text-destructive">*</span></label>
                <input
                  type="text"
                  [value]="state.newRepoName()"
                  (input)="state.newRepoName.set($any($event.target).value)"
                  placeholder="my-awesome-app"
                  class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                />
                @if (templateNameError()) {
                  <p class="text-xs text-destructive mt-1">{{ templateNameError() }}</p>
                }
              </div>

              <!-- Owner (optional) -->
              <div>
                <label class="text-sm font-medium block mb-1.5">Owner <span class="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  type="text"
                  [value]="state.newRepoOwner()"
                  (input)="state.newRepoOwner.set($any($event.target).value)"
                  placeholder="Your GitHub username or organization"
                  class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                />
                <p class="text-xs text-muted-foreground mt-1">Defaults to your personal GitHub account.</p>
              </div>

              <!-- Visibility -->
              <div>
                <label class="text-sm font-medium block mb-1.5">Visibility</label>
                <div class="flex gap-2">
                  <button type="button" (click)="state.newRepoPrivate.set(true)" [class]="getVisibilityButtonClass(true)">
                    <ng-icon name="lucideKey" class="h-3.5 w-3.5" /> Private
                  </button>
                  <button type="button" (click)="state.newRepoPrivate.set(false)" [class]="getVisibilityButtonClass(false)">
                    <ng-icon name="lucideGitBranch" class="h-3.5 w-3.5" /> Public
                  </button>
                </div>
              </div>

              <!-- Runtime defaults preview -->
              @if (state.selectedTemplate(); as tpl) {
                <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs">
                  <p class="font-medium text-foreground mb-1">Runtime defaults from this template</p>
                  <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                    <span>Framework:</span><span class="font-medium text-foreground">{{ tpl.displayName }} {{ tpl.version }}</span>
                    <span>Port:</span><span class="font-mono text-foreground">{{ tpl.port }}</span>
                    <span>Healthcheck:</span><span class="font-mono text-foreground">{{ tpl.healthcheckPath }}</span>
                    <span>Build tool:</span><span class="text-foreground">{{ tpl.buildTool }}</span>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Step: Docker Image Picker -->
          @case ('docker_image') {
            <div class="space-y-4">
              <div>
                <h3 class="text-base font-semibold mb-1">Select Docker Image</h3>
                <p class="text-sm text-muted-foreground">Search DockerHub for an image and select a tag.</p>
              </div>
              @if (selectedImageRef()) {
                <div class="flex items-center gap-3 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                  <ng-icon name="lucideCheck" class="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span class="text-sm font-mono font-medium">{{ selectedImageRef() }}</span>
                  <button type="button" class="ml-auto text-xs text-muted-foreground hover:text-foreground" (click)="clearImageRef()">Change</button>
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium">Application kind</label>
                  <p class="text-xs text-muted-foreground">
                    Determines which menu group this app appears under. Auto-suggested from the image name.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (opt of kindOptions; track opt.value) {
                      <button
                        type="button"
                        (click)="setKind(opt.value)"
                        [class]="
                          selectedKind() === opt.value
                            ? 'rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                            : 'rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary'
                        "
                      >
                        {{ opt.label }}
                      </button>
                    }
                  </div>
                </div>
              }
              @if (!selectedImageRef()) {
                <app-docker-image-picker (imageSelected)="onImageSelected($event)" />
              }
            </div>
          }

          <!-- Step 1: Repository Selection -->
          @case ('repository') {
            <div class="space-y-4">
              <!-- Tab switcher -->
              <div class="flex border-b border-border">
                <button
                  (click)="repoTab.set('mine')"
                  [class]="getRepoTabClass('mine')"
                >My Repositories</button>
                <button
                  (click)="repoTab.set('public')"
                  [class]="getRepoTabClass('public')"
                >Public Repositories</button>
              </div>

              <!-- My Repositories tab -->
              @if (repoTab() === 'mine') {
                @if (isLoadingRepos()) {
                  <div class="flex items-center justify-center py-8">
                    <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-primary" />
                    <span class="ml-2 text-sm text-muted-foreground">Loading repositories...</span>
                  </div>
                } @else if (connectedRepos().length === 0) {
                  <div class="text-center py-8">
                    <ng-icon name="lucideGitBranch" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 class="font-medium mb-2">No repositories connected</h3>
                    <p class="text-sm text-muted-foreground mb-4">
                      Connect a Git repository to get started
                    </p>
                    <button
                      (click)="navigateToRepositories()"
                      class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Connect Repository
                    </button>
                  </div>
                } @else {
                  <div class="space-y-4">
                    <label class="text-sm font-medium block">
                      Select Repository <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-1 gap-3">
                      @for (repo of connectedRepos(); track repo.id) {
                        <div
                          [class]="getRepoCardClass(repo.id)"
                          (click)="selectRepository(repo)"
                        >
                          <div class="flex items-start justify-between">
                            <div class="flex-1">
                              <div class="flex items-center gap-2">
                                <h4 class="font-medium">{{ repo.name }}</h4>
                                @if (repo.private) {
                                  <span class="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-1 rounded">
                                    Private
                                  </span>
                                }
                              </div>
                              <p class="text-sm text-muted-foreground mt-1">{{ repo.fullName }}</p>
                              @if (repo.lastCommit) {
                                <p class="text-xs text-muted-foreground mt-2">
                                  Last commit: {{ repo.lastCommit.message }}
                                </p>
                              }
                            </div>
                            @if (selectedRepo()?.id === repo.id) {
                              <ng-icon name="lucideCheck" class="h-5 w-5 text-primary mt-1" />
                            }
                          </div>
                        </div>
                      }
                    </div>
                    <p class="text-sm text-muted-foreground mt-2">
                      Don't see your repos?
                      <button
                        (click)="navigateToRepositories()"
                        class="text-primary hover:underline font-medium"
                      >Import them here</button>
                    </p>
                  </div>
                }
              }

              <!-- Public Repositories tab -->
              @if (repoTab() === 'public') {
                <div class="space-y-3">
                  @if (selectedPublicRepo()) {
                    <div class="flex items-center gap-3 p-3 rounded-md border border-primary bg-primary/5 text-sm">
                      <ng-icon name="lucideCheck" class="h-4 w-4 text-primary shrink-0" />
                      <span class="font-medium">{{ selectedPublicRepo()!.full_name }}</span>
                      <button (click)="clearPublicRepo()" class="ml-auto text-muted-foreground hover:text-foreground text-xs">Change</button>
                    </div>
                  }
                  <app-public-repo-picker (repoSelected)="onPublicRepoSelected($event)" />
                </div>
              }
            </div>
          }

          <!-- Step: Analysis (Flow C only — flui.yaml manifest check, manifest-first) -->
          @case ('analysis') {
            <div class="space-y-4">
              @switch (analysisBranch()) {
                @case ('loading') {
                  <div class="flex items-center justify-center py-10">
                    <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-primary" />
                    <span class="ml-2 text-sm text-muted-foreground">Looking for flui.yaml...</span>
                  </div>
                }

                @case ('flui-ready') {
                  @let m = manifestForSelector()!.manifest!;
                  <div class="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 space-y-3">
                    <div class="flex items-start gap-3">
                      <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      <div>
                        @if (validManifests().length > 1) {
                          <p class="text-sm font-semibold text-green-800 dark:text-green-300">{{ validManifests().length }} deployable apps found</p>
                          <p class="text-xs text-green-700 dark:text-green-400 mt-1">
                            This repository is a monorepo with one <span class="font-mono">flui.yaml</span> per app. Pick the one to deploy — each app deploys independently (run the wizard again for the others).
                          </p>
                        } @else {
                          <p class="text-sm font-semibold text-green-800 dark:text-green-300">flui.yaml found</p>
                          <p class="text-xs text-green-700 dark:text-green-400 mt-1">
                            This repository ships a valid Flui manifest. Port, healthcheck and resources come from the manifest and the repository is built as-is — exactly like <code class="font-mono bg-green-100/60 dark:bg-green-900/20 px-1 rounded">flui deploy</code>.
                          </p>
                        }
                      </div>
                    </div>

                    @if (validManifests().length > 1) {
                      <div class="space-y-1.5">
                        @for (entry of validManifests(); track entry.path) {
                          <button type="button" (click)="selectManifest(entry.path)"
                            class="w-full flex items-center gap-3 p-2.5 rounded-md border text-left transition-colors"
                            [class]="selectedManifestPath() === entry.path
                              ? 'border-green-500 dark:border-green-600 bg-green-100/70 dark:bg-green-900/30'
                              : 'border-green-200/70 dark:border-green-800/60 hover:bg-green-100/40 dark:hover:bg-green-900/20'">
                            <span class="h-2 w-2 rounded-full shrink-0"
                              [class]="selectedManifestPath() === entry.path ? 'bg-green-600 dark:bg-green-400' : 'bg-green-300 dark:bg-green-800'"></span>
                            <span class="font-mono text-xs font-semibold">{{ entry.name }}</span>
                            <span class="font-mono text-[11px] text-muted-foreground">{{ entry.path }}</span>
                            <span class="ml-auto font-mono text-[11px] text-muted-foreground">port {{ entry.port }}</span>
                          </button>
                        }
                      </div>
                    }

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-1">
                      <div class="p-2 rounded bg-green-100/60 dark:bg-green-900/20">
                        <div class="text-muted-foreground">App name</div>
                        <div class="font-mono font-medium">{{ m.metadata.name }}</div>
                      </div>
                      <div class="p-2 rounded bg-green-100/60 dark:bg-green-900/20">
                        <div class="text-muted-foreground">Port</div>
                        <div class="font-mono font-medium">{{ m.deploy.port }}</div>
                      </div>
                      @if (m.deploy.healthcheck?.path) {
                        <div class="p-2 rounded bg-green-100/60 dark:bg-green-900/20">
                          <div class="text-muted-foreground">Healthcheck</div>
                          <div class="font-mono font-medium">{{ m.deploy.healthcheck!.path }}</div>
                        </div>
                      }
                      @if (m.deploy.env?.length) {
                        <div class="p-2 rounded bg-green-100/60 dark:bg-green-900/20">
                          <div class="text-muted-foreground">Env vars</div>
                          <div class="font-medium">{{ m.deploy.env!.length }} declared</div>
                        </div>
                      }
                    </div>

                    @if (invalidManifests().length > 0) {
                      <p class="text-[11px] text-amber-700 dark:text-amber-400">
                        Skipped (not valid kind: Application):
                        @for (bad of invalidManifests(); track bad.path) {
                          <span class="font-mono">{{ bad.path }}</span>{{ !$last ? ', ' : '' }}
                        }
                      </p>
                    }
                  </div>
                }

                @case ('manifest-invalid') {
                  <div class="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-3">
                    <div class="flex items-start gap-3">
                      <ng-icon name="lucideAlertCircle" class="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p class="text-sm font-semibold text-red-800 dark:text-red-300">Invalid flui.yaml</p>
                        <p class="text-xs text-red-700 dark:text-red-400 mt-1">
                          Branch <span class="font-mono">{{ selectedBranch() }}</span> has {{ invalidManifests().length === 1 ? 'a flui.yaml, but it is' : 'flui.yaml manifests, but none are' }} valid <span class="font-mono">kind: Application</span> {{ invalidManifests().length === 1 ? 'manifest' : 'manifests' }}:
                        </p>
                        @for (bad of invalidManifests(); track bad.path) {
                          <p class="text-xs font-mono mt-2 p-2 rounded bg-red-100/60 dark:bg-red-900/20 text-red-800 dark:text-red-300"><span class="font-semibold">{{ bad.path }}</span> — {{ bad.validationError }}</p>
                        }
                        <p class="text-xs text-red-700 dark:text-red-400 mt-2">
                          Fix the manifest, push it, then retry. See the
                          <a href="https://docs.flui.cloud/cli/deploy/" target="_blank" rel="noopener" class="underline font-medium">manifest reference</a>.
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2">
                      <button type="button" (click)="triggerManifestCheck()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        <ng-icon name="lucideLoader" class="h-3.5 w-3.5" /> Retry
                      </button>
                    </div>
                  </div>
                }

                @case ('no-manifest') {
                  <div class="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 space-y-3">
                    <div class="flex items-start gap-3">
                      <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div class="space-y-2">
                        <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">No flui.yaml found</p>
                        <p class="text-xs text-amber-700 dark:text-amber-300">
                          Flui deploys repositories from a <span class="font-mono">flui.yaml</span> manifest, and branch <span class="font-mono">{{ selectedBranch() }}</span> doesn't have one — neither at the repository root nor in a subdirectory (monorepo).
                        </p>
                        <p class="text-xs text-amber-700 dark:text-amber-300">To make this repository deployable, scaffold the deploy files with the Flui CLI:</p>
                        <ol class="text-xs text-amber-800 dark:text-amber-200 list-decimal list-inside space-y-1">
                          <li>In your project directory run <code class="font-mono bg-amber-100/70 dark:bg-amber-900/40 px-1 rounded">flui app init &lt;framework&gt;</code> — it adds a <span class="font-mono">flui.yaml</span> and a production-ready Dockerfile (<code class="font-mono bg-amber-100/70 dark:bg-amber-900/40 px-1 rounded">flui app init --list</code> shows the supported frameworks). In a monorepo, run it once per app with <code class="font-mono bg-amber-100/70 dark:bg-amber-900/40 px-1 rounded">--target ./&lt;dir&gt;</code>.</li>
                          <li>Review the generated <span class="font-mono">flui.yaml</span> (app name, port, healthcheck, env).</li>
                          <li>Commit, push to <span class="font-mono">{{ selectedBranch() }}</span>, then come back here and retry.</li>
                        </ol>
                        <p class="text-xs text-amber-700 dark:text-amber-300">
                          Full guide:
                          <a href="https://docs.flui.cloud/cli/applications/#project-setup" target="_blank" rel="noopener" class="underline font-medium">docs.flui.cloud — flui app init</a>
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2">
                      <button type="button" (click)="triggerManifestCheck()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        <ng-icon name="lucideLoader" class="h-3.5 w-3.5" /> Retry
                      </button>
                      <a href="https://docs.flui.cloud/cli/applications/#project-setup" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
                        Read the docs
                      </a>
                    </div>
                  </div>
                }

                @case ('check-failed') {
                  <div class="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 space-y-3">
                    <div class="flex items-start gap-3">
                      <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">Could not read flui.yaml</p>
                        <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">{{ manifestFetchError() }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2">
                      <button type="button" (click)="triggerManifestCheck()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        <ng-icon name="lucideLoader" class="h-3.5 w-3.5" /> Retry
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          }

          <!-- Step: Generate (Flow B/C/D — orchestration progress) -->
          @case ('generate') {
            <div class="space-y-5">
              @if (flowSubtype() === 'marketplace') {
                @let iPhase = state.installPhase();
                @if (iPhase === 'idle') {
                  <div class="text-center py-6">
                    <p class="text-sm text-muted-foreground mb-4">
                      Ready to install <strong>{{ state.catalogDetail()?.name }}</strong>. Click <strong>Install</strong> to start.
                    </p>
                  </div>
                } @else if (iPhase === 'failed') {
                  <div class="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-2">
                    @if (state.currentInstall()) {
                      <p class="text-sm font-medium text-red-800 dark:text-red-300">Connect failed</p>
                      <p class="text-xs text-red-700 dark:text-red-400">{{ state.installError() }}</p>
                      <p class="text-xs text-muted-foreground">The app is installed but not connected. Retry the connection without reinstalling.</p>
                      <button type="button" (click)="retryMarketplaceConnect()"
                        class="mt-2 inline-flex items-center px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent">
                        Retry connect
                      </button>
                    } @else {
                      <p class="text-sm font-medium text-red-800 dark:text-red-300">Install failed</p>
                      <p class="text-xs text-red-700 dark:text-red-400">{{ state.installError() }}</p>
                      <button type="button" (click)="deployApplication()"
                        class="mt-2 inline-flex items-center px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent">
                        Retry
                      </button>
                    }
                  </div>
                } @else if (iPhase === 'running') {
                  <app-catalog-success-step />
                } @else {
                  @let progress = catalog.installProgress();
                  <div class="space-y-4">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">{{ progress?.stepLabel ?? 'Starting install…' }}</span>
                      <span class="text-muted-foreground">{{ progress?.overallProgress ?? 0 }}%</span>
                    </div>
                    <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        class="h-full bg-primary transition-all duration-500"
                        [style.width.%]="progress?.overallProgress ?? 0"
                      ></div>
                    </div>
                    @if (progress?.totalSteps) {
                      <p class="text-xs text-muted-foreground">
                        Step {{ (progress?.stepIndex ?? 0) + 1 }} of {{ progress?.totalSteps }}
                      </p>
                    }
                  </div>
                }
              } @else {
                @let phase = state.orchestrationPhase();
                @if (phase === 'idle') {
                  <div class="text-center py-6">
                    <p class="text-sm text-muted-foreground mb-4">Ready to deploy. Click <strong>Deploy Application</strong> to start.</p>
                  </div>
                } @else if (phase === 'error') {
                  <div class="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-2">
                    <p class="text-sm font-medium text-red-800 dark:text-red-300">Deployment failed</p>
                    <p class="text-xs text-red-700 dark:text-red-400">{{ state.orchestrationError() }}</p>
                    <button type="button" (click)="deployApplication()"
                      class="mt-2 inline-flex items-center px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent">
                      Retry
                    </button>
                  </div>
                } @else {
                  <div class="space-y-3">
                    @for (step of orchestrationSteps(); track step.id) {
                      <div class="flex items-center gap-3 text-sm">
                        <div [class]="getOrchestrationStepClass(step.id)">
                          @if (isOrchestrationStepDone(step.id)) {
                            <ng-icon name="lucideCheck" class="h-3.5 w-3.5" />
                          } @else if (isOrchestrationStepActive(step.id)) {
                            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                          }
                        </div>
                        <span [class]="isOrchestrationStepPending(step.id) ? 'text-muted-foreground' : 'text-foreground'">{{ step.label }}</span>
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }

          <!-- Step: Configuration & Environment -->
          @case ('environment') {
            <div class="space-y-6">

              <!-- Flow C (existing repo) — Branch selector + replicas -->
              @if (flowSubtype() === 'existing-repo') {
                <!-- Branch Selection -->
                <div>
                  <label class="text-sm font-medium block mb-2">
                    Branch <span class="text-red-500">*</span>
                  </label>
                  @if (isLoadingBranches()) {
                    <div class="flex h-10 items-center justify-start px-3 border border-input rounded-md bg-background">
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-primary mr-2" />
                      <span class="text-sm text-muted-foreground">Loading branches...</span>
                    </div>
                  } @else {
                    <select
                      [value]="selectedBranch()"
                      (change)="selectBranch($any($event.target).value)"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      @for (branch of availableBranches(); track branch) {
                        <option [value]="branch">{{ branch }}</option>
                      }
                    </select>
                  }
                  <p class="text-xs text-muted-foreground mt-1">
                    Framework and runtime come from the Dockerfile in your repository.
                  </p>
                </div>

                <!-- Replicas only — port comes from the Dockerfile -->
                <div>
                  <h3 class="text-base font-semibold mb-3">Deployment Settings</h3>
                  <div class="max-w-xs">
                    <label class="text-sm font-medium block mb-1.5">Replicas</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      [value]="appReplicas()"
                      (input)="appReplicas.set(+$any($event.target).value)"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p class="text-xs text-muted-foreground mt-1">Number of pod replicas</p>
                  </div>
                  <p class="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                    <ng-icon name="lucideInfo" class="h-3.5 w-3.5 shrink-0" />
                    Port is read from your Dockerfile (<code class="font-mono">EXPOSE</code>).
                  </p>
                </div>
              }

              <!-- Flow B (template) — intro message, no branch selector -->
              @if (flowSubtype() === 'template') {
                <div class="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/30">
                  <ng-icon name="lucideInfo" class="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div class="text-xs text-muted-foreground space-y-1">
                    <p>
                      Flui will commit the build workflow to the <span class="font-medium text-foreground">default branch</span> of the new repository
                      <span class="font-mono text-foreground">{{ state.newRepoOwner() || '(your account)' }}/{{ state.newRepoName() }}</span>.
                    </p>
                    <p>
                      Set any environment variables the template needs below — they will be injected into the build and the running container.
                      You can always add or change them later from the application settings.
                    </p>
                  </div>
                </div>
              }

              <!-- Docker-image only: Port, Replicas, Resource Profile -->
              @if (sourceType() === 'docker_image') {
                <!-- Port & Replicas -->
                <div>
                  <h3 class="text-base font-semibold mb-3">Deployment Settings</h3>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <div class="flex items-center gap-2 mb-1.5">
                        <label class="text-sm font-medium">Port</label>
                        @if (portDiscovering()) {
                          <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                            Detecting...
                          </span>
                        } @else if (portAutoDetected() && appPort()) {
                          <span class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <ng-icon name="lucideCircleCheck" class="h-3 w-3" />
                            Auto-detected
                          </span>
                        }
                      </div>
                      @if (exposedPorts().length > 1) {
                        <!-- Multiple ports: show dropdown -->
                        <select
                          [value]="appPort()"
                          (change)="appPort.set(+$any($event.target).value); portAutoDetected.set(false)"
                          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          @for (p of exposedPorts(); track p) {
                            <option [value]="p">{{ p }}</option>
                          }
                        </select>
                        <p class="text-xs text-muted-foreground mt-1">{{ exposedPorts().length }} ports found in the image</p>
                      } @else {
                        <input
                          type="number"
                          min="1"
                          max="65535"
                          [value]="appPort() ?? ''"
                          placeholder="e.g. 80, 3000, 8080"
                          (input)="appPort.set(+$any($event.target).value || null); portAutoDetected.set(false)"
                          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                          @if (!appPort() && !portDiscovering()) { Enter the port the container listens on }
                        </p>
                      }
                    </div>
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Replicas</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        [value]="appReplicas()"
                        (input)="appReplicas.set(+$any($event.target).value)"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <p class="text-xs text-muted-foreground mt-1">Number of pod replicas</p>
                    </div>
                  </div>
                </div>

                <!-- Resource Profile -->
                <div>
                  <h3 class="text-base font-semibold mb-1">Resource Profile</h3>
                  <p class="text-sm text-muted-foreground mb-3">Choose CPU and memory allocation for the container</p>

                  @if (loadingProfiles()) {
                    <div class="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                      <span>Loading profiles...</span>
                    </div>
                  } @else if (availableProfiles().length > 0) {
                    <div class="grid grid-cols-5 gap-2">
                      @for (profile of availableProfiles(); track profile.name) {
                        <button
                          type="button"
                          [class]="getProfileCardClass(profile.name)"
                          (click)="selectedProfile.set(profile.name)"
                        >
                          <div class="text-sm font-semibold mb-1.5">{{ getProfileLabel(profile.name) }}</div>
                          <div class="flex items-center gap-1 text-xs text-muted-foreground">
                            <ng-icon name="lucideCpu" class="w-3 h-3 shrink-0" />
                            <span>{{ getProfileCpu(profile) }} CPU</span>
                          </div>
                          <div class="text-xs text-muted-foreground mt-0.5">
                            {{ getProfileMemory(profile) }} <span class="text-muted-foreground/60">RAM</span>
                          </div>
                        </button>
                      }
                    </div>
                    @if (selectedProfileInfo()) {
                      <p class="text-xs text-muted-foreground mt-2 pl-1">{{ getProfileDescription(selectedProfile()) }}</p>
                    }
                    <p class="text-xs text-muted-foreground mt-3">
                      You can adjust resource limits at any time from the application settings after deployment.
                    </p>
                  }
                </div>

                <!-- Availability Check (collapsed by default) -->
                <div class="border border-border rounded-lg overflow-hidden">
                  <!-- Header — always visible, clickable -->
                  <button
                    type="button"
                    (click)="probeExpanded.set(!probeExpanded())"
                    class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <span class="text-sm font-medium">Availability Check</span>
                      <span class="ml-2 text-xs text-muted-foreground">
                        @if (probeType() === 'none') { Disabled }
                        @if (probeType() === 'http') { Web request · {{ probeHttpPath() }} :{{ appPort() }} }
                        @if (probeType() === 'tcp') { Port check · :{{ appPort() }} }
                      </span>
                    </div>
                    <ng-icon
                      [name]="probeExpanded() ? 'lucideChevronUp' : 'lucideChevronDown'"
                      class="h-4 w-4 text-muted-foreground shrink-0"
                    />
                  </button>

                  <!-- Expanded content -->
                  @if (probeExpanded()) {
                    <div class="px-4 pb-4 pt-1 border-t border-border space-y-4">
                      <p class="text-xs text-muted-foreground pt-2">
                        Flui can periodically check that your application is responding correctly.
                        If a check fails repeatedly, the instance is removed from traffic until it recovers.
                        You can always configure this later from the application settings.
                      </p>

                      <div>
                        <label class="text-sm font-medium block mb-1.5">Check method</label>
                        <select
                          [value]="probeType()"
                          (change)="probeType.set($any($event.target).value)"
                          class="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="none">Disabled — skip availability checks</option>
                          <option value="http">Web request — check a URL returns a successful response</option>
                          <option value="tcp">Port check — verify the application port is accepting connections</option>
                        </select>
                      </div>

                      @if (probeType() === 'http') {
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label class="text-sm font-medium block mb-1.5">URL path</label>
                            <input
                              type="text"
                              [value]="probeHttpPath()"
                              (input)="probeHttpPath.set($any($event.target).value)"
                              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label class="text-sm font-medium block mb-1.5">Startup grace period</label>
                            <div class="relative">
                              <input type="number" min="0" [value]="probeInitialDelay()" (input)="probeInitialDelay.set(+$any($event.target).value)"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-8" />
                              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">s</span>
                            </div>
                            <p class="text-xs text-muted-foreground mt-1">Wait before first check</p>
                          </div>
                          <div>
                            <label class="text-sm font-medium block mb-1.5">Check every</label>
                            <div class="relative">
                              <input type="number" min="1" [value]="probePeriod()" (input)="probePeriod.set(+$any($event.target).value)"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-8" />
                              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">s</span>
                            </div>
                          </div>
                          <div>
                            <label class="text-sm font-medium block mb-1.5">Mark unavailable after</label>
                            <div class="relative">
                              <input type="number" min="1" [value]="probeFailureThreshold()" (input)="probeFailureThreshold.set(+$any($event.target).value)"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-16" />
                              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">failures</span>
                            </div>
                          </div>
                        </div>
                        <p class="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                          Flui will request <span class="font-mono">{{ probeHttpPath() }}</span> on port {{ appPort() }} every {{ probePeriod() }}s.
                          The app has {{ probeInitialDelay() }}s to start up before checks begin.
                        </p>
                      }

                      @if (probeType() === 'tcp') {
                        <div class="max-w-xs">
                          <label class="text-sm font-medium block mb-1.5">Startup grace period</label>
                          <div class="relative">
                            <input type="number" min="0" [value]="probeInitialDelay()" (input)="probeInitialDelay.set(+$any($event.target).value)"
                              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-8" />
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">s</span>
                          </div>
                          <p class="text-xs text-muted-foreground mt-3 bg-muted/40 rounded px-3 py-2">
                            Flui will verify that port {{ appPort() }} is accepting connections. Suitable when the app doesn't expose an HTTP endpoint.
                          </p>
                        </div>
                      }
                    </div>
                  }
                </div>

                <hr class="border-border" />
                <h3 class="text-base font-semibold -mb-3">Environment Variables</h3>
              }



              <!-- Env detection panel — only for existing-repo flow (analyzes the live repo) -->
              @if (flowSubtype() === 'existing-repo') {
                <app-env-suggestions-panel
                  [loading]="envDetectionLoading()"
                  [result]="envDetectionResult()"
                  [error]="envDetectionError()"
                  [selectedIndex]="selectedCandidateIndex()"
                  (cancelDetection)="cancelEnvDetection()"
                  (candidateSelected)="applyDetectedVars($event)"
                  (reanalyze)="analyzeAndSuggestEnvVars()"
                />
              }

              <!-- Warning: auto-filled values not yet reviewed -->
              @if (hasUnreviewedDefaults()) {
                <div class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Some values were auto-filled from the repository file. Review them before deploying — they may be placeholders or development defaults.</span>
                </div>
              }

              <!-- Mode Toggle -->
              <div class="flex items-center gap-4">
                <button
                  [class]="envMode() === 'key-value' ? 'text-sm font-medium text-primary' : 'text-sm text-muted-foreground hover:text-foreground'"
                  (click)="setEnvMode('key-value')"
                >
                  Key-Value Editor
                </button>
                <button
                  [class]="envMode() === 'json' ? 'text-sm font-medium text-primary' : 'text-sm text-muted-foreground hover:text-foreground'"
                  (click)="setEnvMode('json')"
                >
                  Raw JSON
                </button>
              </div>

              @if (envMode() === 'key-value') {
                <!-- Key-Value Editor -->
                <div class="space-y-3">
                  @for (envVar of envVars(); track $index; let i = $index) {
                    @let meta = getDetectedMeta(envVar.key);
                    <div class="space-y-1">
                      <div class="flex items-start gap-2">
                        <input
                          type="text"
                          [value]="envVar.key"
                          (input)="updateEnvKey(i, $any($event.target).value)"
                          placeholder="KEY_NAME"
                          class="flex h-10 w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        />
                        <div class="flex flex-col flex-1 gap-1">
                          <input
                            [type]="envVar.isSecret ? 'password' : 'text'"
                            [value]="envVar.value"
                            (input)="updateEnvValue(i, $any($event.target).value)"
                            [placeholder]="meta?.description ?? 'value'"
                            [title]="meta?.description ?? ''"
                            [class]="isDefaultValue(envVar)
                              ? 'flex h-10 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-sm'
                              : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'"
                          />
                        </div>
                        @if (isDefaultValue(envVar)) {
                          <span class="shrink-0 self-center text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Default</span>
                        } @else if (meta) {
                          @if (meta.optional === false) {
                            <span class="shrink-0 self-center text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium">Required</span>
                          } @else if (meta.optional === true) {
                            <span class="shrink-0 self-center text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Optional</span>
                          }
                        }
                        <button
                          (click)="toggleEnvSecret(i)"
                          [class]="envVar.isSecret ? 'p-2 rounded-md border border-primary bg-primary/10 text-primary shrink-0' : 'p-2 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground shrink-0'"
                          title="Toggle secret"
                        >
                          <ng-icon name="lucideKey" class="h-5 w-5" />
                        </button>
                        <button
                          (click)="removeEnvVar(i)"
                          class="p-2 rounded-md border border-input bg-background text-muted-foreground hover:text-red-600 hover:border-red-300 shrink-0"
                          title="Remove"
                        >
                          <ng-icon name="lucideTrash" class="h-5 w-5" />
                        </button>
                      </div>
                      @if (meta?.description) {
                        <p class="text-xs text-muted-foreground pl-[calc(33%+0.5rem)]">{{ meta?.description }}</p>
                      }
                    </div>
                  }
                  <button
                    (click)="addEnvVar()"
                    class="inline-flex items-center text-sm text-primary hover:underline"
                  >
                    <ng-icon name="lucidePlus" class="h-4 w-4 mr-1" />
                    Add Variable
                  </button>
                </div>
              } @else {
                <!-- Raw JSON Editor -->
                <div>
                  <label class="text-sm font-medium block mb-2">JSON Configuration</label>
                  <textarea
                    [value]="rawEnvJson()"
                    (input)="updateRawEnvJson($any($event.target).value)"
                    placeholder='{\n  "API_URL": "https://api.example.com",\n  "NODE_ENV": "production"\n}'
                    class="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    rows="10"
                  ></textarea>
                  @if (jsonError()) {
                    <p class="text-sm text-red-500 mt-2">{{ jsonError() }}</p>
                  }
                </div>
              }

              <p class="text-xs text-muted-foreground">
                Environment variables are optional. You can add them now or configure them later.
              </p>
            </div>
          }

          <!-- Step: Cluster Selection -->
          @case ('cluster') {
            <div class="space-y-6">
              @if (isLoadingClusters()) {
                <div class="flex items-center justify-center py-8">
                  <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-primary" />
                  <span class="ml-2 text-sm text-muted-foreground">Loading clusters...</span>
                </div>
              } @else if (activeClusters().length === 0) {
                <div class="text-center py-8">
                  <ng-icon name="lucideServer" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 class="font-medium mb-2">No active clusters available</h3>
                  <p class="text-sm text-muted-foreground mb-4">
                    Create a cluster to deploy your application
                  </p>
                  <button
                    (click)="navigateToCluster()"
                    class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Create Cluster
                  </button>
                </div>
              } @else {
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    @for (cluster of activeClusters(); track cluster.id) {
                      <div
                        [class]="getClusterCardClass(cluster.id || '')"
                        (click)="selectCluster(cluster)"
                      >
                        <div class="flex items-start justify-between mb-3">
                          <div class="flex-1">
                            <h4 class="font-medium">{{ cluster.name }}</h4>
                            <p class="text-sm text-muted-foreground mt-1">
                              {{ cluster.provider }} • {{ cluster.region }}
                            </p>
                          </div>
                          @if (selectedCluster()?.id === cluster.id) {
                            <ng-icon name="lucideCheck" class="h-5 w-5 text-primary" />
                          }
                        </div>
                        <div class="space-y-1 text-xs">
                          <div class="flex items-center justify-between">
                            <span class="text-muted-foreground">Nodes:</span>
                            <span class="font-medium">{{ cluster.nodeCount || 0 }}</span>
                          </div>
                          <div class="flex items-center justify-between">
                            <span class="text-muted-foreground">Status:</span>
                            <span [class]="getStatusBadgeClass(cluster.status)">
                              {{ cluster.status }}
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Resource availability feedback -->
                  @if (selectedCluster() && flowSubtype() === 'marketplace') {
                    <!-- Marketplace: capacity check uses manifest resources + optional overrides. -->
                    <app-catalog-resources-review />
                  } @else if (selectedCluster()) {
                    @if (checkingAvailability()) {
                      <div class="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md border border-border">
                        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin shrink-0" />
                        <span>Checking resource availability...</span>
                      </div>
                    } @else if (resourceAvailability()) {
                      @let av = resourceAvailability()!;
                      @if (!av.canDeploy) {
                        <div class="flex items-start gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                          <ng-icon name="lucideCircleX" class="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <div class="flex-1 text-sm">
                            <p class="font-medium text-red-700 dark:text-red-300">Insufficient resources</p>
                            <p class="text-red-600 dark:text-red-400 mt-0.5">{{ getAvailabilityMessage() }}</p>
                            <div class="mt-2 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                              <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                              <span>Currently used:</span><span class="text-right">{{ av.used.cpu }} CPU · {{ av.used.memory }} RAM</span>
                              <span>Cluster total:</span><span class="text-right">{{ av.total.cpu }} CPU · {{ av.total.memory }} RAM</span>
                            </div>
                            <button type="button" class="mt-2 text-xs text-primary hover:underline" (click)="goToConfigStep()">
                              Choose a smaller profile →
                            </button>
                          </div>
                        </div>
                      } @else if (av.reason) {
                        <div class="flex items-start gap-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                          <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div class="text-sm flex-1">
                            <p class="font-medium text-amber-700 dark:text-amber-300">Resources tight</p>
                            <p class="text-amber-600 dark:text-amber-400 mt-0.5">{{ getAvailabilityMessage() }}</p>
                            <div class="mt-2 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                              <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                            </div>
                          </div>
                        </div>
                      } @else {
                        <div class="flex items-start gap-3 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                          <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                          <div class="text-sm flex-1">
                            <p class="font-medium text-green-700 dark:text-green-400">Sufficient resources</p>
                            <div class="mt-1 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                              <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                              <span>Currently used:</span><span class="text-right">{{ av.used.cpu }} CPU · {{ av.used.memory }} RAM</span>
                              <span>Cluster total:</span><span class="text-right">{{ av.total.cpu }} CPU · {{ av.total.memory }} RAM</span>
                            </div>
                            <p class="text-[11px] text-muted-foreground mt-1.5 italic">Flui keeps 10% of cluster capacity reserved as headroom.</p>
                          </div>
                        </div>
                      }
                    }
                  }

                  <!-- Exposure toggle — shown after a cluster is picked so capabilities are loaded.
                       For marketplace: only when privatizable === true (public, non-BB, manifest allows override).
                       For non-catalog flows: always shown so the user can pick public vs internal. -->
                  @if (selectedCluster() && flowSubtype() !== null && (
                    flowSubtype() !== 'marketplace' ||
                    (state.catalogDetail()?.exposure === 'public' &&
                     state.catalogDetail()?.appType !== 'building-block' &&
                     state.catalogDetail()?.privatizable !== false)
                  )) {
                    <div>
                      <h3 class="text-base font-semibold mb-3">Exposure</h3>
                      <div class="space-y-2">
                        <label
                          class="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors"
                          [class]="state.exposureMode() === 'public' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'"
                        >
                          <input
                            type="radio"
                            name="exposure-mode"
                            value="public"
                            [checked]="state.exposureMode() === 'public'"
                            (change)="state.exposureMode.set('public')"
                            class="mt-0.5"
                          />
                          <div class="flex-1">
                            <div class="text-sm font-medium text-foreground">Public</div>
                            <div class="text-xs text-muted-foreground">
                              Reachable from the internet via a custom domain with Ingress + TLS certificate.
                            </div>
                          </div>
                        </label>
                        @if (catalog.capabilitiesLoading()) {
                          <div class="flex items-center gap-2 p-3 rounded-md border border-border text-xs text-muted-foreground">
                            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin shrink-0" />
                            Checking cluster capabilities…
                          </div>
                        } @else if (state.canUseInternalExposure()) {
                          <label
                            class="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors"
                            [class]="state.exposureMode() === 'internal' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'"
                          >
                            <input
                              type="radio"
                              name="exposure-mode"
                              value="internal"
                              [checked]="state.exposureMode() === 'internal'"
                              (change)="state.exposureMode.set('internal')"
                              class="mt-0.5"
                            />
                            <div class="flex-1">
                              <div class="text-sm font-medium text-foreground">Internal</div>
                              <div class="text-xs text-muted-foreground">
                                Gets a private URL on your cluster's internal domain (e.g. app.internal.zone), protected by Flui authentication. Accessible from the internet — Flui login required.
                              </div>
                            </div>
                          </label>
                        } @else {
                          <div class="flex items-start gap-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
                            <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                            <div class="flex-1 space-y-2">
                              <div class="font-medium">Internal apps not available on this cluster</div>
                              <div class="text-xs">Missing: {{ internalHostingMissingLabel() }}.</div>
                              <div class="pt-1">
                                <button
                                  type="button"
                                  (click)="navigateToClusterDns()"
                                  class="text-xs underline hover:no-underline font-medium"
                                >Configure now →</button>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Marketplace: Overview + display name -->
          @case ('catalog-overview') {
            <app-catalog-overview-step />
          }

          <!-- Marketplace: User input prompts -->
          @case ('catalog-inputs') {
            <app-catalog-inputs-step />
          }

          <!-- Marketplace: Editable env overrides -->
          @case ('catalog-config') {
            <app-catalog-config-step />
          }

          <!-- Marketplace: auth mode + feature toggles -->
          @case ('catalog-features') {
            <app-catalog-features-step />
          }

          <!-- Marketplace: Domain choice -->
          @case ('catalog-domain') {
            <app-catalog-domain-step />
          }

          <!-- Marketplace: pick target building block instance -->
          @case ('catalog-linked-bb') {
            <app-catalog-linked-bb-step />
          }

          <!-- Marketplace: pick or auto-create dependencies (e.g. ferretdb → postgres) -->
          @case ('catalog-dependencies') {
            <app-catalog-dependencies-step />
          }

          <!-- Step: Review & Deploy -->
          @case ('review') {
            <div class="space-y-6">
              @if (canDeployReason(); as reason) {
                <div class="flex items-start gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 text-sm text-red-800 dark:text-red-300">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                  <div class="flex-1 space-y-2">
                    <div class="font-medium">Install blocked</div>
                    <div class="text-xs">{{ reason }}</div>
                    <div class="pt-1">
                      <button
                        type="button"
                        (click)="navigateToClusterDns()"
                        class="text-xs underline hover:no-underline font-medium"
                      >Configure now →</button>
                    </div>
                  </div>
                </div>
              }
              @if (authzNotReady()) {
                <div class="flex items-start gap-3 p-3 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                  <div class="flex-1 space-y-2">
                    <div class="font-medium">Auth Proxy not installed</div>
                    <div class="text-xs">This is a private app. Without Auth Proxy, access control falls back to a less reliable external mechanism. Install it on this cluster for faster, more resilient protection.</div>
                    <div class="pt-1 flex items-center gap-3">
                      @if (authzInstall.installing()) {
                        <span class="text-xs flex items-center gap-1">
                          <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                          Installing...
                        </span>
                      } @else {
                        <button type="button" (click)="installAuthProxy()" class="text-xs underline hover:no-underline font-medium">
                          Install now
                        </button>
                      }
                      <button type="button" (click)="navigateToAuthProxy()" class="text-xs text-amber-700 dark:text-amber-400 hover:underline">
                        Auth Proxy settings →
                      </button>
                    </div>
                    @if (authzInstall.error()) {
                      <div class="text-xs text-red-600 dark:text-red-400">{{ authzInstall.error() }}</div>
                    }
                  </div>
                </div>
              }
              @if ((deployError() || state.orchestrationError()); as err) {
                <div class="flex items-start gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 text-sm text-red-800 dark:text-red-300">
                  <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
                  <div class="flex-1">{{ err }}</div>
                </div>
              }
              <!-- Source info -->
              <div class="border border-border rounded-lg p-4">
                @if (sourceType() === 'docker_image') {
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideContainer" class="h-4 w-4 mr-2" />
                    Docker Image
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Image:</span>
                      <span class="font-mono font-medium">{{ selectedImageRef() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Pull Policy:</span>
                      <span class="font-medium">IfNotPresent</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Port:</span>
                      <span class="font-medium">{{ appPort() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Replicas:</span>
                      <span class="font-medium">{{ appReplicas() }}</span>
                    </div>
                    @if (selectedProfileInfo()) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Profile:</span>
                        <span class="font-medium">{{ getProfileLabel(selectedProfile()) }} — {{ getProfileCpu(selectedProfileInfo()!) }} CPU · {{ getProfileMemory(selectedProfileInfo()!) }} RAM</span>
                      </div>
                    }
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Health check:</span>
                      <span class="font-medium">
                        @if (probeType() === 'http') { HTTP GET {{ probeHttpPath() }} :{{ appPort() }} }
                        @if (probeType() === 'tcp') { TCP :{{ appPort() }} }
                        @if (probeType() === 'none') { Disabled }
                      </span>
                    </div>
                    @if (state.exposureMode() === 'internal') {
                      <div class="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                        <span class="font-medium text-foreground">Internal app.</span>
                        Gets a private URL on your cluster's internal domain, protected by Flui authentication.
                        Accessible from the internet — Flui login required to open.
                        @if (internalUrlPreview(); as url) {
                          <div class="mt-1 font-mono text-xs text-foreground/80 truncate">{{ url }}</div>
                        }
                      </div>
                    }
                  </div>
                } @else if (flowSubtype() === 'marketplace') {
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideStore" class="h-4 w-4 mr-2" />
                    Marketplace install
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">App:</span>
                      <span class="font-medium">
                        {{ state.catalogDetail()?.name }} v{{ state.catalogDetail()?.version }}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Display name:</span>
                      <span class="font-medium">{{ state.catalogDisplayName() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Category:</span>
                      <span class="font-medium capitalize">{{ state.catalogDetail()?.category }}</span>
                    </div>
                    @if (state.catalogHasAuthChoice() && catalogAuthModeLabel(); as authLabel) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Authentication:</span>
                        <span class="font-medium">{{ authLabel }}</span>
                      </div>
                    }
                    @if (state.catalogFeatureOptions().length > 0) {
                      <div class="flex justify-between gap-4">
                        <span class="text-muted-foreground">Features:</span>
                        <span class="font-medium text-right">
                          @if (enabledFeatureLabels().length > 0) {
                            {{ enabledFeatureLabels().join(', ') }}
                          } @else {
                            None
                          }
                        </span>
                      </div>
                    }
                    @if (state.linkedBbRefs().length > 0) {
                      <div class="mt-2 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/10 p-3 text-xs text-sky-900 dark:text-sky-200">
                        <div class="font-medium">
                          @if (state.selectedReusableInstance(); as sel) {
                            Linked to <span class="font-mono">{{ sel.catalogSlug || sel.displayName }}</span>:
                            <span class="font-mono">{{ sel.displayName }}</span>
                            <span class="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                              ({{ sel.status }})
                            </span>
                          } @else {
                            Compatible with {{ state.linkedBbRefs().join(' · ') }}
                          }
                        </div>
                        <div class="mt-1 opacity-80">
                          Credentials flow from the building block's internal Secret —
                          no password required from you.
                        </div>
                      </div>
                    }
                    @if (state.catalogDetail()?.exposesPublicEndpoint === false || isInternalDeploy()) {
                      @if (isInternalDeploy()) {
                        <div class="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                          <span class="font-medium text-foreground">Internal app.</span>
                          Gets a private URL on your cluster's internal domain, protected by Flui authentication.
                          Accessible from the internet — Flui login required to open.
                          @if (internalUrlPreview(); as url) {
                            <div class="mt-1 font-mono text-xs text-foreground/80 truncate">{{ url }}</div>
                          }
                        </div>
                      } @else {
                        <div class="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                          <span class="font-medium text-foreground">Internal service.</span>
                          This app runs cluster-internal and will not get a public URL.
                          Other apps in the same cluster reach it via its internal service DNS.
                        </div>
                      }
                    } @else {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Domain:</span>
                        <span class="font-medium">
                          @switch (state.domainMode()) {
                            @case ('auto') { Auto-assigned ({{ autoFqdnPreview() }}) }
                            @case ('custom') { {{ state.requestedDomain() }} }
                            @case ('skip') { Configure after install }
                          }
                        </span>
                      </div>
                      @if (state.domainMode() !== 'skip') {
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">TLS:</span>
                          <span class="font-medium">
                            {{ state.enableTls() ? 'HTTPS certificate' : 'HTTP only (no certificate)' }}
                          </span>
                        </div>
                      }
                    }
                  </div>
                  @if (state.allowMasterPlacementRelevant()) {
                    <div class="mt-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs space-y-2">
                      <div class="flex items-start gap-2">
                        <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div class="space-y-1">
                          <p class="font-medium text-amber-900 dark:text-amber-200">This cluster has no worker node</p>
                          <p class="text-amber-800/90 dark:text-amber-300/90">
                            {{ state.catalogDetail()?.name }} uses dedicated (node-local) storage, which normally runs on a worker node.
                            Allow it to run on the control-plane node instead, or add a worker with
                            <span class="font-mono">flui node add</span> and come back.
                          </p>
                        </div>
                      </div>
                      <label class="flex items-center gap-2 cursor-pointer select-none pl-6">
                        <input
                          type="checkbox"
                          [checked]="state.allowMasterPlacement()"
                          (change)="state.allowMasterPlacement.set($any($event.target).checked)"
                        />
                        <span class="font-medium text-amber-900 dark:text-amber-200">Run on the control-plane node</span>
                      </label>
                      @if (!state.allowMasterPlacement()) {
                        <p class="pl-6 text-amber-700 dark:text-amber-300/90">
                          Required to continue — without a worker node the install would fail. Untick only if you plan to add a worker first.
                        </p>
                      }
                    </div>
                  }
                } @else if (flowSubtype() === 'template') {
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideRocket" class="h-4 w-4 mr-2" />
                    Template deploy
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Template:</span>
                      <span class="font-medium">{{ state.selectedTemplate()?.displayName }} {{ state.selectedTemplate()?.version }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">New repository:</span>
                      <span class="font-medium font-mono text-xs">{{ state.newRepoOwner() || '(your account)' }}/{{ state.newRepoName() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Visibility:</span>
                      <span class="font-medium">{{ state.newRepoPrivate() ? 'Private' : 'Public' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Port:</span>
                      <span class="font-medium">{{ state.deployConfig().port }} <span class="ml-1 text-[10px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">from template</span></span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Healthcheck:</span>
                      <span class="font-medium font-mono text-xs">{{ state.deployConfig().healthcheckPath }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Resource profile:</span>
                      <span class="font-medium capitalize">{{ state.deployConfig().resourceProfile }}</span>
                    </div>
                    @if (state.exposureMode() === 'internal') {
                      <div class="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                        <span class="font-medium text-foreground">Internal app.</span>
                        Gets a private URL on your cluster's internal domain, protected by Flui authentication.
                        Accessible from the internet — Flui login required to open.
                        @if (internalUrlPreview(); as url) {
                          <div class="mt-1 font-mono text-xs text-foreground/80 truncate">{{ url }}</div>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideGitBranch" class="h-4 w-4 mr-2" />
                    Repository & Build
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Repository:</span>
                      <span class="font-medium">{{ selectedRepo()?.name ?? selectedPublicRepo()?.full_name }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Branch:</span>
                      <span class="font-medium">{{ selectedBranch() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Port:</span>
                      <span class="font-medium">
                        {{ state.deployConfig().port || '—' }}
                        @if (state.defaultsSource() === 'manifest') {
                          <span class="ml-1 text-[10px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">from flui.yaml</span>
                        } @else if (state.defaultsSource() === 'manual') {
                          <span class="ml-1 text-[10px] px-1 rounded bg-muted text-muted-foreground">manual</span>
                        }
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Healthcheck:</span>
                      <span class="font-medium font-mono text-xs">{{ state.deployConfig().healthcheckPath }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Resource profile:</span>
                      <span class="font-medium capitalize">{{ state.deployConfig().resourceProfile }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Replicas:</span>
                      <span class="font-medium">{{ state.deployConfig().minReplicas }}</span>
                    </div>
                    @if (state.manifestResult()?.valid) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">App name:</span>
                        <span class="font-medium font-mono text-xs">{{ state.manifestResult()!.manifest!.metadata.name }}</span>
                      </div>
                    } @else if (state.confirmedFramework()) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Framework:</span>
                        <span class="font-medium">{{ state.confirmedFramework() }}</span>
                      </div>
                    }
                    @if (state.exposureMode() === 'internal') {
                      <div class="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                        <span class="font-medium text-foreground">Internal app.</span>
                        Gets a private URL on your cluster's internal domain, protected by Flui authentication.
                        Accessible from the internet — Flui login required to open.
                        @if (internalUrlPreview(); as url) {
                          <div class="mt-1 font-mono text-xs text-foreground/80 truncate">{{ url }}</div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Marketplace: resource footprint + capacity check + overrides -->
              @if (flowSubtype() === 'marketplace') {
                <app-catalog-resources-review />
              }

              <!-- Environment -->
              @if (flowSubtype() === 'marketplace') {
                <div class="border border-border rounded-lg p-4">
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideKey" class="h-4 w-4 mr-2" />
                    App inputs
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">User inputs:</span>
                      <span class="font-medium">{{ getCatalogInputsCount() }} provided</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Environment overrides:</span>
                      <span class="font-medium">{{ getCatalogOverridesCount() }}</span>
                    </div>
                    @if (getCatalogSecretsCount() > 0) {
                      <div class="mt-2 text-xs text-muted-foreground">
                        Including {{ getCatalogSecretsCount() }} secret value(s)
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="border border-border rounded-lg p-4">
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideKey" class="h-4 w-4 mr-2" />
                    Environment
                  </h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Variables:</span>
                      <span class="font-medium">{{ getEnvVarsCount() }} configured</span>
                    </div>
                    @if (getEnvVarsCount() > 0) {
                      <div class="mt-2 text-xs text-muted-foreground">
                        Including {{ getSecretVarsCount() }} secret variable(s)
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Target Cluster -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3 flex items-center">
                  <ng-icon name="lucideServer" class="h-4 w-4 mr-2" />
                  Target Cluster
                </h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Cluster:</span>
                    <span class="font-medium">{{ selectedCluster()?.name }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Region:</span>
                    <span class="font-medium">{{ selectedCluster()?.region }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Nodes:</span>
                    <span class="font-medium">{{ selectedCluster()?.nodeCount }}</span>
                  </div>
                </div>
              </div>


              <!-- Runtime resource availability summary (all flows) -->
              @if (checkingAvailability()) {
                <div class="flex items-center gap-2 p-3 text-sm text-muted-foreground border border-border rounded-lg">
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin shrink-0" />
                  Checking cluster resource availability...
                </div>
              } @else if (resourceAvailability()) {
                @let av = resourceAvailability()!;
                @if (!av.canDeploy) {
                  <div class="flex items-start gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                    <ng-icon name="lucideCircleX" class="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div class="text-sm flex-1">
                      <p class="font-semibold text-red-700 dark:text-red-300">Deploy blocked — insufficient resources</p>
                      <p class="text-red-600 dark:text-red-400 mt-1">{{ getAvailabilityMessage() }}</p>
                      <div class="mt-2 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                        <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                        <span>Currently used:</span><span class="text-right">{{ av.used.cpu }} CPU · {{ av.used.memory }} RAM</span>
                        <span>Cluster total:</span><span class="text-right">{{ av.total.cpu }} CPU · {{ av.total.memory }} RAM</span>
                      </div>
                      <button type="button" class="mt-2 text-xs text-primary hover:underline" (click)="goToConfigStep()">
                        Go back and choose a smaller profile →
                      </button>
                    </div>
                  </div>
                } @else if (av.reason) {
                  <div class="flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                    <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div class="text-sm flex-1">
                      <p class="font-semibold text-amber-700 dark:text-amber-300">Resource notice</p>
                      <p class="text-amber-600 dark:text-amber-400 mt-1">{{ getAvailabilityMessage() }}</p>
                      <div class="mt-2 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                        <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="flex items-start gap-3 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-sm">
                    <ng-icon name="lucideCheck" class="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <div class="flex-1">
                      <p class="font-medium text-green-700 dark:text-green-300">Sufficient resources</p>
                      <div class="mt-1 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Required:</span><span class="text-right">{{ av.required.cpu }} CPU · {{ av.required.memory }} RAM</span>
                        <span>Available (after 10% reserve):</span><span class="text-right">{{ av.available.cpu }} CPU · {{ av.available.memory }} RAM</span>
                        <span>Currently used:</span><span class="text-right">{{ av.used.cpu }} CPU · {{ av.used.memory }} RAM</span>
                        <span>Cluster total:</span><span class="text-right">{{ av.total.cpu }} CPU · {{ av.total.memory }} RAM</span>
                      </div>
                      <p class="text-[11px] text-muted-foreground mt-1.5 italic">Flui keeps 10% of cluster capacity reserved as headroom.</p>
                    </div>
                  </div>
                }
              }

              <!-- Deployment Info -->
              <div class="border border-border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <h4 class="font-medium mb-3 text-blue-900 dark:text-blue-100">Deployment Info</h4>
                <div class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <div class="flex justify-between">
                    <span>Application name:</span>
                    <span class="font-medium">{{ getApplicationName() }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Estimated time:</span>
                    <span class="font-medium">2-5 minutes</span>
                  </div>
                </div>
                <p class="text-xs text-blue-600 dark:text-blue-400 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  💡 Deployment will start immediately and can be monitored in real-time
                </p>
              </div>
            </div>
          }
        }
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between">
        <button
          (click)="previousStep()"
          [disabled]="currentStepIndex() === 0"
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Previous
        </button>

        <div class="flex items-center space-x-2">
          <button
            (click)="navigateBack()"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </button>

          @if (currentStepIndex() < steps().length - 1) {
            <button
              (click)="nextStep()"
              [disabled]="!canProceed()"
              class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
            </button>
          } @else {
            @if (flowSubtype() === 'marketplace' && state.installPhase() === 'running') {
              <!-- Install completed: hide the action button, user uses the inline CTAs -->
            } @else {
              <button
                (click)="deployApplication()"
                [disabled]="!canComplete() || isDeploying() || !canDeploy()"
                [attr.title]="canDeployReason()"
                class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                @if (isDeploying()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                  @if (flowSubtype() === 'marketplace') { Installing... } @else { Deploying... }
                } @else {
                  <ng-icon name="lucidePlay" class="h-4 w-4 mr-2" />
                  @if (flowSubtype() === 'marketplace') { Install } @else { Deploy Application }
                }
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class DeployWizardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  repoService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly templateService = inject(TemplateService);
  state = inject(DeployWizardStateService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly imagesApi = inject(ImagesService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  catalog = inject(CatalogService);
  protected authzInstall = inject(AuthzInstallService);

  // Flow routing (Flow B/C) — mirrored from state service for easier template access
  readonly flowSubtype = this.state.flowSubtype;

  // Template picker state
  templates = this.templateService.templates;
  isLoadingTemplates = signal<boolean>(false);

  // Step management
  currentStepIndex = signal<number>(0);
  isDeploying = signal<boolean>(false);
  deployError = signal<string | null>(null);

  // Source type selection
  sourceType = signal<'docker_image' | 'git_build' | null>(null);

  // Docker image step
  selectedImageRef = signal<string>('');
  selectedKind = signal<ApplicationKind>(ApplicationKindEnum.Application);
  readonly kindOptions: { value: ApplicationKind; label: string }[] = [
    { value: ApplicationKindEnum.Database, label: 'Database' },
    { value: ApplicationKindEnum.Application, label: 'Application' },
    { value: ApplicationKindEnum.Tool, label: 'Tool' },
    { value: ApplicationKindEnum.System, label: 'System' },
  ];

  setKind(kind: ApplicationKind): void {
    this.selectedKind.set(kind);
  }

  readonly currentStepId = computed(() => this.steps()[this.currentStepIndex()]?.id ?? '');

  // Step 1: Repository
  isLoadingRepos = signal<boolean>(false);
  selectedRepo = signal<ConnectedRepository | null>(null);
  selectedPublicRepo = signal<PublicRepoSearchResultDto | null>(null);
  repoTab = signal<'mine' | 'public'>('mine');
  connectedRepos = this.repoService.connectedRepositories;

  // Step 2: Branch & Framework
  isLoadingBranches = signal<boolean>(false);
  availableBranches = signal<string[]>([]);
  selectedBranch = signal<string>('main');

  // Step 3: Environment Variables
  envMode = signal<'key-value' | 'json'>('key-value');
  envVars = signal<EnvironmentVariable[]>([]);
  rawEnvJson = signal<string>('{}');
  jsonError = signal<string | null>(null);

  // Env var detection (git_build only)
  envDetectionLoading = signal(false);
  envDetectionResult = signal<EnvVarDetectionResultDto | null>(null);
  envDetectionError = signal<string | null>(null);
  selectedCandidateIndex = signal(0);
  detectedVarMeta = signal<Map<string, DetectedEnvVarDto>>(new Map());
  private currentAnalysisToken: symbol | null = null;

  // Configuration step (docker_image)
  appPort = signal<number | null>(null);
  appReplicas = signal<number>(1);

  // Port discovery
  portDiscovering = signal<boolean>(false);
  portDiscoveredFrom = signal<string>('');   // imageRef that was inspected
  exposedPorts = signal<number[]>([]);       // all ports found
  portAutoDetected = signal<boolean>(false); // true if current appPort was set by discovery

  // Health probe (docker_image)
  probeType = signal<'http' | 'tcp' | 'none'>('none');
  probeExpanded = signal<boolean>(false);
  probeHttpPath = signal<string>('/');
  probeInitialDelay = signal<number>(30);
  probePeriod = signal<number>(30);
  probeFailureThreshold = signal<number>(3);
  selectedProfile = signal<string>('small');
  availableProfiles = signal<ResourceProfileDto[]>([]);
  loadingProfiles = signal<boolean>(false);

  // Cluster resource availability (docker_image)
  resourceAvailability = signal<ResourceAvailabilityResponseDto | null>(null);
  checkingAvailability = signal<boolean>(false);

  /**
   * Deploy-side resource gate. All flows check that the cluster has enough
   * free resources for the RUNTIME pod (profile * replicas). Build-side
   * resources are no longer a concern — git_build flows run the build on
   * GitHub Actions runners, not on the cluster.
   */
  readonly isInternalDeploy = computed(() => {
    if (this.flowSubtype() === 'marketplace') {
      const d = this.state.catalogDetail();
      if (!d || d.appType === 'building-block') return false;
      return d.exposure === 'internal' || this.state.exposureMode() === CreateApplicationDto.ExposureEnum.Internal;
    }
    return this.state.exposureMode() === CreateApplicationDto.ExposureEnum.Internal;
  });

  readonly authzNotReady = computed(() => {
    if (!this.isInternalDeploy()) return false;
    const status = this.authzInstall.install()?.status;
    return status !== AuthzInstallResponseDto.StatusEnum.Running;
  });

  constructor() {
    effect(() => {
      const clusterId = this.state.clusterId();
      if (clusterId && this.isInternalDeploy()) {
        void this.authzInstall.loadForCluster(clusterId);
      }
    });
  }

  readonly canDeploy = computed(() => {
    if (this.flowSubtype() === 'marketplace') {
      if (this.state.catalogDetail()?.installable === false) return false;
      return this.state.canSubmitMarketplaceResources();
    }
    const av = this.resourceAvailability();
    if (!av) return true; // still loading or no check performed yet — don't block
    return av.canDeploy;
  });

  /** Tooltip explaining why the install/deploy button is disabled (if it is). */
  readonly canDeployReason = computed<string | null>(() => {
    const detail = this.state.catalogDetail();
    if (this.flowSubtype() === 'marketplace' && detail?.installable === false) {
      const details = (detail.notInstallableDetails ?? []).map(d => {
        switch (d) {
          case 'dns_zone': return 'DNS zone';
          case 'wildcard_issuer': return 'wildcard TLS issuer';
          case 'internal_wildcard_dns': return 'internal wildcard DNS';
          default: return d;
        }
      });
      const missing = details.length ? ` Missing: ${details.join(', ')}.` : '';
      return `This cluster does not support internal apps yet.${missing} Configure DNS on the cluster first.`;
    }
    return null;
  });

  readonly internalHostingMissingLabel = computed(() => {
    const missing = this.state.internalHostingMissing();
    if (missing.length === 0) return 'DNS configuration';
    return missing
      .map(k => {
        switch (k) {
          case 'dns_zone': return 'DNS zone';
          case 'wildcard_issuer': return 'wildcard TLS issuer';
          case 'internal_wildcard_dns': return 'internal wildcard DNS';
          default: return k;
        }
      })
      .join(', ');
  });

  readonly selectedProfileInfo = computed(() =>
    this.availableProfiles().find(p => p.name === this.selectedProfile()) ?? null
  );

  // Manifest check (Flow C — manifest-first, mirror of `flui deploy`)
  isCheckingManifest = signal<boolean>(false);
  manifestsForSelector = signal<RepositoryManifestEntry[] | null>(null);
  selectedManifestPath = signal<string | null>(null);
  manifestFetchError = signal<string | null>(null);

  /** Valid (kind: Application) manifests — the deployables of this repo. */
  readonly validManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => e.valid)
  );

  /** Manifests that exist but failed validation — surfaced in the invalid branch. */
  readonly invalidManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => !e.valid)
  );

  /**
   * The manifest driving the rest of the wizard, mapped to the single-manifest
   * shape consumed by the state service. In a monorepo (several valid
   * manifests) the user picks one in the analysis step; the first valid one is
   * pre-selected.
   */
  readonly manifestForSelector = computed<RepositoryFluiManifest | null>(() => {
    const entries = this.manifestsForSelector();
    if (!entries) return null;
    const branch = this.selectedBranch();
    if (entries.length === 0) return { present: false, branch };
    const chosen =
      entries.find((e) => e.valid && e.path === this.selectedManifestPath()) ??
      entries.find((e) => e.valid) ??
      entries[0];
    return {
      present: true,
      branch,
      path: chosen.path,
      content: chosen.content,
      valid: chosen.valid,
      validationError: chosen.validationError,
      manifest: chosen.manifest,
    };
  });

  /**
   * Branch state for the Flow C analysis step. The flui.yaml manifest is the
   * only accepted source of truth: without a valid manifest the wizard blocks
   * and points the user to `flui app init` — no Dockerfile fallback.
   */
  readonly analysisBranch = computed<'loading' | 'flui-ready' | 'manifest-invalid' | 'no-manifest' | 'check-failed'>(() => {
    if (this.isCheckingManifest()) return 'loading';
    if (this.manifestFetchError()) return 'check-failed';
    const entries = this.manifestsForSelector();
    if (!entries) return 'loading';
    if (entries.length === 0) return 'no-manifest';
    return this.validManifests().length > 0 ? 'flui-ready' : 'manifest-invalid';
  });

  // Step 4: Cluster
  isLoadingClusters = signal<boolean>(false);
  selectedCluster = signal<ClusterInfo | null>(null);
  allClusters = this.clusterService.clusters;
  activeClusters = computed(() =>
    this.allClusters().filter((c) => c.status === 'active')
  );

  // Wizard steps definition — three flows share the same component, dispatched on flowSubtype.
  readonly steps = computed<WizardStepperStep[]>(() => {
    const ci = this.currentStepIndex();
    const sub = this.flowSubtype();

    /** Helper: stamps every step in the array with the correct isCompleted
     *  flag — any step whose index is strictly less than the current step
     *  index is marked as completed (green). */
    const markCompleted = (raw: WizardStepperStep[]): WizardStepperStep[] =>
      raw.map((s, i) => ({ ...s, isCompleted: i < ci }));

    const sourceStep: WizardStepperStep = {
      id: 'source',
      title: 'Source',
      icon: 'lucideSettings',
      isValid: !!sub,
      isCompleted: false, // stamped by markCompleted
    };

    const clusterStep: WizardStepperStep = {
      id: 'cluster',
      title: 'Cluster',
      icon: 'lucideServer',
      isValid: !!this.selectedCluster(),
      isCompleted: false,
    };

    const reviewStep: WizardStepperStep = {
      id: 'review',
      title: 'Review',
      icon: 'lucideCheck',
      // A dedicated app on a worker-less cluster must run on the control-plane node;
      // block proceeding while the placement toggle is shown but left unticked, since
      // the install would otherwise fail with NO_WORKER_FOR_DEDICATED_APP.
      isValid: !(this.state.allowMasterPlacementRelevant() && !this.state.allowMasterPlacement()),
      isCompleted: false,
    };

    // Flow A — Docker image
    if (sub === 'image') {
      return markCompleted([
        sourceStep,
        {
          id: 'docker_image',
          title: 'Docker Image',
          icon: 'lucideContainer',
          isValid: !!this.selectedImageRef(),
          isCompleted: false,
        },
        {
          id: 'environment',
          title: 'Configuration',
          icon: 'lucideKey',
          isValid: true,
          isCompleted: false,
        },
        clusterStep,
        reviewStep,
      ]);
    }

    // Flow B — Deploy from Flui template
    if (sub === 'template') {
      return markCompleted([
        sourceStep,
        {
          id: 'template-picker',
          title: 'Template',
          icon: 'lucideRocket',
          isValid: !!this.state.selectedTemplate(),
          isCompleted: false,
        },
        {
          id: 'template-settings',
          title: 'Repo settings',
          icon: 'lucideGithub',
          isValid: !!this.state.newRepoName() && !this.templateNameError(),
          isCompleted: false,
        },
        clusterStep,
        {
          id: 'environment',
          title: 'Env vars',
          icon: 'lucideKey',
          isValid: true,
          isCompleted: false,
        },
        reviewStep,
        {
          id: 'generate',
          title: 'Deploy',
          icon: 'lucidePlay',
          isValid: true,
          isCompleted: false,
        },
      ]);
    }

    // Flow C — Existing repository
    if (sub === 'existing-repo') {
      const hasRepo = !!(this.selectedRepo() || this.selectedPublicRepo());
      const analysisValid = this.analysisBranch() === 'flui-ready';

      const stepsC: WizardStepperStep[] = [
        sourceStep,
        {
          id: 'repository',
          title: 'Repository',
          icon: 'lucideGitBranch',
          isValid: hasRepo,
          isCompleted: false,
        },
        {
          id: 'analysis',
          title: 'Analysis',
          icon: 'lucideGithub',
          isValid: analysisValid,
          isCompleted: false,
        },
        clusterStep,
        {
          id: 'environment',
          title: 'Env vars',
          icon: 'lucideKey',
          isValid: true,
          isCompleted: false,
        },
      ];

      stepsC.push(reviewStep);
      stepsC.push({
        id: 'generate',
        title: 'Deploy',
        icon: 'lucidePlay',
        isValid: true,
        isCompleted: false,
      });
      return markCompleted(stepsC);
    }

    // Flow D — Marketplace (catalog install)
    if (sub === 'marketplace') {
      const detail = this.state.catalogDetail();
      const hasPrompts = (detail?.userInputPrompts?.length ?? 0) > 0;
      const hasDefaultCredentials = !!detail?.defaultCredentials;
      const hasEditableEnv = (detail?.editableEnv?.length ?? 0) > 0;

      const marketplaceSteps: WizardStepperStep[] = [
        sourceStep,
        {
          id: 'catalog-overview',
          title: 'App',
          icon: 'lucideStore',
          isValid: !!detail && this.state.catalogDisplayNameValid(),
          isCompleted: false,
        },
      ];

      if (hasPrompts || hasDefaultCredentials) {
        marketplaceSteps.push({
          id: 'catalog-inputs',
          title: 'Configuration',
          icon: 'lucideKey',
          isValid: this.state.catalogInputsValid(),
          isCompleted: false,
        });
      }

      if (hasEditableEnv) {
        marketplaceSteps.push({
          id: 'catalog-config',
          title: 'Settings',
          icon: 'lucideSettings',
          isValid: true,
          isCompleted: false,
        });
      }

      if (this.state.needsCatalogFeaturesStep()) {
        marketplaceSteps.push({
          id: 'catalog-features',
          title: 'Features',
          icon: 'lucideSlidersHorizontal',
          isValid: true,
          isCompleted: false,
        });
      }

      marketplaceSteps.push(clusterStep);
      if (this.state.needsDependencyPicker()) {
        marketplaceSteps.push({
          id: 'catalog-dependencies',
          title: 'Dependencies',
          icon: 'lucideDatabase',
          isValid: this.state.catalogDependenciesValid(),
          isCompleted: false,
        });
      }
      if (this.state.needsLinkedBbPicker()) {
        marketplaceSteps.push({
          id: 'catalog-linked-bb',
          title: 'Link ',
          icon: 'lucideDatabase',
          // Optional step: the user can skip and Connect later from the app page.
          isValid: true,
          isCompleted: false,
        });
      }
      if (detail?.exposesPublicEndpoint !== false && this.state.exposureMode() !== CreateApplicationDto.ExposureEnum.Internal) {
        marketplaceSteps.push({
          id: 'catalog-domain',
          title: 'Domain',
          icon: 'lucideCloud',
          isValid: this.state.catalogDomainValid(),
          isCompleted: false,
        });
      }
      marketplaceSteps.push(reviewStep);
      marketplaceSteps.push({
        id: 'generate',
        title: 'Install',
        icon: 'lucidePlay',
        isValid: true,
        isCompleted: false,
      });

      return markCompleted(marketplaceSteps);
    }

    // No flow picked yet — show only source step
    return markCompleted([sourceStep]);
  });

  // Template name validation (matches the backend regex from FRONTEND_TEMPLATE_DEPLOY.md)
  private static readonly REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  readonly templateNameError = computed(() => {
    const value = this.state.newRepoName();
    if (!value) return null;
    if (value.length > 100) return 'Maximum 100 characters.';
    if (!DeployWizardComponent.REPO_NAME_PATTERN.test(value)) return 'Only letters, numbers, dots, dashes, and underscores.';
    return null;
  });

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);

  ngOnInit(): void {
    void (async () => {
      // Background loads — none of these block the initial render
      this.loadClusters();
      this.loadProfiles();
      this.loadRepositories();
  
      // Kick off template loading if we're about to show the template picker
      this.loadTemplates();
  
      // Refresh OAuth status so hasRepoScope is accurate for the template flow
      try { await this.repoService.checkOAuthStatus(); } catch { /* non-fatal */ }
  
      const templateFw = this.route.snapshot.queryParamMap.get('template');
      const repoId = this.route.snapshot.queryParamMap.get('repoId');
      const catalogSlug = this.route.snapshot.queryParamMap.get('catalogSlug');
      const autoConnectTo = this.route.snapshot.queryParamMap.get('autoConnectTo');
  
      if (catalogSlug) {
        // Deep-link from the App Catalog → pre-select marketplace flow
        this.selectFlow('marketplace');
        const detail = await this.catalog.loadDetail(catalogSlug);
        if (detail) {
          this.state.initializeFromCatalog(detail);
          if (autoConnectTo) {
            this.state.pendingLinkedInstallId.set(autoConnectTo);
            this.state.linkedInstallIdPreset.set(true);
          }
          this.currentStepIndex.set(1); // skip the Source step
        }
      } else if (templateFw) {
        // Deep-link from templates-catalog → pre-select Flow B with a specific template
        this.selectFlow('template');
        // Wait for templates to finish loading before we can match the framework
        await this.loadTemplates();
        const tpl = this.templates().find(t => t.framework === templateFw);
        if (tpl) {
          this.state.selectedTemplate.set(tpl);
          this.advanceToTemplateSettings();
        } else {
          // Unknown template — leave the user on the picker
          this.currentStepIndex.set(1);
        }
      } else if (repoId) {
        // Deep-link from the repositories page → pre-select Flow C existing-repo
        this.selectFlow('existing-repo');
        await this.loadRepositories();
        const repo = this.connectedRepos().find(r => r.id === repoId);
        if (repo) {
          this.selectRepository(repo);
          this.currentStepIndex.set(1);
          this.loadBranches().then(() => this.triggerManifestCheck());
        }
      }
    })();
  }

  async loadTemplates(): Promise<void> {
    if (this.templates().length > 0) return;
    this.isLoadingTemplates.set(true);
    try {
      await this.templateService.loadTemplates();
    } catch {
      // silent — error surfaced via templateService.errorMessage
    } finally {
      this.isLoadingTemplates.set(false);
    }
  }

  // Load repositories
  async loadRepositories(): Promise<void> {
    this.isLoadingRepos.set(true);

    try {
      await this.repoService.loadRepositories();
    } catch (error) {
      console.error('❌ Failed to load repositories:', error);
    } finally {
      this.isLoadingRepos.set(false);
    }
  }

  // Navigation
  canProceed(): boolean {
    return this.currentStep().isValid;
  }

  canComplete(): boolean {
    const reviewIdx = this.steps().length - 1;
    return this.steps().every((step, idx) => idx === reviewIdx || step.isValid);
  }

  nextStep(): void {
    if (!this.canProceed()) return;

    const nextIndex = this.currentStepIndex() + 1;
    const nextStepId = this.steps()[nextIndex]?.id;

    // Flow C — check for the flui.yaml manifest when entering the analysis step
    if (nextStepId === 'analysis' && this.flowSubtype() === 'existing-repo') {
      this.loadBranches().then(() => this.triggerManifestCheck());
    }

    // Flow C — sync state service with repo + manifest when entering cluster step from analysis
    if (nextStepId === 'cluster' && this.flowSubtype() === 'existing-repo') {
      const repo = this.selectedRepo();
      const manifest = this.manifestForSelector();
      if (repo && manifest?.valid) {
        this.state.initializeFromManifest(repo.id, repo.fullName, this.selectedBranch(), manifest, this.selectedCluster()?.id ?? '');
      }
    }

    // Flow B — sync state service with template + cluster selection
    if (nextStepId === 'cluster' && this.flowSubtype() === 'template') {
      // nothing extra — state.selectedTemplate is already set
    }

    // Flow C — env vars step: the manifest's deploy.env is the source of truth.
    // Source-code detection only runs when the manifest declares no env at all.
    if (nextStepId === 'environment' && this.flowSubtype() === 'existing-repo' && (this.selectedRepo() || this.selectedPublicRepo())) {
      const manifestHasEnv = this.prefillEnvVarsFromManifest();
      if (!manifestHasEnv) {
        this.loadBranches().then(() => this.analyzeAndSuggestEnvVars());
      }
    }

    // Flow A — inspect image ports when entering config step
    if (nextStepId === 'environment' && this.flowSubtype() === 'image') {
      this.inspectImagePorts();
    }

    // Re-run the runtime resource check whenever the user advances PAST the
    // config step (where they could have changed profile/replicas) OR into
    // the review step. This catches the Flow C case: user picks cluster first
    // (check runs with template defaults) and then changes the profile in
    // flui-config — without this re-run the review would still show the
    // stale check from the cluster step.
    if (nextStepId === 'review' && this.flowSubtype() !== 'marketplace') {
      const clusterId = this.selectedCluster()?.id;
      if (clusterId) {
        this.checkResourceAvailabilityForCluster(clusterId);
      }
    }

    // Marketplace uses a dedicated capacity check with the manifest-declared
    // resources (or the user's overrides), not the generic profile-based one.
    if (nextStepId === 'review' && this.flowSubtype() === 'marketplace') {
      const clusterId = this.selectedCluster()?.id;
      if (clusterId) {
        this.state.checkCatalogResourceAvailability(clusterId);
        // Surface the control-plane placement toggle when a dedicated-storage app
        // targets a worker-less cluster, instead of failing the deploy later.
        this.state.refreshMasterPlacementRelevance(clusterId);
      }
    }

    // Cluster sync — push the chosen cluster into the state service for Flow B/C/D
    if (this.currentStep().id === 'cluster' && this.selectedCluster()?.id) {
      const clusterId = this.selectedCluster()!.id!;
      this.state.clusterId.set(clusterId);
      // Load cluster capabilities for all flows — marketplace uses them for the
      // Domain step branches, docker/git flows use them to gate the Internal
      // exposure option (hide if the cluster has no internal hosting).
      this.state.fetchClusterCapabilities(clusterId);
      if (this.flowSubtype() === 'marketplace') {
        // Refresh the catalog detail with the chosen clusterId so `installable`
        // and `notInstallableReason` reflect this cluster's readiness.
        const slug = this.state.catalogSlug();
        if (slug) {
          this.catalog.loadDetail(slug, clusterId).then(detail => {
            if (detail) this.state.catalogDetail.set(detail);
          });
        }
        if (this.state.needsLinkedBbPicker()) {
          this.state.loadReusableInstances(clusterId);
        }
        if (this.state.needsDependencyPicker()) {
          this.state.loadDependencyInstances(clusterId);
        }
      }
    }

    this.currentStepIndex.set(Math.min(nextIndex, this.steps().length - 1));
  }

  previousStep(): void {
    this.currentStepIndex.set(Math.max(this.currentStepIndex() - 1, 0));
  }

  navigateBack(): void {
    this.router.navigate(['/apps/applications']);
  }

  navigateToRepositories(): void {
    this.router.navigate(['/apps/repositories']);
  }

  navigateToCluster(): void {
    this.router.navigate(['/cluster/create']);
  }

  navigateToClusterDns(): void {
    const id = this.state.clusterId();
    if (!id) return;
    this.router.navigate(['/infrastructure/domains/internal-hosting'], {
      queryParams: { clusterId: id },
    });
  }

  navigateToAuthProxy(): void {
    const id = this.state.clusterId();
    this.router.navigate(['/settings'], {
      queryParams: id ? { clusterId: id } : {},
      fragment: 'auth-proxy',
    });
  }

  async installAuthProxy(): Promise<void> {
    const id = this.state.clusterId();
    if (!id) return;
    await this.authzInstall.installAuthz(id);
  }

  navigateToTemplates(): void {
    this.router.navigate(['/apps/templates']);
  }

  // Step: Source type / flow selection
  selectFlow(sub: 'image' | 'template' | 'existing-repo' | 'marketplace'): void {
    this.state.flowSubtype.set(sub);
    if (sub === 'image') {
      this.state.sourceType.set('docker_image');
      this.sourceType.set('docker_image');
    } else if (sub === 'marketplace') {
      this.state.sourceType.set(null);
      this.sourceType.set(null);
    } else {
      this.state.sourceType.set('git_build');
      this.sourceType.set('git_build');
    }

    // Reset per-flow state on switch
    this.selectedImageRef.set('');
    this.selectedRepo.set(null);
    this.selectedPublicRepo.set(null);
    this.manifestsForSelector.set(null);
    this.selectedManifestPath.set(null);
    this.manifestFetchError.set(null);

    if (sub === 'template') {
      this.loadTemplates();
    }
  }

  /** UI card class for the four flow options in the Source step. */
  getFlowCardClass(sub: 'image' | 'template' | 'existing-repo' | 'marketplace'): string {
    const base = 'relative flex flex-col items-start text-left p-5 rounded-lg border border-border cursor-pointer transition-colors hover:bg-accent/50 w-full';
    return this.flowSubtype() === sub ? `${base} bg-primary/10 border-primary` : base;
  }

  // ===== Flow B — Template flow =====

  selectTemplate(template: TemplateResponseDto): void {
    // initializeFromTemplate is the single entry point that syncs deployConfig
    // (port, healthcheckPath, resourceProfile) + runtimeConfig from the template's
    // defaults. Calling .set on selectedTemplate alone would leave deployConfig
    // stuck on the initial {/health, port 3000, small} defaults and the Review
    // step would disagree with the template card.
    this.state.initializeFromTemplate(template, this.selectedCluster()?.id ?? '');
    if (!this.state.newRepoName()) {
      this.state.newRepoName.set(`${template.framework}-app`.replaceAll(/[^a-zA-Z0-9._-]/g, '-'));
    }
  }

  getTemplateCardClass(framework: string): string {
    const base = 'p-4 rounded-lg border text-left transition-colors hover:bg-accent/40 w-full';
    return this.state.selectedTemplate()?.framework === framework
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border`;
  }

  getVisibilityButtonClass(privateBtn: boolean): string {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors';
    return this.state.newRepoPrivate() === privateBtn
      ? `${base} border-primary bg-primary/10 text-foreground`
      : `${base} border-border text-muted-foreground hover:bg-accent`;
  }

  /** Jump forward past the picker when a template is pre-selected via query param. */
  private advanceToTemplateSettings(): void {
    this.state.initializeFromTemplate(this.state.selectedTemplate()!, this.selectedCluster()?.id ?? '');
    this.currentStepIndex.set(2); // source=0, template-picker=1, template-settings=2
  }

  // ===== Flow C — Existing repo helpers =====

  /** User clicked "Switch to template flow" from the analysis or no-dockerfile branch. */
  switchToTemplateFlow(): void {
    // Reset Flow C state, switch to Flow B, land on the template picker
    this.state.resetFlowState();
    this.selectFlow('template');
    this.currentStepIndex.set(1); // template-picker
  }

  // ===== Generate step — orchestration progress helpers =====

  readonly orchestrationSteps = computed(() => {
    if (this.flowSubtype() === 'template') {
      return [
        { id: 'creating-repo',       label: 'Creating GitHub repository from template' },
        { id: 'registering-repo',    label: 'Registering repository with Flui' },
        { id: 'creating-app',        label: 'Creating Flui application' },
        { id: 'generating-workflow', label: 'Committing build workflow to repository' },
      ] as const;
    }
    return [
      { id: 'creating-app', label: 'Submitting flui.yaml manifest & committing build workflow' },
    ] as const;
  });

  private orchestrationOrder(): string[] {
    return this.orchestrationSteps().map(s => s.id);
  }

  isOrchestrationStepDone(id: string): boolean {
    const order = this.orchestrationOrder();
    const phase = this.state.orchestrationPhase();
    if (phase === 'done') return true;
    const currentIdx = order.indexOf(phase);
    const stepIdx = order.indexOf(id);
    if (currentIdx === -1) return false;
    return stepIdx < currentIdx;
  }

  isOrchestrationStepActive(id: string): boolean {
    return this.state.orchestrationPhase() === id;
  }

  isOrchestrationStepPending(id: string): boolean {
    return !this.isOrchestrationStepDone(id) && !this.isOrchestrationStepActive(id);
  }

  getOrchestrationStepClass(id: string): string {
    const base = 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border';
    if (this.isOrchestrationStepDone(id)) {
      return `${base} bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300`;
    }
    if (this.isOrchestrationStepActive(id)) {
      return `${base} bg-primary/10 border-primary text-primary`;
    }
    return `${base} border-border text-muted-foreground`;
  }

  getRepoTabClass(tab: 'mine' | 'public'): string {
    const base = 'flex-1 text-center px-4 py-2 text-sm font-medium border-b-2 transition-colors';
    return this.repoTab() === tab
      ? `${base} border-primary text-primary`
      : `${base} border-transparent text-muted-foreground hover:text-foreground`;
  }

  onPublicRepoSelected(repo: PublicRepoSearchResultDto): void {
    this.selectedPublicRepo.set(repo);
    this.selectedRepo.set(null);
    this.availableBranches.set([]);
    this.selectedBranch.set(repo.default_branch);
    this.loadBranches().then(() => {});
  }

  clearPublicRepo(): void {
    this.selectedPublicRepo.set(null);
    this.availableBranches.set([]);
    this.selectedBranch.set('main');
  }

  getSourceTypeCardClass(type: string): string {
    const base = 'relative flex flex-col items-center text-center p-6 rounded-lg border border-border cursor-pointer transition-colors hover:bg-accent/50';
    return this.sourceType() === type ? `${base} bg-primary/10 border-primary` : base;
  }

  // Step: Docker image
  onImageSelected(imageRef: string): void {
    this.selectedImageRef.set(imageRef);
    this.selectedKind.set(suggestKindFromImageRef(imageRef));
  }

  clearImageRef(): void {
    this.selectedImageRef.set('');
  }

  // Step: Repository (git_build)
  selectRepository(repo: ConnectedRepository): void {
    this.selectedRepo.set(repo);
    this.selectedPublicRepo.set(null);
  }

  getRepoCardClass(repoId: string): string {
    const baseClass =
      'p-4 rounded-lg border border-border cursor-pointer transition-colors hover:bg-accent/50';
    return this.selectedRepo()?.id === repoId
      ? `${baseClass} bg-primary/10 border-primary`
      : baseClass;
  }

  // Step 2: Branch & Framework
  async loadBranches(): Promise<void> {
    const publicRepo = this.selectedPublicRepo();
    const connectedRepo = this.selectedRepo();
    if (!publicRepo && !connectedRepo) return;

    this.isLoadingBranches.set(true);

    try {
      let branchNames: string[];
      if (publicRepo) {
        branchNames = await this.repoService.getPublicRepositoryBranches(publicRepo.full_name);
      } else {
        const branches = await this.repoService.getRepositoryBranches(connectedRepo!.id);
        branchNames = branches.map((b: any) => b.name || b);
      }
      this.availableBranches.set(branchNames);

      // Set default branch (prefer 'main', then 'master', then first available)
      const currentBranch = this.selectedBranch();
      if (branchNames.length > 0 && !branchNames.includes(currentBranch)) {
        if (branchNames.includes('main')) {
          this.selectedBranch.set('main');
        } else if (branchNames.includes('master')) {
          this.selectedBranch.set('master');
        } else {
          this.selectedBranch.set(branchNames[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
      this.availableBranches.set(['main', 'master', 'develop']);
      this.selectedBranch.set('main');
    } finally {
      this.isLoadingBranches.set(false);
    }
  }

  selectBranch(branch: string): void {
    this.selectedBranch.set(branch);

    // The flui.yaml manifest is branch-specific: refresh it and re-sync the
    // wizard state. If the new branch has no valid manifest the analysis step
    // turns invalid and deploy stays blocked.
    if (this.flowSubtype() === 'existing-repo' && this.selectedRepo()) {
      this.triggerManifestCheck().then(() => {
        const repo = this.selectedRepo();
        const manifest = this.manifestForSelector();
        if (repo && manifest?.valid) {
          this.state.initializeFromManifest(repo.id, repo.fullName, branch, manifest, this.selectedCluster()?.id ?? '');
          if (this.currentStepId() === 'environment') {
            this.envVars.set([]);
            if (!this.prefillEnvVarsFromManifest()) {
              this.analyzeAndSuggestEnvVars();
            }
          }
        }
      });
      return;
    }

    if (this.currentStepId() === 'environment') {
      this.analyzeAndSuggestEnvVars();
    }
  }

  /**
   * Flow C analysis: fetch flui.yaml from the repo root (manifest-first).
   * The step unlocks only on a valid kind: Application manifest — no
   * Dockerfile fallback; the no-manifest branch points to `flui app init`.
   */
  async triggerManifestCheck(): Promise<void> {
    const repo = this.selectedRepo();
    if (!repo) return;

    this.isCheckingManifest.set(true);
    this.manifestsForSelector.set(null);
    this.selectedManifestPath.set(null);
    this.manifestFetchError.set(null);

    try {
      const result = await this.repoService.getFluiManifests(repo.id, this.selectedBranch());
      this.manifestsForSelector.set(result.manifests);
      const firstValid = result.manifests.find((e) => e.valid);
      if (firstValid) this.selectedManifestPath.set(firstValid.path);
    } catch (error: any) {
      this.manifestFetchError.set(error?.message || 'Failed to read flui.yaml manifests');
    } finally {
      this.isCheckingManifest.set(false);
    }
  }

  /** Monorepo: pick which deployable (flui.yaml) this wizard run deploys. */
  selectManifest(path: string): void {
    this.selectedManifestPath.set(path);
  }

  /**
   * Prefill the env editor from the manifest's deploy.env. Values and
   * userInput entries become editable rows; platform-generated secrets
   * (valueFrom.generate / secretRef) are handled server-side and skipped.
   * Returns true when the manifest declares env vars (detection is skipped).
   */
  private prefillEnvVarsFromManifest(): boolean {
    const env = this.manifestForSelector()?.manifest?.deploy.env;
    if (!env?.length) return false;

    if (this.envVars().length === 0) {
      const entries = env
        .filter(e => e.value !== undefined || e.valueFrom?.userInput)
        .map(e => ({
          key: e.name,
          value: e.value ?? e.valueFrom?.userInput?.default ?? '',
          isSecret: e.valueFrom?.userInput?.sensitive ?? false,
        }));
      this.envVars.set(entries);
    }
    return true;
  }

  // Step 3: Env var detection
  async analyzeAndSuggestEnvVars(): Promise<void> {
    const repo = this.selectedRepo();
    const publicRepo = this.selectedPublicRepo();
    if (!repo && !publicRepo) return;

    const token = Symbol();
    this.currentAnalysisToken = token;
    this.envDetectionLoading.set(true);
    this.envDetectionError.set(null);
    this.envDetectionResult.set(null);
    this.detectedVarMeta.set(new Map());

    try {
      const analysis = repo
        ? await this.repoService.analyzeRepository(repo.id, this.selectedBranch())
        : await this.repoService.analyzePublicRepository(publicRepo!.clone_url, this.selectedBranch());
      if (this.currentAnalysisToken !== token) return; // cancelled

      // Note: we deliberately ignore `analysis.detection` here — the old
      // Railpack-era framework detection is unreliable (e.g. returns
      // "fastapi 50%" on a Flui template repo) and showing its confidence
      // in the UI was misleading. We only consume envVarSuggestions which
      // comes from parsing .env.example.
      const suggestions = analysis?.buildPlan?.envVarSuggestions as EnvVarDetectionResultDto | undefined;
      this.envDetectionResult.set(suggestions ?? null);

      if (suggestions?.candidates.length) {
        this.applyDetectedVars(0);
      }
    } catch {
      if (this.currentAnalysisToken === token) {
        this.envDetectionError.set('Could not analyze repository.');
      }
    } finally {
      if (this.currentAnalysisToken === token) {
        this.envDetectionLoading.set(false);
      }
    }
  }

  cancelEnvDetection(): void {
    this.currentAnalysisToken = null;
    this.envDetectionLoading.set(false);
  }

  /** Switch to Flow A (Docker image) — used by the "no dockerfile" analysis branch. */
  applyDetectedVars(candidateIndex: number, preserveKey?: string): void {
    const result = this.envDetectionResult();
    if (!result?.candidates.length) return;

    const candidate = result.candidates[candidateIndex];
    this.selectedCandidateIndex.set(candidateIndex);

    const preservedValue = preserveKey
      ? this.envVars().find(v => v.key === preserveKey)?.value
      : undefined;

    const meta = new Map<string, DetectedEnvVarDto>();
    const vars: EnvironmentVariable[] = candidate.vars
      .filter(v => !v.readOnly)
      .map(v => {
        meta.set(v.name, v);
        const value = (preservedValue !== undefined && v.name === preserveKey)
          ? preservedValue
          : (v.defaultValue ?? '');
        return { key: v.name, value, isSecret: v.sensitive };
      });

    this.detectedVarMeta.set(meta);
    this.envVars.set(vars);
  }

  getDetectedMeta(key: string): DetectedEnvVarDto | undefined {
    return this.detectedVarMeta().get(key);
  }

  // True when a detected var still has its auto-filled defaultValue (user hasn't changed it)
  isDefaultValue(envVar: EnvironmentVariable): boolean {
    const meta = this.detectedVarMeta().get(envVar.key);
    return !!meta?.defaultValue && envVar.value === meta.defaultValue;
  }

  readonly hasUnreviewedDefaults = computed(() => {
    const meta = this.detectedVarMeta();
    if (meta.size === 0) return false;
    return this.envVars().some(v => {
      const m = meta.get(v.key);
      return m?.defaultValue !== undefined && v.value === m.defaultValue;
    });
  });

  // Step 3: Environment Variables
  setEnvMode(mode: 'key-value' | 'json'): void {
    if (mode === 'json' && this.envMode() === 'key-value') {
      // Convert key-value to JSON
      const vars = this.envVars();
      const json: Record<string, string> = {};
      vars.forEach((v) => {
        if (v.key) json[v.key] = v.value;
      });
      this.rawEnvJson.set(JSON.stringify(json, null, 2));
    } else if (mode === 'key-value' && this.envMode() === 'json') {
      // Convert JSON to key-value
      try {
        const json = JSON.parse(this.rawEnvJson());
        const vars: EnvironmentVariable[] = Object.entries(json).map(
          ([key, value]) => ({
            key,
            value: String(value),
            isSecret: false,
          })
        );
        this.envVars.set(vars);
        this.jsonError.set(null);
      } catch (error) {
        this.jsonError.set('Invalid JSON format');
      }
    }

    this.envMode.set(mode);
  }

  addEnvVar(): void {
    this.envVars.update((vars) => [
      ...vars,
      { key: '', value: '', isSecret: false },
    ]);
  }

  removeEnvVar(index: number): void {
    this.envVars.update((vars) => vars.filter((_, i) => i !== index));
  }

  updateEnvKey(index: number, key: string): void {
    this.envVars.update((vars) =>
      vars.map((v, i) => (i === index ? { ...v, key } : v))
    );
  }

  updateEnvValue(index: number, value: string): void {
    this.envVars.update((vars) =>
      vars.map((v, i) => (i === index ? { ...v, value } : v))
    );
  }

  toggleEnvSecret(index: number): void {
    this.envVars.update((vars) =>
      vars.map((v, i) => (i === index ? { ...v, isSecret: !v.isSecret } : v))
    );
  }

  updateRawEnvJson(json: string): void {
    this.rawEnvJson.set(json);

    try {
      JSON.parse(json);
      this.jsonError.set(null);
    } catch (error) {
      this.jsonError.set('Invalid JSON format');
    }
  }

  // Step 4: Cluster
  async loadClusters(): Promise<void> {
    this.isLoadingClusters.set(true);

    try {
      await this.clusterService.loadClusters();
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      this.isLoadingClusters.set(false);
    }
  }

  selectCluster(cluster: ClusterInfo): void {
    this.selectedCluster.set(cluster);
    if (!cluster.id) return;
    // Load capabilities immediately so the exposure toggle reflects the
    // cluster's hasInternalHosting while the user is still on this step.
    this.state.clusterId.set(cluster.id);
    void this.state.fetchClusterCapabilities(cluster.id);
    // Marketplace uses the manifest-declared resources (not a profile), so it
    // has its own capacity check signal. For the other flows we run the
    // profile-based check.
    if (this.flowSubtype() === 'marketplace') {
      this.state.checkCatalogResourceAvailability(cluster.id);
      return;
    }
    this.resourceAvailability.set(null);
    this.checkResourceAvailabilityForCluster(cluster.id);
  }

  /**
   * Preflight runtime-side resource check. Reads the profile + replicas from
   * the right source depending on flow:
   *   - Flow A (image):          local signals (selectedProfile / appReplicas)
   *   - Flow B (template):       state.deployConfig()  (profile from template defaults)
   *   - Flow C (existing-repo):  state.deployConfig()  (profile picked in flui-config step)
   */
  private async checkResourceAvailabilityForCluster(clusterId: string): Promise<void> {
    const sub = this.flowSubtype();
    const profile = sub === 'image'
      ? this.selectedProfile()
      : this.state.deployConfig().resourceProfile;
    const replicas = sub === 'image'
      ? this.appReplicas()
      : this.state.deployConfig().minReplicas;

    this.checkingAvailability.set(true);
    try {
      const res = await firstValueFrom(
        this.clustersApi.clustersControllerCheckResourceAvailability(
          clusterId,
          profile,
          undefined,
          undefined,
          replicas
        )
      );
      this.resourceAvailability.set(res);
    } catch {
      this.resourceAvailability.set(null);
    } finally {
      this.checkingAvailability.set(false);
    }
  }

  private async loadProfiles(): Promise<void> {
    this.loadingProfiles.set(true);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerGetProfiles());
      this.availableProfiles.set(res.profiles);
      this.selectedProfile.set(res.defaultProfile);
    } catch {
      // silent — API default 'small' will apply
    } finally {
      this.loadingProfiles.set(false);
    }
  }

  private readonly profileMeta: Record<string, { label: string; description: string }> = {
    nano:   { label: 'Nano',   description: 'Lightweight proxies and static sites (nginx, caddy, haproxy)' },
    small:  { label: 'Small',  description: 'Simple apps, REST microservices, lightweight tools' },
    medium: { label: 'Medium', description: 'WordPress, Node.js, PHP apps, CMS' },
    large:  { label: 'Large',  description: 'Databases (Postgres, MySQL, Redis), Java apps' },
    xlarge: { label: 'XLarge', description: 'Elasticsearch, Kafka, MongoDB, heavy workloads' },
  };

  getProfileLabel(name: string): string {
    return this.profileMeta[name]?.label ?? name;
  }

  getProfileDescription(name: string): string {
    return this.profileMeta[name]?.description ?? '';
  }

  getProfileCpu(profile: ResourceProfileDto): string {
    const v = profile.cpu as any;
    if (typeof v === 'string') return v;
    return v?.cpu ?? v?.requests ?? v?.limit ?? v?.value ?? '—';
  }

  getProfileMemory(profile: ResourceProfileDto): string {
    const v = profile.memory as any;
    if (typeof v === 'string') return v;
    return v?.memory ?? v?.requests ?? v?.limit ?? v?.value ?? '—';
  }

  getAvailabilityMessage(): string {
    const av = this.resourceAvailability();
    if (!av?.reason) return '';
    // Replicas are read from the same source used by the resource check:
    // local signal for docker_image, deployConfig for template / existing-repo.
    const replicas = this.flowSubtype() === 'image'
      ? this.appReplicas()
      : this.state.deployConfig().minReplicas;
    switch (av.reason) {
      case ResourceAvailabilityResponseDto.ReasonEnum.InsufficientResources:
        return `The cluster does not have enough resources for the selected profile with ${replicas} replica(s). Reduce replicas or choose a smaller profile.`;
      case ResourceAvailabilityResponseDto.ReasonEnum.AutoscalingPending:
        return 'Current resources are tight. Autoscaling will add a node automatically if needed.';
      default:
        return '';
    }
  }

  goToConfigStep(): void {
    const configIdx = this.steps().findIndex(s => s.id === 'environment');
    if (configIdx >= 0) this.currentStepIndex.set(configIdx);
  }

  getProfileCardClass(profileName: string): string {
    const base = 'flex flex-col items-center text-center p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50';
    return this.selectedProfile() === profileName
      ? `${base} border-primary bg-primary/10`
      : `${base} border-border`;
  }

  getClusterCardClass(clusterId: string): string {
    const baseClass =
      'p-4 rounded-lg border border-border cursor-pointer transition-colors hover:bg-accent/50';
    return this.selectedCluster()?.id === clusterId
      ? `${baseClass} bg-primary/10 border-primary`
      : baseClass;
  }

  getStatusBadgeClass(status: string): string {
    const baseClass = 'text-xs px-2 py-1 rounded font-medium';

    switch (status) {
      case 'active':
        return `${baseClass} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case 'creating':
        return `${baseClass} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'error':
        return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300`;
    }
  }

  // Step 5: Review
  getEnvVarsCount(): number {
    if (this.envMode() === 'key-value') {
      return this.envVars().filter((v) => v.key && v.value).length;
    } else {
      try {
        const json = JSON.parse(this.rawEnvJson());
        return Object.keys(json).length;
      } catch {
        return 0;
      }
    }
  }

  getSecretVarsCount(): number {
    return this.envVars().filter((v) => v.isSecret && v.key && v.value).length;
  }

  getApplicationName(): string {
    if (this.flowSubtype() === 'marketplace') {
      return this.state.catalogDisplayName() || this.state.catalogDetail()?.name || 'app';
    }
    if (this.sourceType() === 'docker_image') {
      const ref = this.selectedImageRef();
      const imageName = ref.split(':')[0].split('/').pop() || 'app';
      return imageName;
    }
    const branch = this.selectedBranch();
    const repo = this.selectedRepo();
    if (repo) return `${repo.name}-${branch}`;
    const publicRepo = this.selectedPublicRepo();
    if (publicRepo) return `${publicRepo.name}-${branch}`;
    return 'app';
  }

  getCatalogInputsCount(): number {
    const inputs = this.state.userInputs();
    return Object.values(inputs).filter((v) => v && v.trim().length > 0).length;
  }

  getCatalogOverridesCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const overrides = this.state.envOverrides();
    return detail.editableEnv.filter((env) => {
      const current = overrides[env.name];
      if (current === undefined) return false;
      return current !== (env.default ?? '');
    }).length;
  }

  getCatalogSecretsCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const inputs = this.state.userInputs();
    return detail.userInputPrompts.filter(
      (p) => p.sensitive && (inputs[p.name] ?? '').length > 0,
    ).length;
  }

  readonly autoFqdnPreview = computed(() => {
    const caps = this.catalog.capabilities();
    const slug = this.state.catalogDetail()?.slug ?? 'your-app';
    const template = caps?.autoFqdnTemplate;
    if (template?.includes('{install-slug}')) {
      return template.replace('{install-slug}', `${slug}-xxxx`);
    }
    const zone = caps?.zoneName;
    return zone ? `${slug}-xxxx.${zone}` : `${slug}-xxxx`;
  });

  /** Preview of the internal URL the app will get once deployed.
   *  Uses internalHostTemplate from cluster capabilities; replaces {slug} with the
   *  slugified app name. Returns null when capabilities are not yet loaded. */
  readonly internalUrlPreview = computed<string | null>(() => {
    const template = this.catalog.capabilities()?.internalHostTemplate;
    if (!template) return null;
    const rawName = this.getApplicationName();
    const slug = rawName.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-').replaceAll(/^-+|-+$/g, '') || 'app';
    return 'https://' + template.replace('{slug}', slug);
  });

  readonly catalogAuthModeLabel = computed<string | null>(() => {
    const mode = this.state.catalogAuthMode();
    return mode ? catalogAuthLabel(mode) : null;
  });

  readonly enabledFeatureLabels = computed<string[]>(() =>
    this.state
      .catalogFeatureOptions()
      .filter((o) => this.state.catalogFeatureToggles()[o.key] ?? o.default)
      .map((o) => o.label),
  );

  // Deploy — dispatches on flowSubtype
  async deployApplication(): Promise<void> {
    if (!this.canComplete() || !this.canDeploy()) return;

    const cluster = this.selectedCluster();
    if (!cluster?.id) return;

    const sub = this.flowSubtype();

    // Flow A — Docker image
    if (sub === 'image') {
      this.isDeploying.set(true);
      this.deployError.set(null);
      try {
        const envVars = this.buildEnvVarsList();
        if (envVars === null) return;

        const response = await firstValueFrom(
          this.applicationsApi.applicationsControllerCreate(cluster.id, {
            name: this.getApplicationName(),
            category: CreateApplicationDto.CategoryEnum.User,
            kind: this.selectedKind() as CreateApplicationDto.KindEnum,
            sourceType: CreateApplicationDto.SourceTypeEnum.DockerImage,
            sourceConfig: {
              imageRef: this.selectedImageRef(),
              pullPolicy: 'IfNotPresent',
            },
            port: this.appPort() ?? undefined,
            replicas: this.appReplicas(),
            resourceProfile: this.selectedProfile() as CreateApplicationDto.ResourceProfileEnum,
            exposure: this.state.exposureMode(),
            env: envVars.map(v => ({ name: v.key, value: v.value, secret: v.isSecret })),
            autoDeploy: true,
            healthProbe: this.buildHealthProbe(),
          } as any)
        );

        if (response.operation?.id) {
          this.router.navigate(['/apps/deploy', response.operation.id], {
            queryParams: { appId: response.application.id },
          });
        } else {
          this.router.navigate(['/apps/applications', response.application.id]);
        }
      } catch (error) {
        console.error('Failed to start deployment:', error);
        const msg = internalHostingErrorMessage(error);
        this.deployError.set(msg ?? 'Failed to start deployment. Check logs for details.');
      } finally {
        this.isDeploying.set(false);
      }
      return;
    }

    // Flow B — Template
    if (sub === 'template') {
      this.isDeploying.set(true);
      this.deployError.set(null);
      try {
        // Sync cluster + env vars from local state into the service
        this.state.clusterId.set(cluster.id);
        this.state.envVars.set(this.envVars().map(v => ({ key: v.key, value: v.value, isSecret: v.isSecret })));

        const appId = await this.state.orchestrateTemplateFlow();
        if (appId) {
          // Small delay so the user can see the done state, then navigate to the monitor
          setTimeout(() => {
            this.router.navigate(['/apps/deploy/gha-build', appId]);
          }, 1200);
        }
      } catch (error) {
        const msg = internalHostingErrorMessage(error);
        if (msg) this.deployError.set(msg);
      } finally {
        this.isDeploying.set(false);
      }
      return;
    }

    // Flow C — Existing repo
    if (sub === 'existing-repo') {
      this.isDeploying.set(true);
      this.deployError.set(null);
      try {
        this.state.clusterId.set(cluster.id);
        this.state.envVars.set(this.envVars().map(v => ({ key: v.key, value: v.value, isSecret: v.isSecret })));

        const appId = await this.state.orchestrateExistingRepoFlow();
        if (appId) {
          setTimeout(() => {
            this.router.navigate(['/apps/deploy/gha-build', appId]);
          }, 1200);
        }
      } catch (error) {
        const msg = internalHostingErrorMessage(error);
        if (msg) this.deployError.set(msg);
      } finally {
        this.isDeploying.set(false);
      }
      return;
    }

    // Flow D — Marketplace
    if (sub === 'marketplace') {
      this.isDeploying.set(true);
      try {
        this.state.clusterId.set(cluster.id);
        await this.state.orchestrateMarketplaceFlow();
        // Success UI renders inline in the generate step when installPhase is 'running'
      } finally {
        this.isDeploying.set(false);
      }
      return;
    }
  }

  async retryMarketplaceConnect(): Promise<void> {
    this.isDeploying.set(true);
    try {
      await this.state.retryMarketplaceConnect();
    } finally {
      this.isDeploying.set(false);
    }
  }

  async inspectImagePorts(): Promise<void> {
    const imageRef = this.selectedImageRef();
    if (!imageRef || imageRef === this.portDiscoveredFrom()) return;

    this.portDiscovering.set(true);
    try {
      const result = await firstValueFrom(this.imagesApi.imagesControllerInspect(imageRef));
      this.portDiscoveredFrom.set(imageRef);
      this.exposedPorts.set(result.exposedPorts ?? []);

      // Only set port if user hasn't typed one manually yet
      if (this.appPort() === null && result.suggestedPort) {
        this.appPort.set(result.suggestedPort);
        this.portAutoDetected.set(true);
      }
    } catch {
      // Silent — leave port field empty for manual input
    } finally {
      this.portDiscovering.set(false);
    }
  }

  private buildHealthProbe(): object | null {
    const type = this.probeType();
    if (type === 'none') return { type: 'none' };
    if (type === 'http') return {
      type: 'http',
      httpPath: this.probeHttpPath(),
      httpPort: this.appPort() ?? undefined,
      initialDelaySeconds: this.probeInitialDelay(),
      periodSeconds: this.probePeriod(),
      failureThreshold: this.probeFailureThreshold(),
    };
    if (type === 'tcp') return {
      type: 'tcp',
      tcpPort: this.appPort() ?? undefined,
      initialDelaySeconds: this.probeInitialDelay(),
    };
    return null;
  }

  private buildEnvVarsList(): EnvironmentVariable[] | null {
    if (this.envMode() === 'key-value') {
      return this.envVars().filter((v) => v.key && v.value);
    }
    try {
      const json = JSON.parse(this.rawEnvJson());
      return Object.entries(json).map(([key, value]) => ({ key, value: String(value), isSecret: false }));
    } catch {
      return null;
    }
  }

}
