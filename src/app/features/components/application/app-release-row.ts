import { Component, computed, input, output } from '@angular/core';
import { formatDate } from '@angular/common';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { formatRelativeDate } from './builds/build-format.utils';

export interface ReleaseState {
  readonly tone: StatusTone;
  readonly label: string;
}

export function releaseStateOf(v: AvailableVersionDto, releasing: boolean): ReleaseState {
  const status = v.lastRelease?.status;
  if (v.isCurrentlyDeployed) return { tone: 'success', label: 'Running' };
  if (releasing || status === 'IN_PROGRESS') return { tone: 'progress', label: 'Releasing' };
  if (status === 'FAILED') return { tone: 'error', label: 'Failed' };
  if (status === 'ROLLED_BACK') return { tone: 'warning', label: 'Rolled back' };
  if (status === 'SUCCEEDED') return { tone: 'success', label: 'Succeeded' };
  return { tone: 'neutral', label: 'Not released' };
}

export function shortDigest(digest: string): string {
  const idx = digest.indexOf(':');
  const body = idx >= 0 ? digest.slice(idx + 1) : digest;
  return (idx >= 0 ? digest.slice(0, idx + 1) : '') + body.slice(0, 12);
}

export function absoluteDate(iso: string): string {
  return formatDate(iso, 'd MMM y, HH:mm', 'en-US');
}

const AUTO_DEPLOY_TITLE =
  'Auto-deploy on push is on: this application always runs the newest successful build of its branch.';

@Component({
  selector: 'tr[app-release-row]',
  imports: [FlActionsMenu, FlButton, FlStatus, FlTag],
  template: `
    @let v = version();
    @let lr = v.lastRelease;
    <td class="whitespace-normal">
      <div class="fl-cell-name flex flex-col gap-0.5">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="fl-mono font-medium">{{ v.tag }}</span>
          @for (alias of aliases(); track alias) {
            <span class="fl-mono fl-muted">{{ alias }}</span>
          }
          @if (v.deployHint && !v.isCurrentlyDeployed) {
            <fl-tag>{{ v.deployHint }}</fl-tag>
          }
        </div>
        <span class="fl-mono truncate text-fl-ink-muted" [title]="v.imageRef">{{
          v.imageRef
        }}</span>
        @if (v.releasable === false && v.notReleasableReason) {
          <span class="text-fl-caption text-fl-ink-muted">{{ v.notReleasableReason }}</span>
        }
        @if (lr?.status === 'FAILED' && lr?.failureReason) {
          <span class="whitespace-pre-wrap break-words text-fl-caption text-fl-ink-muted">{{
            lr?.failureReason
          }}</span>
        }
      </div>
    </td>
    <td>
      <fl-status [tone]="state().tone" [label]="statusLabel()" />
    </td>
    <td>
      @if (v.digest) {
        <span class="fl-mono" [title]="v.digest">{{ digest() }}</span>
      } @else {
        <span class="fl-muted">—</span>
      }
    </td>
    <td>
      @if (v.platforms?.length) {
        {{ v.platforms!.join(', ') }}
      } @else {
        <span class="fl-muted">—</span>
      }
    </td>
    <td class="is-num" [title]="v.createdAt ? absolute(v.createdAt) : ''">
      {{ v.createdAt ? relative(v.createdAt) : '—' }}
    </td>
    <td class="is-num" [title]="lr ? 'Last release: ' + absolute(lr.startedAt) : ''">
      {{ lr ? relative(lr.startedAt) : '—' }}
    </td>
    <td class="is-num">{{ v.releaseCount ?? 0 }}</td>
    <td class="is-fit">
      @if (actionable()) {
        <div class="flex items-center justify-end gap-2">
          <button
            flButton
            size="sm"
            type="button"
            (click)="deploy.emit(v)"
            [disabled]="autoDeploy() || locked()"
            [title]="autoDeploy() ? autoDeployTitle : ''"
          >
            Deploy
          </button>
          @if (v.versionId != null && !readOnly()) {
            <fl-actions-menu
              [compact]="true"
              [label]="'Actions for ' + v.tag"
              [items]="locked() ? lockedItems : items"
              (action)="remove.emit(v)"
            />
          }
        </div>
      }
    </td>
  `,
})
export class AppReleaseRow {
  readonly version = input.required<AvailableVersionDto>();
  readonly releasing = input(false);
  readonly progress = input<number | null>(null);
  readonly autoDeploy = input(false);
  readonly locked = input(false);
  readonly readOnly = input(false);
  readonly deploy = output<AvailableVersionDto>();
  readonly remove = output<AvailableVersionDto>();

  protected readonly autoDeployTitle = AUTO_DEPLOY_TITLE;
  protected readonly items: readonly MenuAction[] = [
    { id: 'delete', label: 'Delete image', danger: true },
  ];
  protected readonly lockedItems: readonly MenuAction[] = [
    { id: 'delete', label: 'Delete image', danger: true, disabled: true },
  ];

  protected readonly state = computed(() => releaseStateOf(this.version(), this.releasing()));
  protected readonly statusLabel = computed(() => {
    const p = this.progress();
    return this.releasing() && p != null ? `Releasing · ${p}%` : this.state().label;
  });
  protected readonly aliases = computed(() =>
    (this.version().allTags ?? []).filter((t) => t !== this.version().tag),
  );
  protected readonly digest = computed(() => shortDigest(this.version().digest ?? ''));
  protected readonly actionable = computed(
    () =>
      !this.version().isCurrentlyDeployed &&
      this.version().releasable !== false &&
      !this.releasing(),
  );

  protected absolute(iso: string): string {
    return absoluteDate(iso);
  }

  protected relative(iso: string): string {
    return formatRelativeDate(iso);
  }
}
