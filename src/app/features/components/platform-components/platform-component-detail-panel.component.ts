import { Component, input, output, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideLoader,
  lucideX,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideFileText,
  lucideCircleCheck,
  lucideCircleAlert,
  lucideCircleMinus,
  lucideSearch,
} from '@ng-icons/lucide';
import { FormsModule } from '@angular/forms';
import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';
import { PlatformComponentResourceStatusDto } from '../../../core/api/model/platformComponentResourceStatusDto';
import { RedeployPlatformComponentResponseDto } from '../../../core/api/model/redeployPlatformComponentResponseDto';
import { PlatformComponentsService } from '../../service/platform-components.service';
import { PlatformComponentStatusBadgeComponent } from './platform-component-status-badge.component';
import { LogTableComponent } from '../application/log-table.component';
import type { AppLogEntryDto } from '../../service/application-logs.service';

@Component({
  selector: 'app-platform-component-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, PlatformComponentStatusBadgeComponent, LogTableComponent],
  providers: [
    provideIcons({
      lucideChevronRight,
      lucideLoader,
      lucideX,
      lucideAlertCircle,
      lucideRefreshCw,
      lucideFileText,
      lucideCircleCheck,
      lucideCircleAlert,
      lucideCircleMinus,
      lucideSearch,
    }),
  ],
  template: `
    <div class="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3 space-y-3">

      <!-- Errors -->
      @if (component().errors.length) {
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Errors</p>
          <div class="space-y-1">
            @for (err of component().errors; track err) {
              <div class="flex items-start gap-2 px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span class="font-mono">{{ err }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Resources -->
      @if (component().resources.length) {
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Resources</p>
          <div class="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table class="w-full text-xs">
              <thead class="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th class="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Resource</th>
                  <th class="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Namespace</th>
                  <th class="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th class="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Replicas</th>
                  <th class="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                @for (res of component().resources; track res.name) {
                  <tr>
                    <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-200">
                      <span class="text-gray-400 dark:text-gray-500">{{ res.kind }}/</span>{{ res.name }}
                    </td>
                    <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ res.namespace }}</td>
                    <td class="px-3 py-2">
                      <app-platform-component-status-badge [status]="res.status" />
                    </td>
                    <td class="px-3 py-2 text-gray-500 dark:text-gray-400">
                      @if (res.replicas) {
                        <span [class]="replicaClass(res)">
                          {{ res.replicas.ready }}/{{ res.replicas.desired }}
                        </span>
                      } @else {
                        <span>—</span>
                      }
                    </td>
                    <td class="px-3 py-2 text-right">
                      @if (res.pods?.length === 1) {
                        <button
                          class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          (click)="onViewLogs(res.pods![0].podName)"
                        >
                          <ng-icon name="lucideFileText" class="h-3 w-3" />
                          Logs
                        </button>
                      }
                    </td>
                  </tr>
                  <!-- Multiple pods: one row per pod with Logs button -->
                  @if ((res.pods?.length ?? 0) > 1) {
                    @for (pod of res.pods!; track pod.podName) {
                      <tr class="bg-gray-50/60 dark:bg-gray-700/20">
                        <td colspan="4" class="px-3 py-1.5">
                          <div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" [class]="pod.ready ? 'bg-green-500' : 'bg-orange-400'"></span>
                            <span class="font-mono truncate">{{ pod.podName }}</span>
                            <span class="text-gray-400 dark:text-gray-500">{{ pod.phase }}</span>
                          </div>
                        </td>
                        <td class="px-3 py-1.5 text-right">
                          <button
                            class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            (click)="onViewLogs(pod.podName)"
                          >
                            <ng-icon name="lucideFileText" class="h-3 w-3" />
                            Logs
                          </button>
                        </td>
                      </tr>
                    }
                  }
                  <!-- Pod Issues inline -->
                  @for (issue of res.podIssues; track issue.podName) {
                    <tr class="bg-orange-50/30 dark:bg-orange-900/10">
                      <td colspan="5" class="px-3 py-1.5">
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400">
                            <ng-icon name="lucideCircleAlert" class="h-3 w-3 flex-shrink-0" />
                            <span class="font-mono">{{ issue.podName }}</span>
                            <span class="text-orange-500">{{ issue.reason }}</span>
                            @if (issue.message) {
                              <span class="text-gray-500 dark:text-gray-400 truncate max-w-xs">— {{ issue.message }}</span>
                            }
                            @if (issue.restartCount) {
                              <span class="text-gray-400">restarts: {{ issue.restartCount }}</span>
                            }
                          </div>
                          <button
                            class="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            (click)="onViewLogs(issue.podName, issue.containerName)"
                          >
                            <ng-icon name="lucideFileText" class="h-3 w-3" />
                            Logs
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Redeploy result -->
      @if (redeployResult()) {
        <div class="text-xs rounded border px-3 py-2" [class]="redeployResultClass()">
          <p class="font-medium mb-1">{{ redeployResultLabel() }}: {{ redeployResult()!.message }}</p>
          @if (redeployResult()!.restartedResources.length) {
            <p class="text-gray-600 dark:text-gray-300">Restarted: {{ redeployResult()!.restartedResources.join(', ') }}</p>
          }
          @if (redeployResult()!.missingResources.length) {
            <p>Missing: {{ redeployResult()!.missingResources.join(', ') }}</p>
          }
          @if (redeployResult()!.skippedResources.length) {
            <p class="text-gray-500 dark:text-gray-400">Skipped: {{ redeployResult()!.skippedResources.join(', ') }}</p>
          }
        </div>
      }

      <!-- Redeploy button -->
      @if (component().restartSupported) {
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            [disabled]="isRedeploying()"
            (click)="onRedeploy()"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="isRedeploying()"
            />
            {{ isRedeploying() ? 'Redeploying...' : 'Redeploy' }}
          </button>
          <span class="text-xs text-gray-500 dark:text-gray-400">Triggers a rolling restart of workload resources</span>
        </div>
      }

    </div>

    <!-- Logs modal -->
    @if (logsModal()) {
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-gray-900 rounded-lg w-full max-w-5xl shadow-2xl flex flex-col max-h-[85vh]">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Pod Logs</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ logsModal()!.podName }}</p>
            </div>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" (click)="closeLogsModal()">
              <ng-icon name="lucideX" class="h-5 w-5" />
            </button>
          </div>

          <!-- Toolbar -->
          @if (!logsLoading()) {
            <div class="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">

              <!-- Search -->
              <div class="relative flex-1">
                <ng-icon name="lucideSearch" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter across all fields…"
                  [ngModel]="logSearch()"
                  (ngModelChange)="logSearch.set($event)"
                  class="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <!-- Entry count -->
              <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                {{ filteredLogEntries().length }} / {{ logsModal()!.entries.length }}
              </span>

            </div>
          }

          <!-- Modal body -->
          <div class="flex-1 overflow-y-auto p-4">
            @if (logsLoading()) {
              <div class="flex items-center justify-center py-12">
                <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-blue-600" />
              </div>
            } @else {
              <app-log-table
                [entries]="filteredLogEntries()"
                [error]="logsModal()!.parseError"
              />
            }
          </div>

        </div>
      </div>
    }
  `,
})
export class PlatformComponentDetailPanelComponent {
  component = input.required<PlatformComponentResponseDto>();
  clusterId = input.required<string>();
  isRedeploying = input<boolean>(false);
  redeployRequested = output<void>();

  private readonly service = inject(PlatformComponentsService);

  redeployResult = signal<RedeployPlatformComponentResponseDto | null>(null);
  logsModal = signal<{ podName: string; entries: AppLogEntryDto[]; parseError: string | null } | null>(null);
  logsLoading = signal(false);

  readonly logSearch = signal('');

  readonly filteredLogEntries = computed(() => {
    const entries = this.logsModal()?.entries ?? [];
    const q = this.logSearch().toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(e => {
      const metaStr = e.metadata ? JSON.stringify(e.metadata) : '';
      const haystack = [
        e.message, e.pod, e.level, e.container,
        e.namespace, e.stream, e.hostname, e.server_id,
        e.server_type, metaStr,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  });

  replicaClass(res: PlatformComponentResourceStatusDto): string {
    if (!res.replicas) return '';
    const { ready, desired } = res.replicas;
    if (ready === desired) return 'text-green-600 dark:text-green-400';
    if (ready === 0) return 'text-red-600 dark:text-red-400';
    return 'text-yellow-600 dark:text-yellow-400';
  }

  redeployResultClass(): string {
    const r = this.redeployResult()?.result;
    if (r === 'ok') return 'border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400';
    if (r === 'partial') return 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-400';
    return 'border-gray-200 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300';
  }

  redeployResultLabel(): string {
    const r = this.redeployResult()?.result;
    if (r === 'ok') return 'Redeployed';
    if (r === 'partial') return 'Partial redeploy';
    return 'Skipped';
  }

  onRedeploy(): void {
    this.redeployResult.set(null);
    this.redeployRequested.emit();
  }

  async onViewLogs(podName: string, containerName?: string): Promise<void> {
    this.logsModal.set({ podName, entries: [], parseError: null });
    this.logSearch.set('');
    this.logsLoading.set(true);
    const result = await this.service.getPodLogs(
      this.clusterId(),
      this.component().key,
      podName,
      containerName
    );
    this.logsLoading.set(false);
    if (result) {
      const { entries, parseError } = this.parseLogText(result.logs, podName);
      this.logsModal.set({ podName, entries, parseError });
    }
  }

  closeLogsModal(): void {
    this.logsModal.set(null);
  }

  setRedeployResult(result: RedeployPlatformComponentResponseDto): void {
    this.redeployResult.set(result);
  }

  private parseLogText(raw: string, podName: string): { entries: AppLogEntryDto[]; parseError: string | null } {
    if (!raw?.trim()) {
      return { entries: [], parseError: null };
    }

    const lines = raw.split('\n').filter(l => l.trim());
    const entries: AppLogEntryDto[] = [];
    let parseError: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try JSON parse first
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          entries.push({
            timestamp: parsed.timestamp ?? parsed.time ?? parsed.ts ?? new Date().toISOString(),
            level: parsed.level ?? parsed.severity ?? parsed.lvl,
            message: parsed.message ?? parsed.msg ?? parsed.log ?? trimmed,
            pod: parsed.pod ?? podName,
            namespace: parsed.namespace,
            container: parsed.container,
            stream: parsed.stream,
            hostname: parsed.hostname ?? parsed.host,
            metadata: parsed,
          });
          continue;
        } catch {
          // not valid JSON, fall through to plain text
        }
      }

      // Plain text line — try to extract timestamp prefix (e.g. "2026-03-03T10:00:00.000Z ")
      const tsMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)/s);
      if (tsMatch) {
        entries.push({
          timestamp: tsMatch[1],
          message: tsMatch[2],
          pod: podName,
        });
      } else {
        entries.push({
          timestamp: new Date().toISOString(),
          message: trimmed,
          pod: podName,
        });
        if (!parseError) parseError = null; // plain text is fine, not an error
      }
    }

    return { entries, parseError };
  }
}
