import { Component, computed, input, output } from '@angular/core';
import { formatDate } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { FlTag } from '../../../../ui/primitives/tag';
import { AppBuildProviderBadgeComponent } from './app-build-provider-badge.component';
import { AppBuildStatusBadgeComponent } from './app-build-status-badge.component';
import { formatDuration, formatRelativeDate, truncateImageRef } from './build-format.utils';

@Component({
  selector: 'tr[app-build-row]',
  standalone: true,
  imports: [
    AppBuildProviderBadgeComponent,
    AppBuildStatusBadgeComponent,
    FlButton,
    FlIcon,
    FlSpinner,
    FlTag,
  ],
  providers: [provideIcons({ lucideExternalLink })],
  template: `
    @let b = build();
    <td>
      @if (b.commitSha) {
        <span class="fl-mono" [title]="b.commitSha">{{ b.commitSha.substring(0, 7) }}</span>
      } @else {
        <span class="fl-muted">—</span>
      }
    </td>
    <td><app-build-status-badge [status]="b.status" /></td>
    <td>
      <span class="fl-cell-clip" [title]="b.branch">{{ b.branch }}</span>
    </td>
    <td><app-build-provider-badge [provider]="b.provider" /></td>
    <td>
      @if (b.status === 'COMPLETED' && b.imageRef) {
        <div class="flex items-center gap-2">
          <span class="fl-mono fl-cell-clip" [title]="b.imageRef">{{ truncate(b.imageRef) }}</span>
          @if (isReadyToRelease()) {
            <fl-tag>Ready to release</fl-tag>
          }
        </div>
      } @else {
        <span class="fl-muted">—</span>
      }
    </td>
    <td class="is-num">{{ duration() }}</td>
    <td class="is-num" [title]="absoluteStarted()">{{ relativeStarted() }}</td>
    <td class="is-fit">
      <div class="flex items-center justify-end gap-2">
        @if (canRelease()) {
          <button
            flButton
            size="sm"
            type="button"
            (click)="deploy.emit(b)"
            [disabled]="deploying()"
          >
            @if (deploying()) {
              <fl-spinner label="Releasing" />
            }
            Release
          </button>
        }
        @if (b.provider === 'GITHUB_ACTIONS' && b.externalUrl) {
          <a flButton="ghost" size="sm" [href]="b.externalUrl" target="_blank" rel="noopener">
            View on GitHub
            <fl-icon name="lucideExternalLink" [size]="14" />
          </a>
        } @else {
          <button flButton="ghost" size="sm" type="button" (click)="view.emit(b)">View</button>
        }
      </div>
    </td>
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
  absoluteStarted = computed(() => formatDate(this.build().createdAt, 'd MMM y, HH:mm', 'en-US'));
  canRelease = computed(() => this.build().status === 'COMPLETED' && !!this.build().imageRef);
  isReadyToRelease = computed(() => {
    const ref = this.build().imageRef;
    return this.canRelease() && !!ref && ref !== this.currentAppImageRef();
  });

  truncate = truncateImageRef;
}
