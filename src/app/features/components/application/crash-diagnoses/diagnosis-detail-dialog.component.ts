import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideRotateCcw, lucideWand, lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { FlStatus } from '../../../../ui/primitives/status';
import {
  AutoFixActionPayload,
  CrashDiagnosis,
  autoFixPayload,
  isAutoRemediated,
} from '../../../model/crash-diagnosis.models';
import { K8sEventsTable } from '../k8s-events-table';
import { SEVERITY_STATUS, diagnosisCategoryLabel, formatDateTime } from './diagnosis-labels';

type ConfigurationPayload = { envVar?: string; kind?: string; name?: string } | undefined;

@Component({
  selector: 'app-diagnosis-detail-dialog',
  imports: [
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlStatus,
    FlAlert,
    FlButton,
    FlIcon,
    FlSpinner,
    K8sEventsTable,
  ],
  providers: [provideIcons({ lucideX, lucideExternalLink, lucideRotateCcw, lucideWand })],
  host: { class: 'block' },
  template: `
    @if (diagnosis(); as d) {
      <fl-panel [title]="d.title">
        <ng-container panelActions>
          @if (!d.resolvedAt) {
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="dismissing()"
              (click)="onDismiss()"
            >
              @if (dismissing()) {
                <fl-spinner label="Dismissing" />
                Dismissing…
              } @else {
                Dismiss
              }
            </button>
          }
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Close"
            (click)="close()"
          >
            <fl-icon name="lucideX" />
          </button>
        </ng-container>

        <div class="flex flex-col gap-5">
          <fl-key-value>
            <fl-kv-item key="Severity">
              <fl-status [tone]="severity().tone" [label]="severity().label" />
            </fl-kv-item>
            <fl-kv-item key="State">
              @if (d.resolvedAt) {
                <fl-status tone="success" label="Resolved" />
              } @else {
                <fl-status tone="neutral" label="Open" />
              }
            </fl-kv-item>
            <fl-kv-item key="Category">{{ category() }}</fl-kv-item>
            <fl-kv-item key="Detected">{{ formatDate(d.createdAt) }}</fl-kv-item>
            <fl-kv-item key="Pod" [mono]="true">{{ d.podName }}</fl-kv-item>
            @if (d.containerName) {
              <fl-kv-item key="Container" [mono]="true">{{ d.containerName }}</fl-kv-item>
            }
            @if (d.patternMatchedKey) {
              <fl-kv-item key="Matched pattern" [mono]="true">{{ d.patternMatchedKey }}</fl-kv-item>
            }
            @if (d.evidence.exitCode != null) {
              <fl-kv-item key="Exit code" [mono]="true">{{ d.evidence.exitCode }}</fl-kv-item>
            }
            @if (d.evidence.lastTerminationReason) {
              <fl-kv-item key="Last termination reason" [mono]="true">
                {{ d.evidence.lastTerminationReason }}
              </fl-kv-item>
            }
            @if (autoFix(); as af) {
              <fl-kv-item key="Memory limit" [mono]="true">
                {{ af.previousMemoryLimit }} → {{ af.newMemoryLimit }}
              </fl-kv-item>
            }
          </fl-key-value>

          <p class="m-0 whitespace-pre-wrap text-fl-body-sm text-fl-ink">{{ d.explanation }}</p>

          @if (d.evidence.missingResource; as missing) {
            <fl-alert tone="error" [title]="'Missing ' + missing.kind">
              <span class="fl-mono">{{ missing.name }}</span>
            </fl-alert>
          }

          @if (d.suggestedAction) {
            <section class="flex flex-col gap-2">
              <h3 class="m-0 text-fl-body-sm font-semibold text-fl-ink">
                {{ autoRemediated() ? 'Applied automatically' : 'Suggested action' }}
              </h3>
              <p class="m-0 whitespace-pre-wrap text-fl-body-sm text-fl-ink-secondary">
                {{ d.suggestedAction.message }}
              </p>
              @if (!autoRemediated()) {
                @if (canApply()) {
                  <div class="fl-row">
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="applying()"
                      (click)="onApply()"
                    >
                      @if (applying()) {
                        <fl-spinner label="Applying" />
                        Applying…
                      } @else {
                        <fl-icon name="lucideWand" />
                        Apply
                      }
                    </button>
                  </div>
                  @if (applyError()) {
                    <fl-alert tone="error" title="Could not apply the change">
                      {{ applyError() }}
                    </fl-alert>
                  }
                } @else if (showUserInputCta()) {
                  <div class="fl-row">
                    <button flButton size="sm" type="button" (click)="gotoConfiguration()">
                      <fl-icon name="lucideExternalLink" />
                      {{ userInputCtaLabel() }}
                    </button>
                  </div>
                } @else if (d.suggestedAction.type === 'redeploy') {
                  <div class="fl-row">
                    <button flButton size="sm" type="button" [disabled]="true" title="Coming soon">
                      <fl-icon name="lucideRotateCcw" />
                      Redeploy (coming soon)
                    </button>
                  </div>
                }
              }
            </section>
          }

          @if (d.evidence.logsSnippet) {
            <details open>
              <summary class="cursor-pointer select-none text-fl-body-sm font-semibold text-fl-ink">
                Log excerpt
              </summary>
              <pre
                class="fl-mono m-0 mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
                >{{ d.evidence.logsSnippet }}</pre>
            </details>
          }

          @if (d.evidence.events?.length) {
            <details>
              <summary class="cursor-pointer select-none text-fl-body-sm font-semibold text-fl-ink">
                Kubernetes events ({{ d.evidence.events!.length }})
              </summary>
              <div
                class="mt-2 overflow-hidden rounded-fl-md border border-fl-border bg-fl-surface-subtle"
              >
                <app-k8s-events-table [events]="d.evidence.events!" />
              </div>
            </details>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class DiagnosisDetailDialogComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly diagnosis = input<CrashDiagnosis | null>(null);
  readonly applicationId = input<string | null>(null);

  readonly closed = output<void>();
  readonly dismiss = output<CrashDiagnosis>();
  readonly apply = output<CrashDiagnosis>();

  readonly applying = input(false);
  readonly applyError = input<string | null>(null);

  readonly dismissing = linkedSignal({ source: this.diagnosis, computation: () => false });

  private shownId: string | null = null;

  readonly severity = computed(() => {
    const d = this.diagnosis();
    return SEVERITY_STATUS[d?.severity ?? 'info'];
  });

  readonly category = computed(() => {
    const d = this.diagnosis();
    return d ? diagnosisCategoryLabel(d.category) : '';
  });

  readonly autoRemediated = computed(() => {
    const d = this.diagnosis();
    return d ? isAutoRemediated(d) : false;
  });

  readonly autoFix = computed<AutoFixActionPayload | null>(() => {
    const d = this.diagnosis();
    return d ? autoFixPayload(d) : null;
  });

  constructor() {
    effect(() => {
      const id = this.diagnosis()?.id ?? null;
      if (id === this.shownId) return;
      this.shownId = id;
      if (!id) return;
      untracked(() =>
        afterNextRender(
          { write: () => this.host.nativeElement.scrollIntoView({ block: 'nearest' }) },
          { injector: this.injector },
        ),
      );
    });
  }

  canApply(): boolean {
    const d = this.diagnosis();
    return d?.suggestedAction?.type === 'resources' && !d.resolvedAt;
  }

  onApply(): void {
    const d = this.diagnosis();
    if (!d) return;
    this.apply.emit(d);
  }

  showUserInputCta(): boolean {
    return this.diagnosis()?.suggestedAction?.type === 'user_input';
  }

  userInputCtaLabel(): string {
    const payload = this.configurationPayload();
    if (payload?.envVar) return `Add variable: ${payload.envVar}`;
    if (payload?.kind && payload?.name) return `Fix ${payload.kind}: ${payload.name}`;
    return 'Open configuration';
  }

  gotoConfiguration(): void {
    const applicationId = this.applicationId();
    if (!applicationId) return;
    const payload = this.configurationPayload();
    const queryParams: Record<string, string> = {};
    if (payload?.envVar) queryParams['focusVar'] = payload.envVar;
    else if (payload?.kind && payload?.name) {
      queryParams['missingKind'] = payload.kind;
      queryParams['missingName'] = payload.name;
    }
    this.router.navigate(['/apps/applications', applicationId, 'configuration'], {
      queryParams,
    });
    this.close();
  }

  formatDate(iso: string): string {
    return formatDateTime(iso);
  }

  close(): void {
    this.closed.emit();
  }

  onDismiss(): void {
    const d = this.diagnosis();
    if (!d) return;
    this.dismissing.set(true);
    this.dismiss.emit(d);
  }

  setDismissing(v: boolean): void {
    this.dismissing.set(v);
  }

  private configurationPayload(): ConfigurationPayload {
    return this.diagnosis()?.suggestedAction?.payload as ConfigurationPayload;
  }
}
