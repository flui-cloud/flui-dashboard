import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';
import {
  PodDebugInfo,
  hasMissingResources,
  hasUnreadyContainer,
  totalRestarts,
} from '../../../model/pod-debug.models';

const PHASE_TONES: Record<string, StatusTone> = {
  Running: 'success',
  Pending: 'progress',
  Succeeded: 'neutral',
  Failed: 'error',
};

@Component({
  selector: 'tr[app-pod-card]',
  imports: [FlIcon, FlStatus],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  host: { '[class.is-selected]': 'expanded()' },
  template: `
    @let p = pod();
    <td class="fl-cell-name">
      <button
        type="button"
        class="fl-link fl-mono inline-flex max-w-full items-center gap-1.5 text-left"
        [attr.aria-expanded]="expanded()"
        (click)="toggled.emit(p.name)"
      >
        <fl-icon [name]="expanded() ? 'lucideChevronDown' : 'lucideChevronRight'" [size]="14" />
        <span class="truncate">{{ p.name }}</span>
      </button>
    </td>
    <td><fl-status [tone]="phaseTone()" [label]="p.phase" /></td>
    <td class="is-num">{{ readyCount() }}/{{ p.containers.length }}</td>
    <td class="is-num">{{ restarts() }}</td>
    <td class="fl-mono text-fl-ink-secondary">{{ p.nodeName ?? '—' }}</td>
    <td>
      <div class="flex flex-wrap gap-x-3 gap-y-1">
        @if (unready()) {
          <fl-status tone="error" label="Container not ready" />
        }
        @if (missing()) {
          <fl-status tone="error" label="Missing resource" />
        }
        @if (!unready() && !missing()) {
          <span class="text-fl-ink-muted">—</span>
        }
      </div>
    </td>
  `,
})
export class PodCardComponent {
  readonly pod = input.required<PodDebugInfo>();
  readonly expanded = input(false);
  readonly toggled = output<string>();

  protected readonly phaseTone = computed<StatusTone>(
    () => PHASE_TONES[this.pod().phase] ?? 'neutral',
  );
  protected readonly unready = computed(() => hasUnreadyContainer(this.pod()));
  protected readonly missing = computed(() => hasMissingResources(this.pod()));
  protected readonly restarts = computed(() => totalRestarts(this.pod()));
  protected readonly readyCount = computed(
    () => this.pod().containers.filter((c) => c.ready).length,
  );
}
