import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideRefreshCw, lucideX } from '@ng-icons/lucide';
import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';
import { PlatformComponentResourceStatusDto } from '../../../core/api/model/platformComponentResourceStatusDto';
import { RedeployPlatformComponentResponseDto } from '../../../core/api/model/redeployPlatformComponentResponseDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { PlatformComponentStatusBadgeComponent } from './platform-component-status-badge.component';
import { PlatformComponentLogsDialog } from './platform-component-logs-dialog';

interface LogsTarget {
  readonly podName: string;
  readonly containerName?: string;
}

@Component({
  selector: 'app-platform-component-detail-panel',
  imports: [
    CdkTrapFocus,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    FlTag,
    PlatformComponentStatusBadgeComponent,
    PlatformComponentLogsDialog,
  ],
  providers: [provideIcons({ lucideFileText, lucideRefreshCw, lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-component-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="platform-component-title">{{ component().name }}</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <fl-key-value>
            <fl-kv-item key="Status">
              <app-platform-component-status-badge [status]="component().status" />
            </fl-kv-item>
            @if (clusterName()) {
              <fl-kv-item key="Cluster">{{ clusterName() }}</fl-kv-item>
            }
            <fl-kv-item key="Category">{{ component().category }}</fl-kv-item>
            <fl-kv-item key="Managed by"
              ><fl-tag>{{ component().managedBy }}</fl-tag></fl-kv-item
            >
          </fl-key-value>

          @if (component().errors.length) {
            <fl-alert
              tone="error"
              [title]="
                component().errors.length === 1 ? '1 error' : component().errors.length + ' errors'
              "
            >
              <ul class="flex flex-col gap-1">
                @for (err of component().errors; track err) {
                  <li class="fl-mono">{{ err }}</li>
                }
              </ul>
            </fl-alert>
          }

          @if (component().resources.length) {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Resource</th>
                    <th scope="col">Namespace</th>
                    <th scope="col">Status</th>
                    <th scope="col">Replicas</th>
                    <th scope="col" class="is-fit"><span class="fl-sr">Logs</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (res of component().resources; track res.name) {
                    <tr>
                      <td class="fl-mono">
                        <span class="text-fl-ink-muted">{{ res.kind }}/</span>{{ res.name }}
                      </td>
                      <td class="fl-mono">{{ res.namespace }}</td>
                      <td><app-platform-component-status-badge [status]="res.status" /></td>
                      <td>
                        @if (res.replicas) {
                          <fl-status
                            [tone]="replicaTone(res)"
                            [label]="res.replicas.ready + '/' + res.replicas.desired"
                          />
                        } @else {
                          <span class="text-fl-ink-muted">—</span>
                        }
                      </td>
                      <td class="is-fit">
                        @if (res.pods?.length === 1) {
                          <button
                            flButton="ghost"
                            size="sm"
                            type="button"
                            (click)="onViewLogs(res.pods![0].podName)"
                          >
                            <fl-icon name="lucideFileText" [size]="14" />
                            Logs
                          </button>
                        }
                      </td>
                    </tr>
                    @if ((res.pods?.length ?? 0) > 1) {
                      @for (pod of res.pods!; track pod.podName) {
                        <tr>
                          <td colspan="4">
                            <span class="fl-row">
                              <fl-status
                                [tone]="pod.ready ? 'success' : 'warning'"
                                [label]="pod.phase || (pod.ready ? 'Ready' : 'Not ready')"
                              />
                              <span class="fl-mono">{{ pod.podName }}</span>
                            </span>
                          </td>
                          <td class="is-fit">
                            <button
                              flButton="ghost"
                              size="sm"
                              type="button"
                              (click)="onViewLogs(pod.podName)"
                            >
                              <fl-icon name="lucideFileText" [size]="14" />
                              Logs
                            </button>
                          </td>
                        </tr>
                      }
                    }
                    @for (issue of res.podIssues; track issue.podName) {
                      <tr>
                        <td colspan="4" class="whitespace-normal">
                          <span class="fl-row">
                            <fl-status tone="warning" [label]="issue.reason ?? issue.phase" />
                            <span class="fl-mono">{{ issue.podName }}</span>
                            @if (issue.message) {
                              <span class="text-fl-ink-muted">{{ issue.message }}</span>
                            }
                            @if (issue.restartCount) {
                              <span class="text-fl-ink-muted fl-num"
                                >{{ issue.restartCount }} restarts</span
                              >
                            }
                          </span>
                        </td>
                        <td class="is-fit">
                          <button
                            flButton="ghost"
                            size="sm"
                            type="button"
                            (click)="onViewLogs(issue.podName, issue.containerName)"
                          >
                            <fl-icon name="lucideFileText" [size]="14" />
                            Logs
                          </button>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }

          @if (redeployResult(); as r) {
            <fl-alert
              [tone]="r.result === 'partial' ? 'warning' : 'info'"
              [title]="redeployResultLabel()"
            >
              {{ r.message }}
              @if (r.restartedResources.length) {
                <span class="block">Restarted: {{ r.restartedResources.join(', ') }}</span>
              }
              @if (r.missingResources.length) {
                <span class="block">Missing: {{ r.missingResources.join(', ') }}</span>
              }
              @if (r.skippedResources.length) {
                <span class="block">Skipped: {{ r.skippedResources.join(', ') }}</span>
              }
            </fl-alert>
          }

          @if (component().restartSupported) {
            <p class="text-fl-caption text-fl-ink-muted">
              Redeploy triggers a rolling restart of the workload resources.
            </p>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="closed.emit()">Close</button>
          @if (component().restartSupported) {
            <button
              flButton="primary"
              type="button"
              [disabled]="isRedeploying()"
              (click)="onRedeploy()"
            >
              @if (isRedeploying()) {
                <fl-spinner label="Redeploying" />
                Redeploying…
              } @else {
                <fl-icon name="lucideRefreshCw" />
                Redeploy
              }
            </button>
          }
        </footer>
      </div>
    </div>

    @if (logsTarget(); as target) {
      <app-platform-component-logs-dialog
        [clusterId]="clusterId()"
        [componentKey]="component().key"
        [podName]="target.podName"
        [containerName]="target.containerName"
        (closed)="closeLogsModal()"
      />
    }
  `,
})
export class PlatformComponentDetailPanelComponent {
  component = input.required<PlatformComponentResponseDto>();
  clusterId = input.required<string>();
  clusterName = input<string>('');
  isRedeploying = input<boolean>(false);
  redeployRequested = output<void>();
  closed = output<void>();

  redeployResult = signal<RedeployPlatformComponentResponseDto | null>(null);
  readonly logsTarget = signal<LogsTarget | null>(null);

  replicaTone(res: PlatformComponentResourceStatusDto): StatusTone {
    if (!res.replicas) return 'neutral';
    const { ready, desired } = res.replicas;
    if (ready === desired) return 'success';
    if (ready === 0) return 'error';
    return 'warning';
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

  onViewLogs(podName: string, containerName?: string): void {
    this.logsTarget.set({ podName, containerName });
  }

  closeLogsModal(): void {
    this.logsTarget.set(null);
  }

  setRedeployResult(result: RedeployPlatformComponentResponseDto): void {
    this.redeployResult.set(result);
  }
}
