import { Component, computed, input, output } from '@angular/core';
import { FlStatus } from '../../../../ui/primitives/status';
import {
  CrashDiagnosis,
  autoFixPayload,
  isAutoRemediated,
} from '../../../model/crash-diagnosis.models';
import { SEVERITY_STATUS, diagnosisCategoryLabel, formatDateTime } from './diagnosis-labels';

@Component({
  selector: 'tr[app-diagnosis-row]',
  imports: [FlStatus],
  host: { '[class.is-selected]': 'selected()' },
  template: `
    @let d = diagnosis();
    <td>
      <fl-status [tone]="severity().tone" [label]="severity().label" />
    </td>
    <td class="whitespace-normal">
      <div class="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          class="fl-link text-left"
          [attr.aria-expanded]="selected()"
          (click)="clicked.emit(d)"
        >
          {{ d.title }}
        </button>
        <span class="text-fl-caption text-fl-ink-muted">
          {{ category() }} · <span class="fl-mono">{{ d.podName }}</span>
          @if (d.containerName) {
            · <span class="fl-mono">{{ d.containerName }}</span>
          }
          @if (autoRemediated()) {
            · Fixed automatically
          }
          @if (memoryChange(); as change) {
            · Memory <span class="fl-mono">{{ change }}</span>
          }
        </span>
      </div>
    </td>
    <td class="text-fl-ink-muted">{{ detected() }}</td>
    <td>
      @if (d.resolvedAt) {
        <fl-status tone="success" label="Resolved" />
      } @else {
        <fl-status tone="neutral" label="Open" />
      }
    </td>
  `,
})
export class DiagnosisRowComponent {
  readonly diagnosis = input.required<CrashDiagnosis>();
  readonly selected = input(false);
  readonly clicked = output<CrashDiagnosis>();

  protected readonly severity = computed(() => SEVERITY_STATUS[this.diagnosis().severity]);
  protected readonly category = computed(() => diagnosisCategoryLabel(this.diagnosis().category));
  protected readonly autoRemediated = computed(() => isAutoRemediated(this.diagnosis()));
  protected readonly detected = computed(() => formatDateTime(this.diagnosis().createdAt));
  protected readonly memoryChange = computed(() => {
    const fix = autoFixPayload(this.diagnosis());
    if (!fix?.previousMemoryLimit || !fix.newMemoryLimit) return null;
    return `${fix.previousMemoryLimit} → ${fix.newMemoryLimit}`;
  });
}
