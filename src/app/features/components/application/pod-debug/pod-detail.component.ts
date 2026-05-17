import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideActivity,
  lucideTerminal,
  lucideHardDrive,
  lucideSettings,
  lucideNetwork,
  lucideTriangleAlert,
  lucideExternalLink,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  ContainerDebugInfo,
  PodDebugInfo,
} from '../../../model/pod-debug.models';

@Component({
  selector: 'app-pod-detail',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideActivity,
      lucideTerminal,
      lucideHardDrive,
      lucideSettings,
      lucideNetwork,
      lucideTriangleAlert,
      lucideExternalLink,
    }),
  ],
  template: `
    <div class="border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-lg bg-gray-50/60 dark:bg-gray-900/20 -mt-2 p-4 space-y-6">
      <!-- Metadata + diagnosis link -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="bg-white dark:bg-gray-800 border rounded-lg p-3 text-xs space-y-1">
          <p class="text-gray-500 dark:text-gray-400 font-medium">Metadata</p>
          <p><span class="text-gray-500">UID:</span> <span class="font-mono break-all">{{ pod.uid }}</span></p>
          <p><span class="text-gray-500">Namespace:</span> <span class="font-mono">{{ pod.namespace }}</span></p>
          @if (pod.qosClass) {
            <p><span class="text-gray-500">QoS:</span> {{ pod.qosClass }}</p>
          }
          @if (pod.creationTimestamp) {
            <p><span class="text-gray-500">Created:</span> {{ formatDate(pod.creationTimestamp) }}</p>
          }
        </div>
        <div class="bg-white dark:bg-gray-800 border rounded-lg p-3 text-xs space-y-1">
          <p class="text-gray-500 dark:text-gray-400 font-medium">Network</p>
          <p><span class="text-gray-500">Pod IP:</span> <span class="font-mono">{{ pod.podIP ?? '—' }}</span></p>
          <p><span class="text-gray-500">Host IP:</span> <span class="font-mono">{{ pod.hostIP ?? '—' }}</span></p>
          <p><span class="text-gray-500">Node:</span> <span class="font-mono">{{ pod.nodeName ?? '—' }}</span></p>
        </div>
      </div>

      @if (pod.latestDiagnosisId) {
        <div class="flex items-center justify-between gap-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 p-3">
          <div class="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-300 min-w-0">
            <ng-icon name="lucideTriangleAlert" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>A diagnosis is available for this pod.</span>
          </div>
          <button hlmBtn size="sm" variant="outline" (click)="openDiagnosis.emit(pod.latestDiagnosisId!)">
            <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 mr-2" />
            Open diagnosis
          </button>
        </div>
      }

      <!-- Conditions -->
      @if (pod.conditions.length) {
        <details open>
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white select-none">Conditions</summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="py-2 pr-3 font-medium">Type</th>
                  <th class="py-2 pr-3 font-medium">Status</th>
                  <th class="py-2 pr-3 font-medium">Reason</th>
                  <th class="py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                @for (c of pod.conditions; track c.type) {
                  <tr class="border-t border-gray-100 dark:border-gray-700/50 align-top">
                    <td class="py-2 pr-3 font-mono">{{ c.type }}</td>
                    <td class="py-2 pr-3">
                      <span
                        class="px-1.5 py-0.5 rounded font-medium"
                        [ngClass]="c.status === 'True'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : c.status === 'False'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'"
                      >
                        {{ c.status }}
                      </span>
                    </td>
                    <td class="py-2 pr-3 font-mono">{{ c.reason ?? '—' }}</td>
                    <td class="py-2 break-words max-w-md">{{ c.message ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }

      <!-- Containers -->
      @if (pod.containers.length) {
        <div class="space-y-3">
          <p class="text-sm font-medium text-gray-900 dark:text-white">Containers</p>
          @for (c of pod.containers; track c.name) {
            <div class="bg-white dark:bg-gray-800 border rounded-lg p-3 text-xs space-y-3">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-semibold text-gray-900 dark:text-white">{{ c.name }}</span>
                <span
                  class="px-1.5 py-0.5 rounded font-medium"
                  [ngClass]="c.ready
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'"
                >
                  {{ c.ready ? 'ready' : 'not ready' }}
                </span>
                <span class="text-gray-500">restarts: {{ c.restartCount }}</span>
              </div>
              <p class="font-mono text-gray-600 dark:text-gray-400 break-all">
                {{ c.image }}
              </p>

              <!-- State -->
              <div>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-1">State</p>
                <p>{{ stateSummary(c) }}</p>
              </div>

              <!-- Resources -->
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <p class="text-gray-500 dark:text-gray-400">Requests</p>
                  <p class="font-mono">{{ c.requests.cpu ?? '—' }} · {{ c.requests.memory ?? '—' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 dark:text-gray-400">Limits</p>
                  <p class="font-mono">{{ c.limits.cpu ?? '—' }} · {{ c.limits.memory ?? '—' }}</p>
                </div>
              </div>

              <!-- Probes -->
              @if (c.readinessProbe || c.livenessProbe || c.startupProbe) {
                <div class="space-y-1">
                  <p class="text-gray-500 dark:text-gray-400 font-medium">Probes</p>
                  @if (c.readinessProbe) { <p>readiness: <span class="font-mono">{{ probeSummary(c.readinessProbe) }}</span></p> }
                  @if (c.livenessProbe)  { <p>liveness: <span class="font-mono">{{ probeSummary(c.livenessProbe) }}</span></p> }
                  @if (c.startupProbe)   { <p>startup: <span class="font-mono">{{ probeSummary(c.startupProbe) }}</span></p> }
                </div>
              }

              <!-- Env -->
              @if (c.env.length) {
                <details>
                  <summary class="cursor-pointer text-gray-500 dark:text-gray-400 font-medium select-none">
                    Env variables ({{ c.env.length }})
                  </summary>
                  <ul class="mt-1 space-y-1">
                    @for (e of c.env; track e.name) {
                      <li class="flex items-start gap-2">
                        <span class="font-mono text-gray-800 dark:text-gray-200 break-all">{{ e.name }}</span>
                        @if (e.valueFrom) {
                          <span class="text-gray-500">
                            ← {{ e.valueFrom.kind }}
                            <span class="font-mono">{{ e.valueFrom.name }}.{{ e.valueFrom.key }}</span>
                          </span>
                          @if (e.valueFrom.exists === false) {
                            <span class="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                              missing resource
                            </span>
                          }
                        } @else if (e.value != null) {
                          <span class="text-gray-500">= <span class="font-mono">{{ e.value }}</span></span>
                        }
                      </li>
                    }
                  </ul>
                </details>
              }
            </div>
          }
        </div>
      }

      <!-- Volumes -->
      @if (pod.volumes.length) {
        <details>
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white select-none">Volumes</summary>
          <ul class="mt-2 space-y-1 text-xs">
            @for (v of pod.volumes; track v.name) {
              <li class="flex items-start gap-2">
                <span class="font-mono text-gray-800 dark:text-gray-200">{{ v.name }}</span>
                <span class="text-gray-500">({{ v.kind }}@if (v.resourceName) { : <span class="font-mono">{{ v.resourceName }}</span> })</span>
                @if (v.exists === false) {
                  <span class="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    missing resource
                  </span>
                }
              </li>
            }
          </ul>
        </details>
      }

      <!-- Events -->
      @if (pod.events.length) {
        <details>
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white select-none">
            Events ({{ pod.events.length }})
          </summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="py-2 pr-3 font-medium">Type</th>
                  <th class="py-2 pr-3 font-medium">Reason</th>
                  <th class="py-2 pr-3 font-medium">Message</th>
                  <th class="py-2 pr-3 font-medium">Count</th>
                  <th class="py-2 font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                @for (ev of sortedEvents(); track $index) {
                  <tr class="border-t border-gray-100 dark:border-gray-700/50 align-top">
                    <td class="py-2 pr-3">
                      <span
                        class="px-1.5 py-0.5 rounded font-medium"
                        [ngClass]="ev.type === 'Warning'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'"
                      >
                        {{ ev.type }}
                      </span>
                    </td>
                    <td class="py-2 pr-3 font-mono">{{ ev.reason }}</td>
                    <td class="py-2 pr-3 break-words max-w-sm">{{ ev.message }}</td>
                    <td class="py-2 pr-3 tabular-nums">
                      {{ ev.count }}
                      @if (ev.count > 10) {
                        <span class="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">repeated</span>
                      }
                    </td>
                    <td class="py-2 text-gray-500 dark:text-gray-400">
                      {{ ev.lastTimestamp ? formatDate(ev.lastTimestamp) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }

      <!-- Scheduling -->
      @if (hasScheduling()) {
        <details>
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white select-none">Scheduling</summary>
          <pre class="mt-2 p-3 rounded-lg bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto">{{ schedulingJson() }}</pre>
        </details>
      }
    </div>
  `,
})
export class PodDetailComponent {
  @Input({ required: true }) pod!: PodDebugInfo;
  @Output() openDiagnosis = new EventEmitter<string>();

  stateSummary(c: ContainerDebugInfo): string {
    if (c.state.running) {
      return `running${c.state.running.startedAt ? ` since ${this.formatDate(c.state.running.startedAt)}` : ''}`;
    }
    if (c.state.waiting) {
      const reason = c.state.waiting.reason ?? 'waiting';
      return c.state.waiting.message ? `${reason} — ${c.state.waiting.message}` : reason;
    }
    if (c.state.terminated) {
      const t = c.state.terminated;
      const parts = [`terminated (${t.reason ?? '—'})`];
      if (t.exitCode != null) parts.push(`exit ${t.exitCode}`);
      if (t.message) parts.push(t.message);
      return parts.join(' · ');
    }
    return 'unknown';
  }

  probeSummary(p: { type?: string | null; path?: string; port?: number | string; command?: string[] }): string {
    if (!p?.type) return '—';
    if (p.type === 'http') return `HTTP ${p.path ?? '/'} :${p.port ?? ''}`;
    if (p.type === 'tcp') return `TCP :${p.port ?? ''}`;
    if (p.type === 'exec') return `exec ${(p.command ?? []).join(' ')}`;
    return p.type;
  }

  sortedEvents() {
    return [...this.pod.events].sort((a, b) => {
      const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
      const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
      return tb - ta;
    });
  }

  hasScheduling(): boolean {
    const s = this.pod.scheduling ?? {};
    return !!(s.nodeSelector || s.tolerations?.length || s.affinity);
  }

  schedulingJson(): string {
    return JSON.stringify(this.pod.scheduling ?? {}, null, 2);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
