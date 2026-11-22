import { Component, input } from '@angular/core';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { AuditEvent, AuditOutcome, auditTargetText } from '../../model/audit.model';
import { formatWhen } from '../../model/iam.model';

const OUTCOME_TONE: Record<AuditOutcome, StatusTone> = {
  ok: 'success',
  refused: 'error',
  failed: 'warning',
};

@Component({
  selector: 'app-audit-event-list',
  imports: [FlEmptyState, FlTable, FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    @if (events().length) {
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Time</th>
              @if (showWho()) {
                <th scope="col">Who</th>
              }
              <th scope="col">Action</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            @for (e of events(); track e.id) {
              <tr data-testid="audit-row">
                <td class="text-fl-ink-secondary">{{ when(e.at) }}</td>
                @if (showWho()) {
                  <td>
                    <div class="flex items-center gap-1.5">
                      <span>{{ e.email ?? 'platform' }}</span>
                      @if (e.actorKind === 'key' || e.actorKind === 'agent') {
                        <fl-tag>{{ e.actorKind }}</fl-tag>
                      }
                    </div>
                  </td>
                }
                <td class="whitespace-normal">
                  <div class="flex flex-col gap-0.5">
                    <span class="fl-mono">{{ e.action }}</span>
                    @if (target(e)) {
                      <span class="fl-mono break-all text-fl-ink-muted">{{ target(e) }}</span>
                    }
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-1.5">
                    <fl-status [tone]="outcomeTone(e.outcome)" [label]="e.outcome" />
                    @if (e.dataAccess) {
                      <fl-tag title="Reached application data">data</fl-tag>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <fl-empty-state [compact]="true" [title]="emptyText()" />
    }
  `,
})
export class AuditEventListComponent {
  readonly events = input.required<AuditEvent[]>();
  readonly showWho = input(true);
  readonly emptyText = input('Nothing recorded.');

  when(at: string): string {
    return formatWhen(at);
  }

  target(e: AuditEvent): string {
    return auditTargetText(e.target);
  }

  outcomeTone(o: AuditOutcome): StatusTone {
    return OUTCOME_TONE[o];
  }
}
