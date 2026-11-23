import { Component, computed, input } from '@angular/core';
import { ScalingDecision } from '../../model/scaling-group.models';
import { FlKeyValue, FlKvItem, FlTable } from '../../../ui/patterns';
import { FlStatus } from '../../../ui/primitives';
import { outcomeText, whenLabel } from './fleet-history.geometry';
import { operationDetail, operationLabel } from './decision-operation';
import { operationStatusTone, outcomeStatusTone } from './fleet-history-marks';

@Component({
  selector: 'app-fleet-history-detail',
  imports: [FlKeyValue, FlKvItem, FlTable, FlStatus],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4" data-testid="decision-detail" aria-live="polite">
      <fl-key-value class="fl-kv--compact">
        <fl-kv-item key="Outcome">
          <fl-status [tone]="tone()" [label]="outcome()" data-testid="detail-outcome" />
        </fl-kv-item>
        <fl-kv-item key="Force" [mono]="true">
          <span data-testid="detail-force">{{ decision().force }}</span>
        </fl-kv-item>
        @if (decision().shape) {
          <fl-kv-item key="Shape" [mono]="true">
            {{ decision().shape }}
            @if (decision().region) {
              · {{ decision().region }}
            }
          </fl-kv-item>
        }
        <fl-kv-item key="When">
          <span class="fl-num" data-testid="detail-at">{{ when() }}</span>
        </fl-kv-item>
      </fl-key-value>

      <div class="fl-table-wrap">
        <table flTable density="dense">
          <tbody>
            <tr>
              <th scope="row" class="is-fit">Saw</th>
              <td class="whitespace-normal" data-testid="detail-saw">{{ decision().saw }}</td>
            </tr>
            <tr>
              <th scope="row" class="is-fit">Did</th>
              <td class="whitespace-normal" data-testid="detail-did">{{ decision().did }}</td>
            </tr>
            <tr>
              <th scope="row" class="is-fit">Why</th>
              <td class="whitespace-normal text-fl-ink-secondary" data-testid="detail-why">
                {{ decision().why }}
              </td>
            </tr>
            @if (decision().operation; as op) {
              <tr>
                <th scope="row" class="is-fit">Then</th>
                <td class="whitespace-normal" data-testid="detail-operation">
                  <span class="fl-row">
                    <fl-status [tone]="opTone(op.state)" [label]="label(op)" />
                    @if (detail(op); as text) {
                      <span class="text-fl-ink-muted">{{ text }}</span>
                    }
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class FleetHistoryDetailComponent {
  readonly decision = input.required<ScalingDecision>();

  protected readonly tone = computed(() => outcomeStatusTone(this.decision().outcome));
  protected readonly outcome = computed(() => {
    const text = outcomeText(this.decision().outcome);
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  protected readonly when = computed(() => whenLabel(this.decision().at));

  protected readonly label = operationLabel;
  protected readonly detail = operationDetail;
  protected readonly opTone = operationStatusTone;
}
