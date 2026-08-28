import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { ScalingDecision } from '../../model/scaling-group.models';
import { outcomeBadgeClass, whenLabel } from './fleet-history.geometry';

@Component({
  selector: 'app-fleet-history-detail',
  standalone: true,
  imports: [HlmBadgeDirective],
  template: `
    <div
      class="card-surface space-y-3 p-4"
      data-testid="decision-detail"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span [class]="badgeClass()" data-testid="detail-outcome">
          {{ decision().outcome }}
        </span>
        <span
          class="font-mono text-[11px] text-muted-foreground"
          data-testid="detail-force"
        >
          {{ decision().force }}
        </span>
        @if (decision().shape) {
          <span hlmBadge variant="outline" class="text-xs">
            {{ decision().shape }}@if (decision().region) {
              · {{ decision().region }}
            }
          </span>
        }
        <span
          class="ml-auto text-[12px] tabular-nums text-muted-foreground"
          data-testid="detail-at"
        >
          {{ when() }}
        </span>
      </div>

      <dl class="m-0 grid gap-x-4 gap-y-2 sm:grid-cols-[3.5rem_1fr]">
        <dt class="text-label m-0 pt-0.5">Saw</dt>
        <dd class="m-0 text-sm text-foreground" data-testid="detail-saw">
          {{ decision().saw }}
        </dd>
        <dt class="text-label m-0 pt-0.5">Did</dt>
        <dd class="m-0 text-sm text-foreground" data-testid="detail-did">
          {{ decision().did }}
        </dd>
        <dt class="text-label m-0 pt-0.5">Why</dt>
        <dd
          class="m-0 text-sm text-muted-foreground"
          data-testid="detail-why"
        >
          {{ decision().why }}
        </dd>
      </dl>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetHistoryDetailComponent {
  readonly decision = input.required<ScalingDecision>();

  protected readonly badgeClass = computed(() =>
    outcomeBadgeClass(this.decision().outcome),
  );

  protected readonly when = computed(() => whenLabel(this.decision().at));
}
