import { Component, input, output } from '@angular/core';
import { ScalingDecision } from '../../model/scaling-group.models';
import { operationDetail, operationLabel } from '../scaling/decision-operation';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { operationStatusTone } from './scaling-tabs-format';

export interface LogRow {
  decision: ScalingDecision;
  when: string;
  outcome: string;
  tone: StatusTone;
}

export interface LogFilter {
  key: string;
  label: string;
}

@Component({
  selector: 'app-history-decision-log',
  imports: [
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlStatus,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="Decision log"
      [count]="loading() || failed() ? null : rows().length"
      [flush]="true"
      data-testid="decision-log"
    >
      @if (loading()) {
        <app-section-skeleton
          variant="table"
          [count]="3"
          label="the decision log"
          testid="decisions"
        />
      } @else if (failed(); as message) {
        <div class="p-4">
          <app-section-failure [message]="message" testid="decisions" (retry)="retry.emit()" />
        </div>
      } @else {
        <div class="fl-toolbar">
          <div class="fl-segmented" role="group" aria-label="Show" data-testid="decision-filter">
            @for (f of filters(); track f.key) {
              <button
                type="button"
                [attr.aria-pressed]="filter() === f.key"
                (click)="filterChange.emit(f.key)"
                [attr.data-testid]="'decision-filter-' + f.key"
              >
                {{ f.label }}
              </button>
            }
          </div>
          <span class="fl-toolbar__info">
            Newest first. The top row is where the group stands now.
          </span>
        </div>

        @if (rows().length) {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Force and outcome</th>
                  <th scope="col">Saw</th>
                  <th scope="col">Did and why</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.decision.id) {
                  <tr
                    [attr.data-testid]="'decision-row-' + row.decision.id"
                    [attr.data-outcome]="row.decision.outcome"
                  >
                    <th scope="row" class="fl-mono fl-num font-normal text-fl-ink-muted">
                      {{ row.when }}
                    </th>
                    <td>
                      <fl-status [tone]="row.tone" [label]="row.outcome" />
                    </td>
                    <td class="is-wrap text-fl-ink-secondary">{{ row.decision.saw }}</td>
                    <td class="is-wrap">
                      <span class="flex flex-col gap-0.5">
                        <span>{{ row.decision.did }}</span>
                        <span class="text-fl-caption text-fl-ink-muted">{{
                          row.decision.why
                        }}</span>
                        @if (row.decision.force !== 'fleet' && row.decision.operation; as op) {
                          <span
                            class="flex flex-wrap items-center gap-2"
                            [attr.data-testid]="'decision-operation-' + row.decision.id"
                          >
                            <fl-status [tone]="opTone(op.state)" [label]="opLabel(op)" />
                            @if (opDetail(op); as detail) {
                              <span class="text-fl-caption text-fl-ink-muted">{{ detail }}</span>
                            }
                          </span>
                        }
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <fl-empty-state
            [compact]="true"
            title="Nothing decided yet"
            body="It has never had to act."
            data-testid="log-empty"
          />
        }

        @if (more()) {
          <div class="border-t border-fl-border px-4 py-3">
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="paging()"
              (click)="older.emit()"
              data-testid="decisions-older"
            >
              {{ paging() ? 'Loading…' : 'Load older' }}
            </button>
          </div>
        }
      }
    </fl-panel>
  `,
})
export class HistoryDecisionLog {
  readonly rows = input.required<readonly LogRow[]>();
  readonly filters = input.required<readonly LogFilter[]>();
  readonly filter = input.required<string>();
  readonly loading = input(false);
  readonly failed = input<string | null>(null);
  readonly more = input(false);
  readonly paging = input(false);
  readonly filterChange = output<string>();
  readonly retry = output<void>();
  readonly older = output<void>();

  protected readonly opTone = operationStatusTone;
  protected readonly opLabel = operationLabel;
  protected readonly opDetail = operationDetail;
}
