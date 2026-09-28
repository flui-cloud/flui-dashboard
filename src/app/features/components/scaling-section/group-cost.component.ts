import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-surface space-y-2 p-4" data-testid="group-cost">
      <h3 class="m-0 text-[13px] font-semibold text-foreground">
        What these limits can cost
      </h3>
      @switch (reading().state) {
        @case ('loading') {
          <p class="m-0 text-[12px] text-muted-foreground">Pricing…</p>
        }
        @case ('invalid') {
          <p class="m-0 text-[12px] text-muted-foreground">
            Fix the node limits above to see what they cost.
          </p>
        }
        @case ('failed') {
          <p class="m-0 text-[12px] text-muted-foreground" data-testid="group-cost-failed">
            The cost could not be read just now.
          </p>
        }
        @case ('read') {
          @if (cost(); as c) {
            <p class="m-0 text-[12px] text-muted-foreground" data-testid="group-cost-says">
              {{ c.says }}
            </p>
            @if (rows().length) {
              <table class="w-full text-[13px]">
                <tbody>
                  @for (row of rows(); track row.kind) {
                    <tr [attr.data-testid]="'cost-' + row.kind">
                      <td class="py-0.5 pr-4 text-foreground">{{ row.label }}</td>
                      <td class="py-0.5 text-right tabular-nums font-medium text-foreground">
                        {{ row.value }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (c.ceiling.says) {
              <p
                class="m-0 text-[12px]"
                [class]="c.ceiling.stopsBeforeMax ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'"
                data-testid="group-cost-ceiling"
              >
                {{ c.ceiling.says }}
              </p>
            }
            @if (offerCeiling(); as suggested) {
              <button
                type="button"
                class="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-muted"
                data-testid="group-cost-use-suggested"
                (click)="useCeiling.emit(suggested)"
              >
                Set the spending ceiling to {{ money(suggested) }} (covers the worst case)
              </button>
            }
          }
        }
      }
    </div>
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

  private readonly ask = computed<{ clusterId: string; body: Partial<ScalingCostDraft> } | null>(() => {
    const body = this.draft();
    return body ? { clusterId: this.clusterId(), body } : null;
  });

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
