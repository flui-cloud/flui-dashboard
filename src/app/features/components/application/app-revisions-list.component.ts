import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRocket, lucideRotateCcw, lucideArrowUpDown, lucideCpu,
  lucideRefreshCw, lucidePlay, lucideSquare, lucideSettings,
  lucideGitCommit, lucideLoader, lucideAlertCircle, lucideWand,
} from '@ng-icons/lucide';
import { AppRevisionResponseDto } from '../../../core/api/model/appRevisionResponseDto';
import { AppRevisionsService } from '../../service/app-revisions.service';
import { ApplicationService } from '../../service/application.service';

interface ResourcesSnapshot {
  cpu?: { request?: string; limit?: string };
  memory?: { request?: string; limit?: string };
}

@Component({
  selector: 'app-revisions-list',
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
    @if (service.rollbackError()) {
      <div class="flex items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
        <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
        {{ service.rollbackError() }}
      </div>
    }

    @if (service.revisionsLoading()) {
      <div class="flex items-center justify-center py-12">
        <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-blue-600" />
      </div>
    } @else if (service.revisionsError()) {
      <div class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
        <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
        {{ service.revisionsError() }}
      </div>
    } @else if (service.revisions().length === 0) {
      <p class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No deploy revisions yet.</p>
    } @else {
      <div class="space-y-2">
        @for (rev of service.revisions(); track rev.id) {
          <div
            class="border rounded-lg p-4 transition-colors"
            [class]="isCurrentRevision(rev)
              ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3 min-w-0">
                <div
                  class="mt-0.5 p-1.5 rounded-md shrink-0"
                  [class]="isAutoFix(rev)
                    ? 'bg-purple-100 dark:bg-purple-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'"
                >
                  <ng-icon
                    [name]="isAutoFix(rev) ? 'lucideWand' : getEventIcon(rev.eventType)"
                    class="h-4 w-4"
                    [class]="isAutoFix(rev)
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400'"
                  />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    @if (rev.revisionNumber) {
                      <span class="text-sm font-semibold text-gray-900 dark:text-white">#{{ rev.revisionNumber }}</span>
                    }
                    <span [class]="getEventTypeBadge(rev.eventType)">{{ isAutoFix(rev) ? 'auto remediation' : rev.eventType }}</span>
                    @if (isAutoFix(rev)) {
                      <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 font-medium">
                        <ng-icon name="lucideWand" class="h-3 w-3" />
                        Flui automatic remediation
                      </span>
                    }
                    @if (isCurrentRevision(rev)) {
                      <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-medium">current</span>
                    }
                    <span [class]="getRevisionStatusBadge(rev.status)">{{ rev.status }}</span>
                  </div>
                  @if (rev.imageRef) {
                    <p class="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1 truncate">{{ rev.imageRef }}</p>
                  }
                  <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>{{ formatDate(rev.createdAt) }}</span>
                    <span>by {{ formatActor(rev.actor) }}</span>
                    @if (rev.replicas !== undefined) {
                      <span>{{ rev.replicas }} replica{{ rev.replicas !== 1 ? 's' : '' }}</span>
                    }
                  </div>
                  @if (rev.resourcesSnapshot) {
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex gap-3 flex-wrap">
                      <span>CPU {{ getSnapshotCpu(rev.resourcesSnapshot) }}</span>
                      <span>Mem {{ getSnapshotMem(rev.resourcesSnapshot) }}</span>
                    </div>
                  }
                  @if (rev.envKeys && rev.envKeys.length > 0) {
                    <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Env: {{ rev.envKeys.slice(0, 4).join(', ') }}{{ rev.envKeys.length > 4 ? ' +' + (rev.envKeys.length - 4) + ' more' : '' }}
                    </div>
                  }
                  @if (rev.rollbackReason) {
                    <p class="mt-1 text-xs text-orange-600 dark:text-orange-400">Reason: {{ rev.rollbackReason }}</p>
                  }
                  @if (getAutoFixSummary(rev); as summary) {
                    <p class="mt-1 text-xs text-purple-700 dark:text-purple-300">{{ summary }}</p>
                  }
                </div>
              </div>
              @if (canRollback(rev)) {
                <button
                  (click)="rollback.emit(rev)"
                  [disabled]="service.rollingBack()"
                  class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        }
      </div>
    }
  `,
})
export class AppRevisionsListComponent {
  service = inject(AppRevisionsService);
  private readonly appService = inject(ApplicationService);

  @Output() rollback = new EventEmitter<AppRevisionResponseDto>();

  isCurrentRevision(rev: AppRevisionResponseDto): boolean {
    const app = this.appService.selectedApplication();
    return !!app && !!(app as any).currentRevisionId && (app as any).currentRevisionId === rev.id;
  }

  canRollback(rev: AppRevisionResponseDto): boolean {
    return (rev.eventType === 'deploy' || rev.eventType === 'rollback')
      && !this.isCurrentRevision(rev)
      && rev.revisionNumber != null;
  }

  isAutoFix(rev: AppRevisionResponseDto): boolean {
    const meta = rev.changeMetadata as { autoFix?: boolean } | null | undefined;
    if (meta?.autoFix) return true;
    return rev.actor?.type === 'system' && rev.actor?.id === 'actuator';
  }

  getAutoFixSummary(rev: AppRevisionResponseDto): string | null {
    const meta = rev.changeMetadata as {
      autoFix?: boolean;
      reason?: string;
      previousMemoryLimit?: string;
      newMemoryLimit?: string;
    } | null | undefined;
    if (!meta?.autoFix) return null;
    if (meta.previousMemoryLimit && meta.newMemoryLimit) {
      return `Memory limit raised ${meta.previousMemoryLimit} → ${meta.newMemoryLimit}${meta.reason ? ' (' + meta.reason + ')' : ''}`;
    }
    return 'Automatic remediation applied';
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

  getEventTypeBadge(type: string): string {
    const base = 'text-xs px-2 py-0.5 rounded font-medium';
    const colors: Record<string, string> = {
      deploy: `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`,
      rollback: `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`,
      scale: `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`,
      resource_update: `${base} bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400`,
    };
    return colors[type] ?? `${base} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`;
  }

  getRevisionStatusBadge(status: string): string {
    const base = 'text-xs px-2 py-0.5 rounded font-medium';
    if (status === 'running') return `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
    if (status === 'failed') return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
    return `${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400`;
  }

  formatActor(actor?: { type: string; name?: string | null }): string {
    return actor?.name ?? actor?.type ?? 'system';
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  getSnapshotCpu(snap: object): string {
    const s = snap as ResourcesSnapshot;
    return s?.cpu ? `${s.cpu.request ?? '?'} / ${s.cpu.limit ?? '?'}` : '—';
  }

  getSnapshotMem(snap: object): string {
    const s = snap as ResourcesSnapshot;
    return s?.memory ? `${s.memory.request ?? '?'} / ${s.memory.limit ?? '?'}` : '—';
  }
}
