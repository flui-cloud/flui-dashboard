import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { CapacityBlock, CapacityColumn, clusterCapacity } from './topology-drills';
import { memory } from './topology-format';
import { kitToneOfStatus } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

const PX_PER_MI = 0.022;

/** Each server a column sized by its memory, each app a block sized by what it asks for. */
@Component({
  selector: 'app-topology-capacity',
  imports: [FlPanel, FlAlert, FlUsageBar, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideArrowLeft })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel [title]="'Capacity · ' + clusterName()">
      <button panelActions flButton="ghost" size="sm" type="button" (click)="back.emit()">
        <fl-icon name="lucideArrowLeft" />
        Map
      </button>
      <div class="flex flex-col gap-4">
        <p class="text-fl-body-sm text-fl-ink-muted">Memory requested per server.</p>
        @if (model(); as m) {
          <div class="flex items-end gap-4 overflow-x-auto pb-2">
            @for (col of m.columns; track col.server.id) {
              <div class="flex min-w-36 flex-1 flex-col gap-2">
                <div
                  class="flex flex-col-reverse overflow-hidden rounded-fl-md border border-fl-border bg-fl-surface"
                  [style.height.px]="col.allocatableMi * px"
                  role="list"
                  [attr.aria-label]="col.server.nodeName"
                >
                  @for (block of col.blocks; track block.label) {
                    <button
                      type="button"
                      role="listitem"
                      class="flex flex-none items-center overflow-hidden border-t border-fl-border px-1.5 text-left text-fl-caption font-medium text-fl-ink focus-visible:shadow-fl-focus focus-visible:outline-none"
                      [class.bg-fl-surface-subtle]="block.appId"
                      [class.bg-fl-surface-hover]="!block.appId"
                      [class.text-fl-ink-muted]="!block.appId"
                      [style.height.px]="block.mi * px"
                      [attr.aria-label]="block.label + ', ' + mem(block.mi)"
                      [title]="block.label + ' · ' + mem(block.mi)"
                      (click)="block.appId && selected.emit({ type: 'app', id: block.appId })"
                    >
                      @if (block.mi * px >= 14) {
                        @if (flagged(block)) {
                          <fl-status class="min-w-0" [tone]="toneOf(block)" [label]="block.label" />
                        } @else {
                          <span class="truncate">{{ block.label }}</span>
                        }
                      }
                    </button>
                  }
                  @if (col.ghost) {
                    <span
                      class="flex flex-none items-center border border-dashed border-fl-accent px-1.5 text-fl-caption font-medium text-fl-accent"
                      [style.height.px]="ghostHeight(col.ghost)"
                      >next replica</span
                    >
                  }
                  <span class="flex-1" aria-hidden="true"></span>
                </div>
                <button
                  type="button"
                  class="fl-link truncate text-left font-mono text-fl-caption"
                  (click)="selected.emit({ type: 'server', id: col.server.id })"
                >
                  {{ col.server.nodeName }}
                </button>
                <fl-usage-bar
                  [percent]="usedPct(col)"
                  [label]="'Memory requested on ' + col.server.nodeName"
                />
                <span class="text-fl-caption text-fl-ink-muted"
                  >{{ mem(col.freeMi) }} free of {{ mem(col.allocatableMi) }}</span
                >
              </div>
            }
          </div>
          @if (m.ghostFits === false) {
            <fl-alert tone="warning" title="No room for another replica">
              No server has room for another {{ mem(m.ghostMi) }} replica.
            </fl-alert>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class TopologyCapacityComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly clusterId = input.required<string>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly selected = output<TopologyFocus>();
  readonly back = output<void>();

  protected readonly px = PX_PER_MI;
  protected readonly clusterName = computed(
    () => this.snapshot().clusters.find((c) => c.id === this.clusterId())?.name ?? '',
  );
  protected readonly model = computed(() => {
    const f = this.focus();
    return clusterCapacity(this.snapshot(), this.clusterId(), f?.type === 'app' ? f.id : null);
  });

  protected ghostHeight(mi: number): number {
    return Math.max(18, mi * PX_PER_MI);
  }

  protected mem(mi: number): string {
    return memory(mi);
  }

  protected usedPct(col: CapacityColumn): number {
    if (!col.allocatableMi) return 0;
    return ((col.allocatableMi - col.freeMi) / col.allocatableMi) * 100;
  }

  protected toneOf(block: CapacityBlock) {
    return kitToneOfStatus(block.tone);
  }

  protected flagged(block: CapacityBlock): boolean {
    const tone = this.toneOf(block);
    return !!block.appId && (tone === 'error' || tone === 'warning');
  }
}
