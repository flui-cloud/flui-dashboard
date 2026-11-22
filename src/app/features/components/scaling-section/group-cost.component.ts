import { Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingCost, ScalingCostDraft } from '../../model/scaling-group.models';
import { costRows } from './group-cost-format';
import { formatMoney } from '../../../shared/utils/money';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

type Reading =
  | { state: 'loading' }
  | { state: 'invalid' }
  | { state: 'failed' }
  | { state: 'read'; cost: ScalingCost };

/**
 * What the node limits cost, as the API prices them for the draft on screen:
 * scenarios from the minimum to the maximum, and the spending ceiling under
 * them. The page never multiplies a price itself.
 */
@Component({
  selector: 'app-group-cost',
  imports: [FlAlert, FlPanel, FlTable, FlButton, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel title="What these limits can cost" [flush]="true" data-testid="group-cost">
      @switch (reading().state) {
        @case ('loading') {
          <div class="p-4"><fl-status tone="progress" label="Pricing" /></div>
        }
        @case ('invalid') {
          <p class="m-0 p-4 text-fl-body-sm text-fl-ink-muted">
            Fix the node limits above to see what they cost.
          </p>
        }
        @case ('failed') {
          <p class="m-0 p-4 text-fl-body-sm text-fl-ink-muted" data-testid="group-cost-failed">
            The cost could not be read just now.
          </p>
        }
        @case ('read') {
          @if (cost(); as c) {
            <p class="m-0 p-4 text-fl-body-sm text-fl-ink-muted" data-testid="group-cost-says">
              {{ c.says }}
            </p>
            @if (rows().length) {
              <div class="fl-table-wrap border-t border-fl-border">
                <table flTable density="dense">
                  <thead>
                    <tr>
                      <th scope="col">Scenario</th>
                      <th scope="col" class="is-num">Per month</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows(); track row.kind) {
                      <tr [attr.data-testid]="'cost-' + row.kind">
                        <td class="whitespace-normal">{{ row.label }}</td>
                        <td class="is-num fl-mono">{{ row.value }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (c.ceiling.says || offerCeiling()) {
              <div class="flex flex-col items-start gap-3 border-t border-fl-border p-4">
                @if (c.ceiling.says) {
                  @if (c.ceiling.stopsBeforeMax) {
                    <fl-alert
                      tone="warning"
                      title="The ceiling stops before the maximum"
                      data-testid="group-cost-ceiling"
                    >
                      {{ c.ceiling.says }}
                    </fl-alert>
                  } @else {
                    <p
                      class="m-0 text-fl-body-sm text-fl-ink-muted"
                      data-testid="group-cost-ceiling"
                    >
                      {{ c.ceiling.says }}
                    </p>
                  }
                }
                @if (offerCeiling(); as suggested) {
                  <button
                    flButton
                    size="sm"
                    type="button"
                    data-testid="group-cost-use-suggested"
                    (click)="useCeiling.emit(suggested)"
                  >
                    Set the spending ceiling to {{ money(suggested) }}, the worst case
                  </button>
                }
              </div>
            }
          }
        }
      }
    </fl-panel>
  `,
})
export class GroupCostComponent {
  protected readonly money = formatMoney;

  private readonly api = inject(ScalingApiService);

  readonly clusterId = input.required<string>();
  /** The limits on screen; null while they cannot be priced (a field out of range). */
  readonly draft = input.required<Partial<ScalingCostDraft> | null>();
  /** Whether automatic buying is chosen with no spending ceiling yet. */
  readonly needsCeiling = input(false);
  readonly useCeiling = output<number>();

  private readonly ask = computed<{ clusterId: string; body: Partial<ScalingCostDraft> } | null>(
    () => {
      const body = this.draft();
      return body ? { clusterId: this.clusterId(), body } : null;
    },
  );

  protected readonly reading = toSignal(
    toObservable(this.ask).pipe(
      map((ask) => (ask ? JSON.stringify(ask) : null)),
      distinctUntilChanged(),
      debounceTime(300),
      switchMap((key) => {
        if (!key) return of<Reading>({ state: 'invalid' });
        const ask = JSON.parse(key) as { clusterId: string; body: Partial<ScalingCostDraft> };
        return this.api.cost(ask.clusterId, ask.body).pipe(
          map((cost): Reading => ({ state: 'read', cost })),
          catchError(() => of<Reading>({ state: 'failed' })),
          startWith<Reading>({ state: 'loading' }),
        );
      }),
    ),
    { initialValue: { state: 'loading' } as Reading },
  );

  protected readonly cost = computed(() => {
    const r = this.reading();
    return r.state === 'read' ? r.cost : null;
  });

  protected readonly rows = computed(() => costRows(this.cost()));

  /** Offered only where automatic buying is chosen and no ceiling is set yet. */
  protected readonly offerCeiling = computed(() =>
    this.needsCeiling() ? (this.cost()?.suggestedCeilingEur ?? null) : null,
  );
}
