import { Component, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGitBranch,
  lucideGithub,
  lucideGitlab,
  lucideRefreshCw,
  lucideLoader,
  lucideCircleCheck,
  lucideCircleX,
  lucideCircleAlert,
  lucidePlus,
  lucideExternalLink,
  lucideStar,
  lucideGitFork,
  lucideCode,
  lucidePackage,
  lucideRocket,
  lucideSettings,
  lucideTrash,
  lucideDownload,
  lucideX,
  lucideSearch,
  lucideShieldAlert,
  lucideTriangleAlert,
  lucideArrowRight,
  lucideKey,
} from '@ng-icons/lucide';

import { RepositoryService, ConnectedRepository } from '../../service/repository.service';
import { GitProvider } from '../../model/application.models';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { GithubConnectComponent } from './github-connect.component';
import { GhcrPatModalComponent, GhcrPatModalMode } from './ghcr-pat-modal.component';
import { GithubAppOAuthService, PackagesPatStatus } from '../../../core/services/github-app-oauth.service';
import { ApplicationService } from '../../service/application.service';
import { ApplicationResponseDto } from '../../../core/api/model/applicationResponseDto';
import { RepoDeployChoiceModalComponent } from './repo-deploy-choice-modal.component';

@Component({
  selector: 'app-repositories-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, ConfirmationDialogComponent, GithubConnectComponent, GhcrPatModalComponent, RepoDeployChoiceModalComponent],
  providers: [
    provideIcons({
      lucideGitBranch,
      lucideGithub,
      lucideGitlab,
      lucideRefreshCw,
      lucideLoader,
      lucideCircleCheck,
      lucideCircleX,
      lucideCircleAlert,
      lucidePlus,
      lucideExternalLink,
      lucideStar,
      lucideGitFork,
      lucideCode,
      lucidePackage,
      lucideRocket,
      lucideSettings,
      lucideTrash,
      lucideDownload,
      lucideX,
      lucideSearch,
      lucideShieldAlert,
      lucideTriangleAlert,
      lucideArrowRight,
      lucideKey,
    }),
  ],
  template: `
    <!-- Success Toast -->
    @if (showSuccessToast()) {
      <div class="fixed top-4 right-4 z-50 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-lg animate-slide-in-right max-w-md">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <ng-icon name="lucideCircleCheck" class="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-green-900 dark:text-green-100">
              {{ successToastTitle() }}
            </h3>
            @if (successToastMessage()) {
              <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                {{ successToastMessage() }}
              </p>
            }
          </div>
          <button
            (click)="showSuccessToast.set(false)"
            class="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>
      </div>
    }

    <!-- Error Toast -->
    @if (showErrorToast()) {
      <div class="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg animate-slide-in-right max-w-md">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <ng-icon name="lucideCircleX" class="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-red-900 dark:text-red-100">
              {{ errorToastTitle() }}
            </h3>
            @if (errorToastMessage()) {
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                {{ errorToastMessage() }}
              </p>
            }
          </div>
          <button
            (click)="showErrorToast.set(false)"
            class="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>
      </div>
    }

    <!-- Warning Toast -->
    @if (showWarningToast()) {
      <div class="fixed top-4 right-4 z-50 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg animate-slide-in-right max-w-md">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <ng-icon name="lucideCircleAlert" class="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              Connection Cancelled
            </h3>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {{ warningToastMessage() }}
            </p>
          </div>
          <button
            (click)="showWarningToast.set(false)"
            class="flex-shrink-0 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
          >
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>
      </div>
    }

    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Git Repositories
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Connect and manage your Git repositories
          </p>
        </div>
        <div class="flex gap-3">
          @if (isGitHubConnected()) {
            <button
              (click)="showImportModal()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ng-icon name="lucideDownload" class="h-4 w-4" />
              <span class="text-sm font-medium">Import Repositories</span>
            </button>
          }
          <button
            (click)="refreshRepos()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-4 w-4"
              [class.animate-spin]="isLoading()"
            />
            <span class="text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      <!-- GitHub Integration Funnel -->
      @switch (pageState()) {

        @case ('initializing') {
          <div class="flex items-center justify-center py-16">
            <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }

        @case ('not-configured-admin') {
          <div class="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center">
            <div class="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <ng-icon name="lucideGithub" class="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              GitHub Integration Not Configured
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              As an admin, you need to set up the GitHub integration before users can connect their accounts.
            </p>
            <button
              (click)="navigateToSetup()"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <ng-icon name="lucideGithub" class="h-4 w-4" />
              Setup GitHub Integration
              <ng-icon name="lucideArrowRight" class="h-4 w-4" />
            </button>
          </div>
        }

        @case ('not-configured-user') {
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <ng-icon name="lucideShieldAlert" class="h-8 w-8 text-slate-500 dark:text-slate-400" />
            </div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              GitHub Not Yet Configured
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              GitHub integration hasn't been set up yet. Please contact your administrator to configure it.
            </p>
          </div>
        }

        @case ('misconfigured-admin') {
          <div class="bg-white dark:bg-slate-800 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-12 text-center">
            <div class="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <ng-icon name="lucideTriangleAlert" class="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              GitHub Integration Misconfigured
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-2 max-w-md mx-auto">
              Flui has stored GitHub App credentials but a live check against GitHub failed —
              the App may have been deleted or its private key revoked.
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 font-mono">
              {{ setupHealthError() }}
            </p>
            <button
              (click)="navigateToSetup()"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              <ng-icon name="lucideGithub" class="h-4 w-4" />
              Reconfigure GitHub Integration
              <ng-icon name="lucideArrowRight" class="h-4 w-4" />
            </button>
          </div>
        }

        @case ('misconfigured-user') {
          <div class="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl p-12 text-center">
            <div class="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <ng-icon name="lucideTriangleAlert" class="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              GitHub Integration Broken
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              Connecting to GitHub is currently failing. Please contact your administrator to reconfigure the integration.
            </p>
          </div>
        }

        @case ('not-connected') {
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <app-github-connect
              [authMethod]="setupStatus()!.authMethod!"
              [appSlug]="setupStatus()?.appSlug"
              (connected)="onGithubConnected($event)"
            />
          </div>
        }

        @case ('connected') {
          <!-- Connected: show GitHub status bar + existing repos UI -->
          <div class="flex items-center justify-between bg-green-50 dark:bg-slate-800 border border-green-200 dark:border-slate-700 rounded-lg px-4 py-3">
            <div class="flex items-center gap-3">
              <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-green-600 dark:text-emerald-500" />
              <div>
                @if (setupStatus()?.authMethod === 'github_app') {
                  <span class="text-sm font-medium text-green-900 dark:text-slate-200">GitHub App Connected</span>
                } @else {
                  <span class="text-sm font-medium text-green-900 dark:text-slate-200">GitHub Connected</span>
                  @if (gitHubUsername()) {
                    <span class="text-sm text-green-700 dark:text-slate-400 ml-2">as {{ '@' + gitHubUsername() }}</span>
                  }
                }
              </div>
            </div>
            @if (setupStatus()?.authMethod === 'github_app') {
              <a
                [href]="githubAppConfigUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage permissions
                <ng-icon name="lucideExternalLink" class="h-3 w-3" />
              </a>
            } @else {
              <button
                (click)="disconnectOAuth('github')"
                class="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Disconnect
              </button>
            }
          </div>

          @if (setupStatus()?.authMethod === 'github_app') {
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div class="flex items-center gap-3 min-w-0">
                <ng-icon name="lucideKey" class="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-900 dark:text-slate-100">
                    GHCR Container Registry token
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    @if (patStatus(); as p) {
                      @if (!p.configured) {
                        <span>Not configured — required to pull container images.</span>
                      } @else {
                        <span [class]="patStatusColor()">{{ patStatusLabel() }}</span>
                        @if (p.expiresAt) {
                          <span>· expires {{ formatDate(p.expiresAt) }}</span>
                        }
                        @if (p.daysUntilExpiry != null && p.daysUntilExpiry >= 0) {
                          <span class="text-slate-400">({{ p.daysUntilExpiry }}d)</span>
                        }
                      }
                    } @else {
                      <span>Loading…</span>
                    }
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                @if (patStatus()?.configured) {
                  <button
                    (click)="openPatModal('update-expiry')"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Update expiry
                  </button>
                  <button
                    (click)="openPatModal('rotate')"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <ng-icon name="lucideRefreshCw" class="h-3 w-3" />
                    Rotate
                  </button>
                  <button
                    (click)="confirmRemovePat()"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                  >
                    Remove
                  </button>
                } @else {
                  <button
                    (click)="openPatModal('create')"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <ng-icon name="lucideKey" class="h-3 w-3" />
                    Add token
                  </button>
                }
              </div>
            </div>
          }
        }

      }

      <!-- Stats + Repos: only shown when GitHub is connected -->
      @if (pageState() === 'connected') {

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Total Repositories</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ allRepos().length }}</p>
            </div>
            <ng-icon name="lucideGitBranch" class="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div class="bg-green-50 dark:bg-slate-800 border border-green-200 dark:border-slate-700 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-green-600 dark:text-slate-400">Connected</p>
              <p class="text-2xl font-bold text-green-900 dark:text-emerald-400">{{ connectedCount() }}</p>
            </div>
            <ng-icon name="lucideCircleCheck" class="h-8 w-8 text-green-500 dark:text-emerald-500/60" />
          </div>
        </div>
        <div class="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-blue-600 dark:text-slate-400">Auto-deploy Enabled</p>
              <p class="text-2xl font-bold text-blue-900 dark:text-sky-400">{{ autoDeployCount() }}</p>
            </div>
            <ng-icon name="lucideRocket" class="h-8 w-8 text-blue-500 dark:text-sky-500/60" />
          </div>
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex items-center justify-center py-12">
          <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }

      <!-- Error State -->
      @if (errorMessage() && !isLoading()) {
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
            <p class="text-sm text-red-900 dark:text-red-200">{{ errorMessage() }}</p>
          </div>
        </div>
      }

      <!-- Repositories List -->
      @if (!isLoading()) {
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Imported Repositories</h2>
          </div>

          @if (allRepos().length === 0) {
            <div class="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
              <ng-icon name="lucideGitBranch" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No repositories imported yet
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                @if (isGitHubConnected()) {
                  Import repositories from GitHub to get started
                } @else {
                  Connect your GitHub account to import repositories
                }
              </p>
              @if (isGitHubConnected()) {
                <button
                  (click)="showImportModal()"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                  Import Repositories
                </button>
              }
            </div>
          }

          <div class="grid grid-cols-1 gap-4">
            @for (repo of allRepos(); track repo.id) {
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <!-- Header -->
                    <div class="flex items-center gap-3 mb-3">
                      <ng-icon
                        [name]="repo.provider === 'github' ? 'lucideGithub' : 'lucideGitlab'"
                        class="h-5 w-5"
                        [class]="repo.provider === 'github' ? 'text-gray-900 dark:text-white' : 'text-orange-600'"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                            {{ repo.fullName }}
                          </h3>
                          @if (repo.private) {
                            <span class="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                              Private
                            </span>
                          }
                        </div>
                        @if (repo.description) {
                          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {{ repo.description }}
                          </p>
                        }
                      </div>
                    </div>

                    <!-- Metadata -->
                    <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      @if (repo.language) {
                        <span class="flex items-center gap-1">
                          <ng-icon name="lucideCode" class="h-4 w-4" />
                          {{ repo.language }}
                        </span>
                      }
                      <span class="flex items-center gap-1">
                        <ng-icon name="lucideGitBranch" class="h-4 w-4" />
                        {{ repo.branch }}
                      </span>
                      @if (repo.detectedFramework) {
                        <span class="flex items-center gap-1">
                          <ng-icon name="lucidePackage" class="h-4 w-4" />
                          {{ getFrameworkLabel(repo.detectedFramework) }}
                        </span>
                      }
                    </div>

                    <!-- Status Badges -->
                    <div class="flex items-center gap-2 mb-4">
                      @if (repo.connected) {
                        <span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-slate-700 dark:text-emerald-400">
                          Imported
                        </span>
                      }
                      @if (repo.webhookEnabled) {
                        <span class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-slate-700 dark:text-sky-400">
                          Webhook Active
                        </span>
                      }
                      @if (repo.autoDeployEnabled) {
                        <span class="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-slate-700 dark:text-violet-400">
                          Auto-deploy
                        </span>
                      }
                    </div>

                    <!-- Last imported -->
                    @if (repo.connectedAt) {
                      <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        Imported {{ formatDate(repo.connectedAt) }}
                      </div>
                    }
                  </div>

                  <!-- Actions -->
                  <div class="flex flex-col gap-2 ml-4">
                    <a
                      [href]="repo.url"
                      target="_blank"
                      class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ng-icon name="lucideExternalLink" class="h-4 w-4" />
                      View
                    </a>
                    <button
                      (click)="deployFromRepo(repo)"
                      [disabled]="isCheckingApps()"
                      class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      @if (isCheckingApps()) {
                        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                      } @else {
                        <ng-icon name="lucideRocket" class="h-4 w-4" />
                      }
                      Deploy
                    </button>
                    <button
                      (click)="confirmDelete(repo)"
                      class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <ng-icon name="lucideTrash" class="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    } <!-- end @if (pageState() === 'connected') -->
    </div>

    <!-- Import Repositories Modal -->
    @if (showImportModalFlag()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Import Repositories from GitHub
            </h3>
            <button
              (click)="closeImportModal()"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ng-icon name="lucideX" class="h-5 w-5" />
            </button>
          </div>

          <!-- Search Bar -->
          <div class="px-6 pt-4">
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <ng-icon name="lucideSearch" class="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search repositories by name, description, or language..."
                class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              @if (searchQuery()) {
                <button
                  (click)="searchQuery.set('')"
                  class="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  <ng-icon name="lucideX" class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
              }
            </div>
          </div>

          <!-- Modal Body -->
          <div class="p-6 overflow-y-auto max-h-[50vh]">
            @if (isLoadingAvailable()) {
              <div class="flex items-center justify-center py-12">
                <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-blue-600" />
                <span class="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading repositories...</span>
              </div>
            } @else if (availableRepos().length === 0) {
              <div class="text-center py-12 space-y-3">
                <ng-icon name="lucideGitBranch" class="h-12 w-12 text-gray-400 mx-auto" />
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  No repositories found
                </p>
                @if (!hideRepoHint()) {
                  @if (setupStatus()?.authMethod === 'github_app') {
                    <div class="relative inline-flex flex-col items-start gap-1.5 text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mx-auto max-w-sm">
                      <button
                        (click)="hideRepoHint.set(true)"
                        class="absolute top-2 right-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                        aria-label="Dismiss"
                      >
                        <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                      </button>
                      <div class="flex items-center gap-1.5 text-xs font-medium text-blue-800 dark:text-blue-300 pr-4">
                        <ng-icon name="lucideGithub" class="h-3.5 w-3.5" />
                        Manage repository access
                      </div>
                      <p class="text-xs text-blue-700 dark:text-blue-400">
                        The Flui GitHub App can only see repositories you've granted access to during installation.
                        To add more repositories, update the app's permissions on GitHub.
                      </p>
                      <div class="flex items-center gap-3 mt-0.5">
                        <a
                          [href]="githubAppConfigUrl()"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Configure repository access
                          <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                        </a>
                        <span class="text-blue-300 dark:text-blue-700">·</span>
                        <button
                          (click)="refreshAvailableRepos()"
                          [disabled]="isLoadingAvailable()"
                          class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                        >
                          <ng-icon [name]="isLoadingAvailable() ? 'lucideLoader' : 'lucideRefreshCw'" class="h-3 w-3" [class.animate-spin]="isLoadingAvailable()" />
                          Retry
                        </button>
                      </div>
                    </div>
                  } @else if (setupStatus()?.authMethod === 'pat') {
                    <div class="relative inline-flex flex-col items-start gap-1.5 text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mx-auto max-w-sm">
                      <button
                        (click)="hideRepoHint.set(true)"
                        class="absolute top-2 right-2 text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200"
                        aria-label="Dismiss"
                      >
                        <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                      </button>
                      <div class="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 pr-4">
                        <ng-icon name="lucideKey" class="h-3.5 w-3.5" />
                        Check your token permissions
                      </div>
                      <p class="text-xs text-amber-700 dark:text-amber-400">
                        Make sure your Personal Access Token has the
                        <code class="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">repo</code>
                        scope to access your repositories.
                      </p>
                      <div class="flex items-center gap-3 mt-0.5">
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline"
                        >
                          Manage tokens on GitHub
                          <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                        </a>
                        <span class="text-amber-300 dark:text-amber-700">·</span>
                        <button
                          (click)="refreshAvailableRepos()"
                          [disabled]="isLoadingAvailable()"
                          class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
                        >
                          <ng-icon [name]="isLoadingAvailable() ? 'lucideLoader' : 'lucideRefreshCw'" class="h-3 w-3" [class.animate-spin]="isLoadingAvailable()" />
                          Retry
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="relative inline-flex flex-col items-start gap-1.5 text-left bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 mx-auto max-w-sm">
                      <button
                        (click)="hideRepoHint.set(true)"
                        class="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label="Dismiss"
                      >
                        <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                      </button>
                      <p class="text-xs text-gray-500 dark:text-gray-400 pr-4">
                        No repositories accessible via your connected GitHub account.
                        Try disconnecting and reconnecting, or check that your OAuth App has the correct permissions.
                      </p>
                    </div>
                  }
                }
              </div>
            } @else if (filteredAvailableRepos().length === 0) {
              <div class="text-center py-12 space-y-3">
                <ng-icon name="lucideSearch" class="h-12 w-12 text-gray-400 mx-auto" />
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  No repositories match your search
                </p>
                <button
                  (click)="searchQuery.set('')"
                  class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Clear search
                </button>
                @if (setupStatus()?.authMethod === 'github_app') {
                  <p class="text-xs text-gray-500 dark:text-gray-400 pt-2">
                    Can't find a repository?
                    <a
                      [href]="githubAppConfigUrl()"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Update repository access on GitHub
                      <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                    </a>
                  </p>
                }
              </div>
            } @else {
              <div class="space-y-3">
                @for (repo of filteredAvailableRepos(); track repo.id) {
                  <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div class="flex items-start justify-between">
                      <div class="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          [checked]="selectedReposForImport().includes(repo.fullName)"
                          (change)="toggleRepoSelection(repo.fullName)"
                          [disabled]="repo.isImported"
                          class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <h4 class="font-medium text-gray-900 dark:text-white">
                              {{ repo.fullName }}
                            </h4>
                            @if (repo.private) {
                              <span class="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                Private
                              </span>
                            }
                            @if (repo.isImported) {
                              <span class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-slate-700 dark:text-emerald-400">
                                Already imported
                              </span>
                            }
                          </div>
                          @if (repo.description) {
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {{ repo.description }}
                            </p>
                          }
                          <div class="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            @if (repo.language) {
                              <span>{{ repo.language }}</span>
                            }
                            <span>{{ repo.defaultBranch }}</span>
                            <span>Updated {{ formatDate(repo.updatedAt) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Modal Footer - Fixed at bottom, always visible -->
          <div class="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ selectedReposForImport().length }} repository(ies) selected
              @if (searchQuery()) {
                <span class="ml-2 text-gray-500">
                  ({{ filteredAvailableRepos().length }} of {{ availableRepos().length }} shown)
                </span>
              }
            </div>
            <div class="flex gap-3">
              <button
                (click)="closeImportModal()"
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                (click)="importSelected()"
                [disabled]="selectedReposForImport().length === 0 || isImporting()"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                @if (isImporting()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                  Importing...
                } @else {
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                  Import Selected
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModalFlag()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <ng-icon name="lucideCircleAlert" class="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Remove Repository
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to remove <strong>{{ repoToDelete()?.fullName }}</strong>?
                This will disconnect the repository from Flui.cloud but won't delete it from GitHub.
              </p>
              <div class="flex items-center gap-3">
                <button
                  (click)="cancelDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  (click)="executeDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  @if (isDeleting()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Removing...
                  } @else {
                    <ng-icon name="lucideTrash" class="h-4 w-4" />
                    Remove
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Disconnect OAuth Confirmation Dialog -->
    <app-confirmation-dialog
      #disconnectDialog
      [title]="'Disconnect ' + (providerToDisconnect() === 'github' ? 'GitHub' : 'GitLab')"
      [message]="'Are you sure you want to disconnect ' + (providerToDisconnect() === 'github' ? 'GitHub' : 'GitLab') + '? This will remove all imported repositories from this provider.'"
      confirmText="Disconnect"
      variant="danger"
      (confirmed)="executeDisconnect()"
      (cancelled)="cancelDisconnect()"
    />

    <!-- Remove PAT Confirmation -->
    <app-confirmation-dialog
      #removePatDialog
      title="Remove GHCR token"
      message="Removing this token will prevent Flui from pulling private container images from GHCR. You can add a new token at any time."
      confirmText="Remove"
      variant="danger"
      (confirmed)="executeRemovePat()"
    />

    @if (patModalMode()) {
      <app-ghcr-pat-modal
        [mode]="patModalMode()!"
        [initialExpiresAt]="patStatus()?.expiresAt"
        (cancelled)="patModalMode.set(null)"
        (saved)="onPatSaved()"
      />
    }

    @if (deployChoiceRepo(); as choiceRepo) {
      <app-repo-deploy-choice-modal
        [repo]="{ id: choiceRepo.id, fullName: choiceRepo.fullName }"
        [matchedApps]="deployChoiceApps()"
        (closed)="closeDeployChoice()"
        (triggerBuild)="onTriggerBuildForApp($event)"
        (createNewApp)="onCreateNewAppFromChoice()"
      />
    }
  `,
})
export class RepositoriesListComponent implements OnInit {
  private readonly repoService = inject(RepositoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly appService = inject(ApplicationService);

  @ViewChild('disconnectDialog') disconnectDialog!: ConfirmationDialogComponent;
  @ViewChild('removePatDialog') removePatDialog!: ConfirmationDialogComponent;
  private readonly oauthApi = inject(GithubAppOAuthService);

  // Deploy choice modal state (when a repo already has an app)
  readonly deployChoiceRepo = signal<ConnectedRepository | null>(null);
  readonly deployChoiceApps = signal<ApplicationResponseDto[]>([]);
  readonly isCheckingApps = signal(false);

  // Data from service
  allRepos = this.repoService.repositories;
  availableRepos = this.repoService.availableRepositories;
  isLoading = this.repoService.loading;
  errorMessage = this.repoService.errorMessage;
  isGitHubConnected = this.repoService.isGitHubConnected;
  isGitLabConnected = this.repoService.isGitLabConnected;
  connectedCount = this.repoService.connectedCount;
  setupStatus = this.repoService.setupStatus;

  private readonly isAdmin = signal(true);

  // Funnel page state
  readonly isInitializing = signal(true);

  readonly setupHealth = this.repoService.setupHealth;

  readonly pageState = computed<'initializing' | 'not-configured-admin' | 'not-configured-user' | 'misconfigured-admin' | 'misconfigured-user' | 'not-connected' | 'connected'>(() => {
    if (this.isInitializing()) return 'initializing';
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
    const details = this.setupHealth()?.details as
      | { error?: string; message?: string }
      | undefined;
    return details?.message ?? details?.error ?? 'unreachable';
  });

  // Computed
  autoDeployCount = computed(() =>
    this.allRepos().filter(r => r.autoDeployEnabled).length
  );

  gitHubUsername = computed(() => {
    const status = this.repoService.oauth().get(GitProvider.GitHub);
    return status?.username;
  });

  githubAppConfigUrl = computed(() => {
    const raw = this.setupStatus()?.appSlug || '';
    const slug = raw.replace(/.*\/apps\//, '').replace(/\/.*$/, '') || 'flui-cloud';
    return `https://github.com/apps/${slug}/installations/new`;
  });

  // Filtered repositories based on search query
  filteredAvailableRepos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.availableRepos();

    return this.availableRepos().filter(repo => {
      const fullNameMatch = repo.fullName.toLowerCase().includes(query);
      const descriptionMatch = repo.description?.toLowerCase().includes(query) || false;
      const languageMatch = repo.language?.toLowerCase().includes(query) || false;
      return fullNameMatch || descriptionMatch || languageMatch;
    });
  });

  // Local state
  showImportModalFlag = signal(false);
  isLoadingAvailable = signal(false);
  selectedReposForImport = signal<string[]>([]); // Store repository fullNames (owner/repo format)
  isImporting = signal(false);
  searchQuery = signal('');
  hideRepoHint = signal(false);

  showDeleteModalFlag = signal(false);
  repoToDelete = signal<ConnectedRepository | null>(null);
  isDeleting = signal(false);

  // OAuth disconnect dialog state
  providerToDisconnect = signal<'github' | 'gitlab' | null>(null);

  // OAuth connect loading state
  isConnecting = signal(false);

  // Toast notifications
  showSuccessToast = signal(false);
  successToastTitle = signal('Success');
  successToastMessage = signal('');
  showErrorToast = signal(false);
  errorToastTitle = signal('Error');
  errorToastMessage = signal('');
  showWarningToast = signal(false);
  warningToastMessage = signal('');

  // GHCR PAT state
  patStatus = signal<PackagesPatStatus | null>(null);
  patModalMode = signal<GhcrPatModalMode | null>(null);

  patStatusLabel = computed(() => {
    const s = this.patStatus()?.status;
    switch (s) {
      case 'VALID': return 'Valid';
      case 'EXPIRING_SOON': return 'Expiring soon';
      case 'EXPIRED': return 'Expired';
      case 'INVALID': return 'Invalid';
      case 'UNKNOWN_EXPIRY': return 'Expiration unknown';
      case 'MISSING': return 'Not configured';
      default: return this.patStatus()?.configured ? 'Configured' : 'Not configured';
    }
  });

  patStatusColor = computed(() => {
    const s = this.patStatus()?.status;
    switch (s) {
      case 'VALID': return 'text-emerald-600 dark:text-emerald-400 font-medium';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY': return 'text-amber-600 dark:text-amber-400 font-medium';
      case 'EXPIRED':
      case 'INVALID': return 'text-red-600 dark:text-red-400 font-medium';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  });

  ngOnInit(): void {
    void (async () => {
      // Check for OAuth callback
      this.route.queryParams.pipe(take(1)).subscribe(async params => {
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
        this.loadPatStatus();
      }

      this.isInitializing.set(false);
    })();
  }

  async loadPatStatus(): Promise<void> {
    try {
      this.patStatus.set(await this.oauthApi.getPackagesPatStatus());
    } catch {
      this.patStatus.set({ configured: false, status: 'MISSING' });
    }
  }

  openPatModal(mode: GhcrPatModalMode): void {
    this.patModalMode.set(mode);
  }

  async onPatSaved(): Promise<void> {
    this.patModalMode.set(null);
    await this.loadPatStatus();
    this.successToastTitle.set('GHCR token updated');
    this.successToastMessage.set('Your container registry token has been saved.');
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 4000);
  }

  confirmRemovePat(): void {
    this.removePatDialog.open();
  }

  async executeRemovePat(): Promise<void> {
    this.removePatDialog.setProcessing(true);
    try {
      await this.oauthApi.deletePackagesPat();
      await this.loadPatStatus();
      this.removePatDialog.close();
      this.successToastTitle.set('GHCR token removed');
      this.successToastMessage.set('');
      this.showSuccessToast.set(true);
      setTimeout(() => this.showSuccessToast.set(false), 4000);
    } catch (err: any) {
      this.removePatDialog.setProcessing(false);
      this.errorToastTitle.set('Could not remove token');
      this.errorToastMessage.set(err?.error?.message || err?.message || '');
      this.showErrorToast.set(true);
      setTimeout(() => this.showErrorToast.set(false), 5000);
    }
  }

  navigateToSetup(): void {
    this.router.navigate(['/apps/repositories/github-setup']);
  }

  async onGithubConnected(event: { username: string }): Promise<void> {
    await this.repoService.checkOAuthStatus();
    await this.loadRepos();
    this.successToastTitle.set('GitHub Connected!');
    this.successToastMessage.set(`Connected as @${event.username}`);
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 5000);
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

  /**
   * Handle successful OAuth callback
   */
  private async handleOAuthSuccess() {
    // Show success notification
    this.successToastTitle.set('GitHub Connected Successfully!');
    this.successToastMessage.set('Your GitHub account is now connected. You can import repositories below.');
    this.showSuccessToast.set(true);

    // Refresh OAuth status
    await this.repoService.checkOAuthStatus();

    // Reload repositories
    await this.loadRepos();

    // Clean URL (remove query params)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });

    // Auto-hide toast after 5 seconds
    setTimeout(() => this.showSuccessToast.set(false), 5000);
  }

  /**
   * Handle OAuth error callback
   */
  private handleOAuthError(error: string) {
    console.error('❌ OAuth error:', error);

    // Check if user cancelled/denied access
    if (error === 'access_denied') {
      // Show warning notification for access denied
      this.warningToastMessage.set('You cancelled the GitHub connection. To connect your account, please try again and authorize the application.');
      this.showWarningToast.set(true);

      // Auto-hide toast after 8 seconds
      setTimeout(() => this.showWarningToast.set(false), 8000);
    } else {
      // Show error notification for other errors
      this.errorToastTitle.set('GitHub Connection Failed');
      this.errorToastMessage.set(error || 'Failed to connect GitHub account');
      this.showErrorToast.set(true);

      // Auto-hide toast after 10 seconds
      setTimeout(() => this.showErrorToast.set(false), 10000);
    }

    // Clean URL (remove query params)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  disconnectOAuth(provider: 'github' | 'gitlab') {
    this.providerToDisconnect.set(provider);
    this.disconnectDialog.open();
  }

  async executeDisconnect() {
    const provider = this.providerToDisconnect();
    if (!provider) return;

    this.disconnectDialog.setProcessing(true);

    try {
      const gitProvider = provider === 'github' ? GitProvider.GitHub : GitProvider.GitLab;
      await this.repoService.disconnectOAuth(gitProvider);
      await this.loadRepos();

      this.disconnectDialog.close();
      this.providerToDisconnect.set(null);
    } catch (error) {
      console.error('Failed to disconnect OAuth:', error);
      this.disconnectDialog.setProcessing(false);
    }
  }

  cancelDisconnect() {
    this.providerToDisconnect.set(null);
  }

  async showImportModal() {
    this.showImportModalFlag.set(true);
    this.selectedReposForImport.set([]);
    this.hideRepoHint.set(false);

    // Load available repositories
    this.isLoadingAvailable.set(true);
    try {
      await this.repoService.loadAvailableRepositories();
    } catch (error) {
      console.error('Failed to load available repositories:', error);
    } finally {
      this.isLoadingAvailable.set(false);
    }
  }

  closeImportModal() {
    this.showImportModalFlag.set(false);
    this.selectedReposForImport.set([]);
    this.searchQuery.set('');
  }

  async refreshAvailableRepos(): Promise<void> {
    this.isLoadingAvailable.set(true);
    try {
      await this.repoService.loadAvailableRepositories();
    } catch {
      // error already handled in service
    } finally {
      this.isLoadingAvailable.set(false);
    }
  }

  toggleRepoSelection(repoFullName: string) {
    this.selectedReposForImport.update(selected => {
      if (selected.includes(repoFullName)) {
        return selected.filter(r => r !== repoFullName);
      } else {
        return [...selected, repoFullName];
      }
    });
  }

  async importSelected() {
    const selected = this.selectedReposForImport();
    if (selected.length === 0) return;

    this.isImporting.set(true);
    try {
      const response = await this.repoService.importRepositories(selected, false);

      // Interpret the response
      const { imported, failed, errors } = response;
      const total = selected.length;

      // Case 1: All repositories imported successfully
      if (imported === total && failed === 0) {
        this.closeImportModal();
        await this.loadRepos();

        this.successToastTitle.set('Import Successful');
        this.successToastMessage.set(`${imported} ${imported === 1 ? 'repository' : 'repositories'} imported successfully.`);
        this.showSuccessToast.set(true);
        setTimeout(() => this.showSuccessToast.set(false), 5000);
      }
      // Case 2: All repositories failed to import
      else if (imported === 0 && failed === total) {
        // Keep modal open, show error
        const errorList = errors && errors.length > 0
          ? errors.join('\n• ')
          : 'All repositories failed to import.';

        this.errorToastTitle.set('Import Failed');
        this.errorToastMessage.set(`All ${failed} ${failed === 1 ? 'repository' : 'repositories'} failed to import:\n• ${errorList}`);
        this.showErrorToast.set(true);
        setTimeout(() => this.showErrorToast.set(false), 15000);
      }
      // Case 3: Partial success - some imported, some failed
      else if (imported > 0 && failed > 0) {
        // Close modal and reload to show imported ones
        this.closeImportModal();
        await this.loadRepos();

        // Show warning toast with details
        const errorList = errors && errors.length > 0
          ? '\n\nErrors:\n• ' + errors.join('\n• ')
          : '';

        this.warningToastMessage.set(
          `Partial import completed:\n` +
          `✓ ${imported} ${imported === 1 ? 'repository' : 'repositories'} imported successfully\n` +
          `✗ ${failed} ${failed === 1 ? 'repository' : 'repositories'} failed${errorList}`
        );
        this.showWarningToast.set(true);
        setTimeout(() => this.showWarningToast.set(false), 15000);
      }

    } catch (error: any) {
      console.error('Failed to import repositories:', error);

      // Network/API error: keep modal open and show error toast
      const errorMessage = error?.error?.message || error?.message || 'An unexpected error occurred while importing repositories.';
      this.errorToastTitle.set('Import Failed');
      this.errorToastMessage.set(errorMessage);
      this.showErrorToast.set(true);

      // Auto-hide toast after 10 seconds
      setTimeout(() => this.showErrorToast.set(false), 10000);
    } finally {
      this.isImporting.set(false);
    }
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

  async deployFromRepo(repo: ConnectedRepository) {
    if (this.isCheckingApps()) return;
    this.isCheckingApps.set(true);
    try {
      if (this.appService.applications().length === 0) {
        await this.appService.loadApplications();
      }
      const matched = this.appService.applications().filter(app =>
        app.sourceType === ApplicationResponseDto.SourceTypeEnum.GitBuild &&
        (app.sourceConfig as { repositoryId?: string } | undefined)?.repositoryId === repo.id
      );

      if (matched.length === 0) {
        this.navigateToDeployWizard(repo);
        return;
      }

      this.deployChoiceApps.set(matched);
      this.deployChoiceRepo.set(repo);
    } finally {
      this.isCheckingApps.set(false);
    }
  }

  private navigateToDeployWizard(repo: ConnectedRepository) {
    this.router.navigate(['/apps/deploy/new'], {
      queryParams: { repoId: repo.id }
    });
  }

  closeDeployChoice() {
    this.deployChoiceRepo.set(null);
    this.deployChoiceApps.set([]);
  }

  onTriggerBuildForApp(appId: string) {
    this.closeDeployChoice();
    this.router.navigate(['/apps/applications', appId, 'builds']);
  }

  onCreateNewAppFromChoice() {
    const repo = this.deployChoiceRepo();
    this.closeDeployChoice();
    if (repo) this.navigateToDeployWizard(repo);
  }

  getFrameworkLabel(framework: string): string {
    const labels: Record<string, string> = {
      nextjs: 'Next.js',
      angular: 'Angular',
      react: 'React',
      vue: 'Vue.js',
      nestjs: 'NestJS',
      nuxt: 'Nuxt',
    };
    return labels[framework] || framework;
  }

  formatDate(date: string): string {
    // Normalize to UTC: if the string has no timezone indicator, append 'Z'
    const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(date) ? date : date + 'Z';
    const then = new Date(normalized);
    const diffMs = Date.now() - then.getTime();

    if (diffMs < 60_000) return 'just now';

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffMins  = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays  = Math.floor(diffMs / 86_400_000);

    if (diffMins  < 60) return rtf.format(-diffMins,  'minute');
    if (diffHours < 24) return rtf.format(-diffHours, 'hour');
    if (diffDays  <  7) return rtf.format(-diffDays,  'day');
    return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
