import { Component, EventEmitter, Input, Output, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideExternalLink,
  lucideRotateCcw,
  lucideInfo,
  lucideLoader,
  lucideCircleCheck,
  lucideTerminal,
  lucideActivity,
  lucideTriangleAlert,
  lucideWand,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  AutoFixActionPayload,
  CrashDiagnosis,
  autoFixPayload,
  categoryLabel,
  isAutoRemediated,
  severityBadgeClass,
} from '../../../model/crash-diagnosis.models';

@Component({
  selector: 'app-diagnosis-detail-dialog',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideX,
      lucideExternalLink,
      lucideRotateCcw,
      lucideInfo,
      lucideLoader,
      lucideCircleCheck,
      lucideTerminal,
      lucideActivity,
      lucideTriangleAlert,
      lucideWand,
    }),
  ],
  template: `
    @if (diagnosis) {
      <div
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto"
        (click)="close()"
      >
        <div class="flex min-h-screen items-start justify-center p-4">
          <div
            class="relative w-full max-w-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl my-8"
            (click)="$event.stopPropagation()"
          >
            <!-- Header -->
            <div class="flex items-start justify-between gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex-1 space-y-2 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span [class]="severityClass()">{{ diagnosis.severity }}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                    {{ category() }}
                  </span>
                  @if (diagnosis.patternMatchedKey) {
                    <span class="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-mono">
                      {{ diagnosis.patternMatchedKey }}
                    </span>
                  }
                  @if (autoRemediated()) {
                    <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 font-medium">
                      <ng-icon name="lucideWand" class="h-3 w-3" />
                      Auto-remediated
                    </span>
                  }
                  @if (autoFix(); as af) {
                    <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 font-mono">
                      Memory {{ af.previousMemoryLimit }} → {{ af.newMemoryLimit }}
                    </span>
                  }
                  @if (diagnosis.resolvedAt) {
                    <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                      <ng-icon name="lucideCircleCheck" class="h-3 w-3" />
                      resolved
                    </span>
                  }
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white break-words">
                  {{ diagnosis.title }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Pod: <span class="font-mono">{{ diagnosis.podName }}</span>
                  @if (diagnosis.containerName) {
                    · <span class="font-mono">{{ diagnosis.containerName }}</span>
                  }
                  · {{ formatDate(diagnosis.createdAt) }}
                </p>
              </div>
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                (click)="close()"
                class="h-8 w-8 p-0 flex-shrink-0"
                aria-label="Close"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-6">
              <!-- Explanation -->
              <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {{ diagnosis.explanation }}
              </p>

              <!-- Suggested action -->
              @if (diagnosis.suggestedAction) {
                @if (autoRemediated()) {
                  <div class="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-4 space-y-3">
                    <div class="flex items-start gap-2">
                      <ng-icon name="lucideWand" class="h-4 w-4 text-purple-700 dark:text-purple-300 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-purple-900 dark:text-purple-200 whitespace-pre-wrap">
                        {{ diagnosis.suggestedAction.message }}
                      </p>
                    </div>
                    @if (redeployInProgress) {
                      <div class="flex items-center gap-2 text-xs text-purple-800 dark:text-purple-300">
                        <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                        Redeploy in progress
                      </div>
                    }
                  </div>
                } @else {
                  <div class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-3">
                    <div class="flex items-start gap-2">
                      <ng-icon name="lucideInfo" class="h-4 w-4 text-blue-700 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap">
                        {{ diagnosis.suggestedAction.message }}
                      </p>
                    </div>
                    @if (showUserInputCta()) {
                      <button hlmBtn size="sm" (click)="gotoConfiguration()">
                        <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 mr-2" />
                        {{ userInputCtaLabel() }}
                      </button>
                    } @else if (diagnosis.suggestedAction.type === 'redeploy') {
                      <button hlmBtn size="sm" variant="outline" [disabled]="true" title="Coming in Phase 3">
                        <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5 mr-2" />
                        Redeploy (coming soon)
                      </button>
                    }
                  </div>
                }
              }

              <!-- Evidence: exit code & termination reason -->
              @if (diagnosis.evidence.exitCode != null || diagnosis.evidence.lastTerminationReason) {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @if (diagnosis.evidence.exitCode != null) {
                    <div class="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <p class="text-xs text-gray-500 dark:text-gray-400">Exit code</p>
                      <p class="text-sm font-mono font-medium">{{ diagnosis.evidence.exitCode }}</p>
                    </div>
                  }
                  @if (diagnosis.evidence.lastTerminationReason) {
                    <div class="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <p class="text-xs text-gray-500 dark:text-gray-400">Last termination reason</p>
                      <p class="text-sm font-mono font-medium">{{ diagnosis.evidence.lastTerminationReason }}</p>
                    </div>
                  }
                </div>
              }

              <!-- Missing resource -->
              @if (diagnosis.evidence.missingResource) {
                <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-800 dark:text-red-300">
                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideTriangleAlert" class="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      Missing resource:
                      <span class="font-medium">{{ diagnosis.evidence.missingResource!.kind }}</span>
                      <span class="font-mono">{{ diagnosis.evidence.missingResource!.name }}</span>
                    </div>
                  </div>
                </div>
              }

              <!-- Logs snippet -->
              @if (diagnosis.evidence.logsSnippet) {
                <details class="group" open>
                  <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 select-none">
                    <ng-icon name="lucideTerminal" class="h-4 w-4 text-gray-500" />
                    Log snippet
                  </summary>
                  <pre class="mt-2 p-3 rounded-lg bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{{ diagnosis.evidence.logsSnippet }}</pre>
                </details>
              }

              <!-- Events -->
              @if (diagnosis.evidence.events?.length) {
                <details class="group">
                  <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 select-none">
                    <ng-icon name="lucideActivity" class="h-4 w-4 text-gray-500" />
                    Kubernetes events ({{ diagnosis.evidence.events!.length }})
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
                        @for (ev of diagnosis.evidence!.events; track $index) {
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
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button hlmBtn variant="outline" (click)="close()">Close</button>
              @if (!diagnosis.resolvedAt) {
                <button
                  hlmBtn
                  (click)="onDismiss()"
                  [disabled]="dismissing()"
                >
                  @if (dismissing()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                    Dismissing…
                  } @else {
                    <ng-icon name="lucideCircleCheck" class="h-4 w-4 mr-2" />
                    Dismiss
                  }
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class DiagnosisDetailDialogComponent {
  private readonly router = inject(Router);

  private _diagnosis: CrashDiagnosis | null = null;
  @Input()
  set diagnosis(value: CrashDiagnosis | null) {
    this._diagnosis = value;
    this.dismissing.set(false);
  }
  get diagnosis(): CrashDiagnosis | null {
    return this._diagnosis;
  }
  @Input() applicationId: string | null = null;
  /** True when the app is currently in an UPDATING/PROVISIONING status
   * driven by the actuator's auto-remediation redeploy. */
  @Input() redeployInProgress = false;

  @Output() closed = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<CrashDiagnosis>();

  dismissing = signal(false);

  severityClass = computed(() =>
    this.diagnosis ? severityBadgeClass(this.diagnosis.severity) : '',
  );

  category = computed(() =>
    this.diagnosis ? categoryLabel(this.diagnosis.category) : '',
  );

  autoRemediated = computed(() =>
    this.diagnosis ? isAutoRemediated(this.diagnosis) : false,
  );

  autoFix = computed<AutoFixActionPayload | null>(() =>
    this.diagnosis ? autoFixPayload(this.diagnosis) : null,
  );

  showUserInputCta(): boolean {
    return this.diagnosis?.suggestedAction?.type === 'user_input';
  }

  userInputCtaLabel(): string {
    const payload = this.diagnosis?.suggestedAction?.payload as
      | { envVar?: string; kind?: string; name?: string }
      | undefined;
    if (payload?.envVar) return `Add variable: ${payload.envVar}`;
    if (payload?.kind && payload?.name) return `Fix ${payload.kind}: ${payload.name}`;
    return 'Open configuration';
  }

  gotoConfiguration(): void {
    if (!this.applicationId) return;
    const payload = this.diagnosis?.suggestedAction?.payload as
      | { envVar?: string; kind?: string; name?: string }
      | undefined;
    const queryParams: Record<string, string> = {};
    if (payload?.envVar) queryParams['focusVar'] = payload.envVar;
    else if (payload?.kind && payload?.name) {
      queryParams['missingKind'] = payload.kind;
      queryParams['missingName'] = payload.name;
    }
    this.router.navigate(['/apps/applications', this.applicationId, 'configuration'], {
      queryParams,
    });
    this.close();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  close(): void {
    this.closed.emit();
  }

  onDismiss(): void {
    if (!this.diagnosis) return;
    this.dismissing.set(true);
    this.dismiss.emit(this.diagnosis);
  }

  setDismissing(v: boolean): void {
    this.dismissing.set(v);
  }
}
