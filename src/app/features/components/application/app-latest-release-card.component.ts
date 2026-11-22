import {
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  effect,
  inject,
  signal,
  input,
} from '@angular/core';
import { formatDate as formatDateIn } from '@angular/common';
import { RouterModule } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideRotateCcw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';

import { AppReleaseService } from '../../service/app-release.service';
import { ApplicationReleaseDto } from '../../../core/api/model/applicationReleaseDto';
import { AppBuildsService } from '../../../core/api/api/appBuilds.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

type ReleaseStatus = ApplicationReleaseDto.StatusEnum;

const STATUS_TONE: Record<string, StatusTone> = {
  SUCCEEDED: 'success',
  FAILED: 'error',
  IN_PROGRESS: 'progress',
  ROLLED_BACK: 'warning',
};

@Component({
  selector: 'app-latest-release-card',
  imports: [RouterModule, FlPanel, FlStatus, FlButton, FlIcon],
  providers: [provideIcons({ lucideExternalLink, lucideRotateCcw })],
  template: `
    @if (release(); as r) {
      <fl-panel title="Latest release">
        <a
          panelActions
          class="fl-link text-fl-body-sm"
          [routerLink]="['/apps/applications', r.applicationId, 'releases']"
          >Release history</a
        >
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <fl-status [tone]="toneOf(r.status)" [label]="statusLabel(r.status)" />
            @if (r.startedAt) {
              <span class="text-fl-body-sm text-fl-ink-muted">{{ formatDate(r.startedAt) }}</span>
            }
          </div>

          @if (r.imageRef || r.previousImageRef) {
            <p class="fl-mono min-w-0 truncate text-fl-body-sm text-fl-ink">
              @if (r.previousImageRef && r.previousImageRef !== r.imageRef) {
                <span class="text-fl-ink-muted" [title]="r.previousImageRef">{{
                  shortImage(r.previousImageRef)
                }}</span>
                <span class="text-fl-ink-muted"> → </span>
              }
              @if (r.imageRef) {
                <span [title]="r.imageRef">{{ shortImage(r.imageRef) }}</span>
              }
            </p>
          }

          @if (r.status === 'FAILED' && r.failureReason) {
            <p class="whitespace-pre-wrap break-words text-fl-body-sm text-fl-ink-muted">
              {{ r.failureReason }}
            </p>
          }

          @if (buildExternalUrl() || (r.status === 'FAILED' && canRollback())) {
            <div class="flex flex-wrap items-center gap-3">
              @if (r.status === 'FAILED' && canRollback()) {
                <a
                  flButton
                  size="sm"
                  [routerLink]="['/apps/applications', r.applicationId, 'revisions']"
                >
                  <fl-icon name="lucideRotateCcw" />
                  Rollback
                </a>
              }
              @if (buildExternalUrl(); as url) {
                <a
                  [href]="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="fl-link inline-flex items-center gap-1 text-fl-body-sm"
                >
                  View build on GitHub
                  <fl-icon name="lucideExternalLink" [size]="14" />
                </a>
              }
            </div>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class AppLatestReleaseCardComponent implements OnChanges {
  readonly appId = input.required<string>();
  readonly canRollback = input(true);

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
    const appId = this.appId();
    if (changes['appId'] && appId) {
      this.releaseService.loadCurrent(appId);
      this.releaseService.subscribe(appId);
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

  toneOf(status: ReleaseStatus): StatusTone {
    return STATUS_TONE[status] ?? 'neutral';
  }

  statusLabel(status: ReleaseStatus): string {
    switch (status) {
      case 'IN_PROGRESS':
        return 'In progress';
      case 'SUCCEEDED':
        return 'Succeeded';
      case 'FAILED':
        return 'Failed';
      case 'ROLLED_BACK':
        return 'Rolled back';
      default:
        return status;
    }
  }

  shortImage(ref: string): string {
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
    return formatDateIn(iso, 'd MMM y, HH:mm', 'en-US');
  }
}
