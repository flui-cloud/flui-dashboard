import { Component, Input, OnChanges, SimpleChanges, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRocket,
  lucideTriangleAlert,
  lucideCheckCircle,
  lucideLoader,
  lucideExternalLink,
  lucideRotateCcw,
  lucideArrowRight,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';

import { AppReleaseService } from '../../service/app-release.service';
import { ApplicationReleaseDto } from '../../../core/api/model/applicationReleaseDto';
import { AppBuildsService } from '../../../core/api/api/appBuilds.service';

type ReleaseStatus = ApplicationReleaseDto.StatusEnum;

@Component({
  selector: 'app-latest-release-card',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideRocket,
      lucideTriangleAlert,
      lucideCheckCircle,
      lucideLoader,
      lucideExternalLink,
      lucideRotateCcw,
      lucideArrowRight,
      lucideRefreshCw,
    }),
  ],
  template: `
    @if (release(); as r) {
      <div
        class="rounded-lg border px-4 py-3"
        [class]="containerClass(r.status)"
      >
        <div class="flex items-start gap-3">
          <ng-icon [name]="iconFor(r.status)" class="h-5 w-5 flex-shrink-0 mt-0.5" [class]="iconClass(r.status)" [class.animate-spin]="r.status === 'IN_PROGRESS'" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold">{{ titleFor(r.status) }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium" [class]="badgeClass(r.status)">
                {{ statusLabel(r.status) }}
              </span>
              @if (r.startedAt) {
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  · {{ formatDate(r.startedAt) }}
                </span>
              }
            </div>

            <!-- Image diff -->
            @if (r.imageRef || r.previousImageRef) {
              <div class="mt-2 flex items-center gap-2 text-xs font-mono flex-wrap min-w-0">
                @if (r.previousImageRef && r.previousImageRef !== r.imageRef) {
                  <span class="text-gray-500 dark:text-gray-400 truncate" [title]="r.previousImageRef">
                    {{ shortImage(r.previousImageRef) }}
                  </span>
                  <ng-icon name="lucideArrowRight" class="h-3 w-3 text-gray-400 flex-shrink-0" />
                }
                @if (r.imageRef) {
                  <span class="font-medium truncate" [title]="r.imageRef">
                    {{ shortImage(r.imageRef) }}
                  </span>
                }
              </div>
            }

            <!-- Failure reason -->
            @if (r.status === 'FAILED' && r.failureReason) {
              <p class="mt-2 text-xs whitespace-pre-wrap break-words text-red-700 dark:text-red-300">
                {{ r.failureReason }}
              </p>
            }

            <!-- Action row -->
            <div class="mt-3 flex items-center gap-3 flex-wrap">
              @if (buildExternalUrl(); as url) {
                <a
                  [href]="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  View build on GitHub
                </a>
              }
              <a
                [routerLink]="['/apps/applications', r.applicationId, 'releases']"
                class="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Release history
              </a>
              @if (r.status === 'FAILED') {
                <a
                  [routerLink]="['/apps/applications', r.applicationId, 'revisions']"
                  class="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
                >
                  <ng-icon name="lucideRotateCcw" class="h-3 w-3" />
                  Rollback
                </a>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppLatestReleaseCardComponent implements OnChanges {
  @Input({ required: true }) appId!: string;

  private readonly releaseService = inject(AppReleaseService);
  private readonly buildsApi = inject(AppBuildsService);

  release = this.releaseService.currentRelease;
  private readonly buildExternalUrlSig = signal<string | null>(null);
  buildExternalUrl = computed(() => this.buildExternalUrlSig());

  private currentBuildIdLoaded: string | null = null;

  constructor() {
    effect(() => {
      const buildId = this.release()?.buildId ?? null;
      this.maybeLoadBuildUrl(buildId);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appId'] && this.appId) {
      this.releaseService.loadCurrent(this.appId);
      this.releaseService.subscribe(this.appId);
    }
  }

  private async maybeLoadBuildUrl(buildId: string | null): Promise<void> {
    if (!buildId) {
      this.buildExternalUrlSig.set(null);
      this.currentBuildIdLoaded = null;
      return;
    }
    if (this.currentBuildIdLoaded === buildId) return;
    this.currentBuildIdLoaded = buildId;
    try {
      const build = await firstValueFrom(this.buildsApi.appBuildsControllerGetBuild(buildId));
      this.buildExternalUrlSig.set(build?.externalUrl ?? null);
    } catch {
      this.buildExternalUrlSig.set(null);
    }
  }

  containerClass(status: ReleaseStatus): string {
    switch (status) {
      case 'FAILED':
        return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
      case 'IN_PROGRESS':
        return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800';
      case 'ROLLED_BACK':
        return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800';
      case 'SUCCEEDED':
      default:
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  }

  iconClass(status: ReleaseStatus): string {
    switch (status) {
      case 'FAILED': return 'text-red-600 dark:text-red-400';
      case 'IN_PROGRESS': return 'text-blue-600 dark:text-blue-400';
      case 'ROLLED_BACK': return 'text-amber-600 dark:text-amber-400';
      case 'SUCCEEDED':
      default: return 'text-green-600 dark:text-green-400';
    }
  }

  iconFor(status: ReleaseStatus): string {
    switch (status) {
      case 'FAILED': return 'lucideTriangleAlert';
      case 'IN_PROGRESS': return 'lucideLoader';
      case 'ROLLED_BACK': return 'lucideRotateCcw';
      case 'SUCCEEDED':
      default: return 'lucideCheckCircle';
    }
  }

  titleFor(status: ReleaseStatus): string {
    switch (status) {
      case 'FAILED': return 'Last release failed';
      case 'IN_PROGRESS': return 'Release in progress';
      case 'ROLLED_BACK': return 'Rolled back';
      case 'SUCCEEDED':
      default: return 'Latest release';
    }
  }

  statusLabel(status: ReleaseStatus): string {
    switch (status) {
      case 'IN_PROGRESS': return 'In progress';
      case 'SUCCEEDED': return 'Succeeded';
      case 'FAILED': return 'Failed';
      case 'ROLLED_BACK': return 'Rolled back';
      default: return status;
    }
  }

  badgeClass(status: ReleaseStatus): string {
    switch (status) {
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'ROLLED_BACK':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'SUCCEEDED':
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    }
  }

  shortImage(ref: string): string {
    // Show only the tag/digest portion when long; full ref still in title.
    const colonIdx = ref.lastIndexOf(':');
    if (colonIdx > 0 && ref.length > 48) {
      const repo = ref.slice(0, colonIdx);
      const tag = ref.slice(colonIdx);
      const shortRepo = repo.split('/').at(-1)!;
      return `…/${shortRepo}${tag}`;
    }
    return ref;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
