import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGitBranch, lucideClock, lucideExternalLink, lucideRocket, lucideLoader,
} from '@ng-icons/lucide';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { AppBuildProviderBadgeComponent } from './app-build-provider-badge.component';
import { AppBuildStatusBadgeComponent } from './app-build-status-badge.component';
import { formatDuration, formatRelativeDate, truncateImageRef } from './build-format.utils';

@Component({
  selector: 'app-build-row',
  standalone: true,
  imports: [CommonModule, NgIcon, AppBuildProviderBadgeComponent, AppBuildStatusBadgeComponent],
  providers: [provideIcons({ lucideGitBranch, lucideClock, lucideExternalLink, lucideRocket, lucideLoader })],
  host: { class: 'contents' },
  template: `
    <tr class="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2 flex-wrap">
          <app-build-provider-badge [provider]="build().provider" />
          @if (isReadyToRelease()) {
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Ready to release
            </span>
          }
        </div>
      </td>
      <td class="px-4 py-3">
        <app-build-status-badge [status]="build().status" />
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1.5 text-xs">
          <ng-icon name="lucideGitBranch" class="h-3.5 w-3.5 text-muted-foreground" />
          {{ build().branch }}
        </div>
      </td>
      <td class="px-4 py-3">
        @if (build().commitSha) {
          <code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{{ build().commitSha!.substring(0, 7) }}</code>
        } @else {
          <span class="text-muted-foreground">—</span>
        }
      </td>
      <td class="px-4 py-3">
        @if (build().status === 'COMPLETED' && build().imageRef) {
          <span class="font-mono text-xs text-muted-foreground truncate max-w-[160px] inline-block align-middle"
            [title]="build().imageRef!">
            {{ truncate(build().imageRef!) }}
          </span>
        } @else {
          <span class="text-muted-foreground text-xs">—</span>
        }
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
          <ng-icon name="lucideClock" class="h-3.5 w-3.5" />
          {{ duration() }}
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-muted-foreground">
        {{ relativeStarted() }}
      </td>
      <td class="px-4 py-3 text-right">
        <div class="inline-flex items-center gap-2">
          @if (canRelease()) {
            <button (click)="deploy.emit(build())" [disabled]="deploying()"
              class="inline-flex items-center text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors">
              @if (deploying()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1 animate-spin" />
              } @else {
                <ng-icon name="lucideRocket" class="h-3.5 w-3.5 mr-1" />
              }
              Release
            </button>
          }
          @if (build().provider === 'GITHUB_ACTIONS' && build().externalUrl) {
            <a [href]="build().externalUrl" target="_blank" rel="noopener"
              class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 mr-1" />
              View on GitHub
            </a>
          } @else {
            <button (click)="view.emit(build())"
              class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 mr-1" />
              View
            </button>
          }
        </div>
      </td>
    </tr>
  `,
})
export class AppBuildRowComponent {
  build = input.required<AppBuildResponseDto>();
  deploying = input(false);
  /** Current image deployed on the application — used to flag drift. */
  currentAppImageRef = input<string | null | undefined>(null);

  view = output<AppBuildResponseDto>();
  deploy = output<AppBuildResponseDto>();

  duration = computed(() => formatDuration(this.build().startedAt, this.build().completedAt));
  relativeStarted = computed(() => formatRelativeDate(this.build().createdAt));
  canRelease = computed(() => this.build().status === 'COMPLETED' && !!this.build().imageRef);
  isReadyToRelease = computed(() => {
    const ref = this.build().imageRef;
    return this.canRelease() && !!ref && ref !== this.currentAppImageRef();
  });

  truncate = truncateImageRef;
}
