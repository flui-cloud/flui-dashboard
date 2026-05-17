import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRocket, lucideRotateCcw, lucideArrowUpDown, lucideCpu,
  lucideRefreshCw, lucidePlay, lucideSquare, lucideSettings,
  lucideGitCommit, lucideLoader, lucideAlertCircle, lucideWand,
} from '@ng-icons/lucide';
import { AppAuditEventSummaryDto } from '../../../core/api/model/appAuditEventSummaryDto';
import { AppRevisionsService, AuditEventType } from '../../service/app-revisions.service';
import { ApplicationService } from '../../service/application.service';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideRocket, lucideRotateCcw, lucideArrowUpDown, lucideCpu,
      lucideRefreshCw, lucidePlay, lucideSquare, lucideSettings,
      lucideGitCommit, lucideLoader, lucideAlertCircle, lucideWand,
    }),
  ],
  template: `
    <div class="space-y-3">
      <!-- Filter bar -->
      <div class="flex items-center gap-2 flex-wrap">
        @for (filter of filters; track filter.value) {
          <button
            (click)="filterChange.emit(filter.value)"
            class="px-3 py-1 text-xs rounded-full border transition-colors font-medium"
            [class]="activeFilter === filter.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >
            {{ filter.label }}
          </button>
        }
      </div>

      @if (service.eventsLoading()) {
        <div class="flex items-center justify-center py-12">
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-blue-600" />
        </div>
      } @else if (service.eventsError()) {
        <div class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
          {{ service.eventsError() }}
        </div>
      } @else if (service.events().length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No activity events found.</p>
      } @else {
        <div class="relative">
          <div class="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
          <div class="space-y-3">
            @for (event of service.events(); track event.id) {
              <div class="flex items-start gap-4 pl-12 relative">
                <div
                  class="absolute left-3.5 top-2 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                  [class]="isAutoFix(event) ? 'bg-purple-500' : getEventDotColor(event.eventType)"
                ></div>
                <div class="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <ng-icon
                        [name]="isAutoFix(event) ? 'lucideWand' : getEventIcon(event.eventType)"
                        class="h-4 w-4 shrink-0"
                        [class]="isAutoFix(event) ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'"
                      />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatChangeMetadata(event) }}</span>
                      @if (isAutoFix(event)) {
                        <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 font-medium">
                          Flui automatic remediation
                        </span>
                      }
                      @if (event.revisionNumber) {
                        <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">#{{ event.revisionNumber }}</span>
                      }
                      @if (isCurrentRevision(event)) {
                        <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-medium">current</span>
                      }
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{{ formatDate(event.createdAt) }}</span>
                      @if (canRollback(event)) {
                        <button
                          (click)="rollback.emit(event)"
                          [disabled]="service.rollingBack()"
                          class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          @if (service.rollingBack()) {
                            <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                          } @else {
                            <ng-icon name="lucideRotateCcw" class="h-3 w-3" />
                          }
                          Rollback
                        </button>
                      }
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">by {{ formatActor(event.actor) }}</p>
                  @if (service.rollbackError() && service.rollingBack() === false) {
                    <!-- error shown at feed level -->
                  }
                </div>
              </div>
            }
          </div>
        </div>

        @if (service.eventsTotal() > service.events().length) {
          <div class="text-center pt-2">
            <button
              (click)="loadMore.emit()"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Load more ({{ service.eventsTotal() - service.events().length }} remaining)
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class AppActivityFeedComponent {
  service = inject(AppRevisionsService);
  private readonly appService = inject(ApplicationService);

  @Input() activeFilter: AuditEventType | undefined = undefined;
  @Output() filterChange = new EventEmitter<AuditEventType | undefined>();
  @Output() loadMore = new EventEmitter<void>();
  @Output() rollback = new EventEmitter<AppAuditEventSummaryDto>();

  filters: { label: string; value: AuditEventType | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Deploy', value: 'deploy' },
    { label: 'Scale', value: 'scale' },
    { label: 'Restart', value: 'restart' },
    { label: 'Stop/Start', value: 'stop' },
    { label: 'Resources', value: 'resource_update' },
  ];

  isCurrentRevision(event: AppAuditEventSummaryDto): boolean {
    const app = this.appService.selectedApplication();
    return !!app && !!(app as any).currentRevisionId && (app as any).currentRevisionId === event.id;
  }

  canRollback(event: AppAuditEventSummaryDto): boolean {
    return (event.eventType === 'deploy' || event.eventType === 'rollback')
      && !this.isCurrentRevision(event)
      && event.revisionNumber != null;
  }

  isAutoFix(event: AppAuditEventSummaryDto): boolean {
    const meta = event.changeMetadata as { autoFix?: boolean } | null | undefined;
    if (meta?.autoFix) return true;
    return event.actor?.type === 'system' && event.actor?.id === 'actuator';
  }

  getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      deploy: 'lucideRocket', rollback: 'lucideRotateCcw', scale: 'lucideArrowUpDown',
      resource_update: 'lucideCpu', restart: 'lucideRefreshCw', start: 'lucidePlay',
      stop: 'lucideSquare', config_update: 'lucideSettings', created: 'lucideGitCommit',
      reconciled: 'lucideRefreshCw',
    };
    return icons[type] ?? 'lucideGitCommit';
  }

  getEventDotColor(type: string): string {
    const colors: Record<string, string> = {
      deploy: 'bg-green-500', rollback: 'bg-orange-500', scale: 'bg-blue-500',
      resource_update: 'bg-purple-500', restart: 'bg-yellow-500', start: 'bg-green-400',
      stop: 'bg-red-400', config_update: 'bg-gray-400', created: 'bg-blue-600',
      reconciled: 'bg-teal-500',
    };
    return colors[type] ?? 'bg-gray-400';
  }

  formatActor(actor?: { type: string; name?: string | null }): string {
    return actor?.name ?? actor?.type ?? 'system';
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatChangeMetadata(event: AppAuditEventSummaryDto): string {
    const m = event.changeMetadata as any;
    switch (event.eventType) {
      case 'deploy':
        return event.imageRef ? `Deployed ${event.imageRef}` : 'Deployed';
      case 'rollback':
        return `Rolled back to #${m?.rollbackFromRevision ?? '?'}`;
      case 'scale':
        return (m?.before?.replicas !== undefined && m?.after?.replicas !== undefined)
          ? `Scaled from ${m.before.replicas} to ${m.after.replicas} replicas`
          : 'Scaled replicas';
      case 'resource_update': {
        if (m?.autoFix && m?.previousMemoryLimit && m?.newMemoryLimit) {
          return `Memory limit raised ${m.previousMemoryLimit} → ${m.newMemoryLimit}`;
        }
        const parts: string[] = [];
        if (m?.after?.cpu?.limit) parts.push(`CPU limit ${m.before?.cpu?.limit ?? '?'} → ${m.after.cpu.limit}`);
        if (m?.after?.memory?.limit) parts.push(`Memory limit ${m.before?.memory?.limit ?? '?'} → ${m.after.memory.limit}`);
        return parts.length ? parts.join(', ') : 'Resources updated';
      }
      case 'restart': return 'Rolling restart triggered';
      case 'stop': return m?.previousReplicas === undefined ? 'Application stopped' : `Stopped (was ${m.previousReplicas} replicas)`;
      case 'start': return m?.restoredReplicas === undefined ? 'Application started' : `Started (restored ${m.restoredReplicas} replicas)`;
      case 'config_update': return 'Configuration variables updated';
      case 'created': return 'Application created';
      case 'reconciled': return 'Reconciled with cluster';
      default: return event.eventType;
    }
  }
}
