import { Component, inject, input, output } from '@angular/core';
import { formatDate as formatDateIn } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import {
  lucideRocket,
  lucideRotateCcw,
  lucideArrowUpDown,
  lucideCpu,
  lucideRefreshCw,
  lucidePlay,
  lucideSquare,
  lucideSettings,
  lucideGitCommit,
  lucideWand,
} from '@ng-icons/lucide';
import { AppAuditEventSummaryDto } from '../../../core/api/model/appAuditEventSummaryDto';
import { AppRevisionsService, AuditEventType } from '../../service/app-revisions.service';
import { ApplicationService } from '../../service/application.service';
import { appEventText } from './app-recap-view';
import { formatRelativeDate } from './builds/build-format.utils';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

const ROLLBACK_ITEMS: readonly MenuAction[] = [
  { id: 'rollback', label: 'Roll back to this revision', danger: true },
];
const ROLLBACK_ITEMS_BUSY: readonly MenuAction[] = [
  { id: 'rollback', label: 'Roll back to this revision', danger: true, disabled: true },
];

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [
    FlPanel,
    FlTable,
    FlEmptyState,
    FlErrorState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
  ],
  providers: [
    provideIcons({
      lucideRocket,
      lucideRotateCcw,
      lucideArrowUpDown,
      lucideCpu,
      lucideRefreshCw,
      lucidePlay,
      lucideSquare,
      lucideSettings,
      lucideGitCommit,
      lucideWand,
    }),
  ],
  template: `
    <fl-panel title="Revision history" [count]="service.eventsTotal()" [flush]="true">
      <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
        <div class="fl-toolbar__group max-w-full overflow-x-auto">
          <div class="fl-segmented shrink-0" role="group" aria-label="Event type">
            @for (filter of filters; track filter.label) {
              <button
                type="button"
                [attr.aria-pressed]="activeFilter() === filter.value"
                (click)="filterChange.emit(filter.value)"
              >
                {{ filter.label }}
              </button>
            }
          </div>
        </div>
      </div>

      @if (service.eventsLoading()) {
        <fl-loading-state [rows]="4" />
      } @else if (service.eventsError()) {
        <fl-error-state
          title="Could not load revisions"
          [reason]="service.eventsError()"
          (retry)="filterChange.emit(activeFilter())"
        />
      } @else if (service.events().length === 0) {
        <fl-empty-state title="No activity yet" />
      } @else {
        <div class="fl-table-wrap relative">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Revision</th>
                <th scope="col">Change</th>
                <th scope="col">Status</th>
                <th scope="col">By</th>
                <th scope="col" class="is-num">When</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (event of service.events(); track event.id) {
                <tr>
                  <td>
                    @if (event.revisionNumber) {
                      <span class="fl-mono">#{{ event.revisionNumber }}</span>
                    } @else {
                      <span class="fl-muted">—</span>
                    }
                  </td>
                  <td class="is-wrap">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <fl-icon
                        class="text-fl-ink-muted"
                        [name]="isAutoFix(event) ? 'lucideWand' : getEventIcon(event.eventType)"
                        [size]="14"
                      />
                      <span class="min-w-0 break-words">{{ formatChangeMetadata(event) }}</span>
                      @if (isAutoFix(event)) {
                        <fl-tag>Automatic remediation</fl-tag>
                      }
                    </div>
                  </td>
                  <td>
                    @if (isCurrentRevision(event)) {
                      <fl-status tone="success" label="Running" />
                    } @else {
                      <span class="fl-muted">—</span>
                    }
                  </td>
                  <td>{{ formatActor(event.actor) }}</td>
                  <td class="is-num" [title]="formatDate(event.createdAt)">
                    {{ relativeDate(event.createdAt) }}
                  </td>
                  <td class="is-fit">
                    @if (canRollback(event)) {
                      <fl-actions-menu
                        [compact]="true"
                        [label]="'Actions for revision ' + event.revisionNumber"
                        [items]="service.rollingBack() ? rollbackItemsBusy : rollbackItems"
                        (action)="rollback.emit(event)"
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (service.eventsTotal() > service.events().length) {
          <div class="flex justify-center border-t border-fl-border-subtle p-3">
            <button flButton size="sm" type="button" (click)="loadMore.emit()">
              Load more ({{ service.eventsTotal() - service.events().length }} remaining)
            </button>
          </div>
        }
      }
    </fl-panel>
  `,
})
export class AppActivityFeedComponent {
  service = inject(AppRevisionsService);
  private readonly appService = inject(ApplicationService);

  readonly activeFilter = input<AuditEventType>();
  readonly filterChange = output<AuditEventType | undefined>();
  readonly loadMore = output<void>();
  readonly rollback = output<AppAuditEventSummaryDto>();

  protected readonly rollbackItems = ROLLBACK_ITEMS;
  protected readonly rollbackItemsBusy = ROLLBACK_ITEMS_BUSY;

  filters: { label: string; value: AuditEventType | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Deploy', value: 'deploy' },
    { label: 'Scale', value: 'scale' },
    { label: 'Restart', value: 'restart' },
    { label: 'Stop and start', value: 'stop' },
    { label: 'Resources', value: 'resource_update' },
  ];

  isCurrentRevision(event: AppAuditEventSummaryDto): boolean {
    const app = this.appService.selectedApplication();
    return !!app && !!(app as any).currentRevisionId && (app as any).currentRevisionId === event.id;
  }

  canRollback(event: AppAuditEventSummaryDto): boolean {
    return (
      (event.eventType === 'deploy' || event.eventType === 'rollback') &&
      !this.isCurrentRevision(event) &&
      event.revisionNumber != null
    );
  }

  isAutoFix(event: AppAuditEventSummaryDto): boolean {
    const meta = event.changeMetadata as { autoFix?: boolean } | null | undefined;
    if (meta?.autoFix) return true;
    return event.actor?.type === 'system' && event.actor?.id === 'actuator';
  }

  getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      deploy: 'lucideRocket',
      rollback: 'lucideRotateCcw',
      scale: 'lucideArrowUpDown',
      resource_update: 'lucideCpu',
      restart: 'lucideRefreshCw',
      start: 'lucidePlay',
      stop: 'lucideSquare',
      config_update: 'lucideSettings',
      created: 'lucideGitCommit',
      reconciled: 'lucideRefreshCw',
    };
    return icons[type] ?? 'lucideGitCommit';
  }

  formatActor(actor?: { type: string; name?: string | null }): string {
    return actor?.name ?? actor?.type ?? 'system';
  }

  formatDate(iso: string): string {
    return formatDateIn(iso, 'd MMM y, HH:mm', 'en-US');
  }

  relativeDate(iso: string): string {
    return formatRelativeDate(iso);
  }

  formatChangeMetadata(event: AppAuditEventSummaryDto): string {
    return appEventText(event);
  }
}
