import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { clusterCapacity } from './topology-drills';
import { memory, toneOf } from './topology-format';

const PX_PER_MI = 0.022;

/** Each server a column sized by its memory, each app a block sized by what it asks for. */
@Component({
  selector: 'app-topology-capacity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card-surface space-y-4 p-4" aria-label="Cluster capacity">
      <header class="flex flex-wrap items-baseline gap-2">
        <button type="button" class="text-sub hover:underline" (click)="back.emit()">← Map</button>
        <h2 class="text-base font-semibold text-foreground">Capacity · {{ clusterName() }}</h2>
        <span class="text-sub">memory requested per server</span>
      </header>
      @if (model(); as m) {
        <div class="flex items-end gap-4 overflow-x-auto pb-2">
          @for (col of m.columns; track col.server.id) {
            <div class="flex min-w-[6rem] flex-1 flex-col gap-1">
              <div class="flex flex-col-reverse overflow-hidden rounded-md border border-border"
                   [style.height.px]="col.allocatableMi * px" role="list" [attr.aria-label]="col.server.nodeName">
                @for (block of col.blocks; track block.label) {
                  <button type="button" role="listitem"
                          class="flex-none truncate border-t border-card px-1.5 text-left text-[10px] font-medium"
                          [style.height.px]="block.mi * px"
                          [style.background]="block.appId ? fillOf(block.tone) : 'hsl(var(--muted))'"
                          [style.color]="'hsl(var(--foreground))'"
                          [attr.aria-label]="block.label + ', ' + mem(block.mi)"
                          [title]="block.label + ' · ' + mem(block.mi)"
                          (click)="block.appId && selected.emit({ type: 'app', id: block.appId })">
                    @if (block.mi * px >= 14) { {{ block.label }} }
                  </button>
                }
                @if (col.ghost) {
                  <span class="flex-none border-2 border-dashed px-1.5 text-[10px] font-medium"
                        style="border-color: hsl(var(--brand)); color: hsl(var(--brand))"
                        [style.height.px]="ghostHeight(col.ghost)">next replica</span>
                }
                <span class="flex-1" aria-hidden="true"
                      style="background-image: repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / 0.12) 0 4px, transparent 4px 9px)"></span>
              </div>
              <button type="button" class="truncate text-left font-mono text-xs text-foreground hover:underline"
                      (click)="selected.emit({ type: 'server', id: col.server.id })">{{ col.server.nodeName }}</button>
              <span class="text-sub">{{ mem(col.freeMi) }} free of {{ mem(col.allocatableMi) }}</span>
            </div>
          }
        </div>
        @if (m.ghostFits === false) {
          <p class="text-sm status-degraded" role="note">No server has room for another {{ mem(m.ghostMi) }} replica.</p>
        }
      }
    </section>
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

  protected fillOf(status: string): string {
    const tone = toneOf(status);
    if (tone === 'error') return 'hsl(var(--destructive) / 0.25)';
    if (tone === 'degraded') return 'hsl(var(--warn) / 0.25)';
    return 'hsl(var(--brand) / 0.22)';
  }
}
