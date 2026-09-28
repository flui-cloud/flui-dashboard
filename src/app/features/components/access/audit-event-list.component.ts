import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import {
  AuditEvent,
  AuditOutcome,
  auditTargetText,
} from '../../model/audit.model';
import { formatWhen } from '../../model/iam.model';

const OUTCOME_CLASS: Record<AuditOutcome, string> = {
  ok: 'border-border text-muted-foreground',
  refused: 'border-destructive/40 bg-destructive/10 text-destructive',
  failed: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

@Component({
  selector: 'app-audit-event-list',
  standalone: true,
  imports: [HlmBadgeDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted-foreground border-b border-border">
            <th class="py-2 pr-4 font-medium">Time</th>
            @if (showWho()) {
              <th class="py-2 pr-4 font-medium">Who</th>
            }
            <th class="py-2 pr-4 font-medium">Action</th>
            <th class="py-2 pr-4 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          @for (e of events(); track e.id) {
            <tr class="border-b border-border/60 last:border-0 align-top" data-testid="audit-row">
              <td class="py-2 pr-4 whitespace-nowrap text-muted-foreground">{{ when(e.at) }}</td>
              @if (showWho()) {
                <td class="py-2 pr-4">
                  <span class="text-foreground">{{ e.email ?? 'platform' }}</span>
                  @if (e.actorKind === 'key' || e.actorKind === 'agent') {
                    <span hlmBadge variant="outline" class="ml-1.5 text-[10px]">{{ e.actorKind }}</span>
                  }
                </td>
              }
              <td class="py-2 pr-4">
                <span class="font-mono text-xs text-foreground">{{ e.action }}</span>
                @if (target(e)) {
                  <div class="font-mono text-[11px] text-muted-foreground break-all">{{ target(e) }}</div>
                }
              </td>
              <td class="py-2 pr-4 whitespace-nowrap">
                <span hlmBadge variant="outline" [class]="'text-[10px] ' + outcomeClass(e.outcome)">{{ e.outcome }}</span>
                @if (e.dataAccess) {
                  <span hlmBadge variant="secondary" class="ml-1.5 text-[10px]" title="Reached application data">data</span>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="showWho() ? 4 : 3" class="py-4 text-center text-xs text-muted-foreground">{{ emptyText() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
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

  outcomeClass(o: AuditOutcome): string {
    return OUTCOME_CLASS[o];
  }
}
