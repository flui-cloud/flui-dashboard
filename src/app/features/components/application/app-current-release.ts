import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { absoluteDate, shortDigest } from './app-release-row';

@Component({
  selector: 'app-current-release',
  imports: [
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    FlTag,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <fl-panel title="Current release" [flush]="!version()">
      <ng-container panelActions>
        @if (hasUpdate()) {
          <fl-tag>Update available</fl-tag>
        }
        <button flButton size="sm" type="button" (click)="refresh.emit()" [disabled]="loading()">
          @if (loading()) {
            <fl-spinner label="Refreshing" />
          } @else {
            <fl-icon name="lucideRefreshCw" />
          }
          Refresh
        </button>
      </ng-container>
      @if (version(); as v) {
        <fl-key-value>
          <fl-kv-item key="Status"><fl-status tone="success" label="Running" /></fl-kv-item>
          <fl-kv-item key="Tag" [mono]="true">{{ v.tag }}</fl-kv-item>
          <fl-kv-item key="Image" [mono]="true">{{ v.imageRef }}</fl-kv-item>
          @if (v.digest) {
            <fl-kv-item key="Digest" [mono]="true">
              <span [title]="v.digest">{{ digest() }}</span>
            </fl-kv-item>
          }
          @if (released()) {
            <fl-kv-item key="Released">{{ released() }}</fl-kv-item>
          }
          @if (sourceType()) {
            <fl-kv-item key="Source">{{ sourceType() }}</fl-kv-item>
          }
          <fl-kv-item key="Updates">
            @if (autoDeploy()) {
              Auto-deploy on push
              @if (branch(); as b) {
                from <span class="fl-mono">{{ b }}</span>
              }
            } @else {
              Manual
            }
          </fl-kv-item>
        </fl-key-value>
      } @else if (loading()) {
        <fl-loading-state [rows]="2" />
      } @else {
        <p class="px-4 py-3 text-fl-body-sm text-fl-ink-muted">No version is running yet.</p>
      }
    </fl-panel>
  `,
})
export class AppCurrentRelease {
  readonly version = input<AvailableVersionDto | null>(null);
  readonly sourceType = input<string | null>(null);
  readonly autoDeploy = input(false);
  readonly branch = input<string | null>(null);
  readonly hasUpdate = input(false);
  readonly loading = input(false);
  readonly refresh = output<void>();

  protected readonly digest = computed(() => shortDigest(this.version()?.digest ?? ''));
  protected readonly released = computed(() => {
    const at = this.version()?.lastRelease?.startedAt;
    return at ? absoluteDate(at) : '';
  });
}
