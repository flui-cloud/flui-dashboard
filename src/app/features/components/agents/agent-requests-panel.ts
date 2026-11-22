import { Component, input, output } from '@angular/core';
import { AgentProposal, ProposalDecision } from '../../model/agent-cycle.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { AgentRequestCardComponent } from './agent-request-card.component';

@Component({
  selector: 'app-agent-requests-panel',
  imports: [FlPanel, FlAlert, FlEmptyState, FlLoadingState, AgentRequestCardComponent],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Waiting on you" [flush]="true">
      <span panelActions class="text-fl-caption text-fl-ink-muted" data-testid="waiting-count">
        {{ note() }}
      </span>

      @if (decideError(); as e) {
        <div class="border-b border-fl-border-subtle p-4">
          <fl-alert tone="error" title="Answer not sent" data-testid="decide-error">{{
            e
          }}</fl-alert>
        </div>
      }

      @if (loading()) {
        <fl-loading-state [rows]="2" data-testid="waiting-loading" />
      } @else {
        @if (answeredStatus(); as status) {
          <p
            class="m-0 border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted"
            data-testid="already-answered"
          >
            The request you followed here was already answered ({{ status }}). The agent finds out
            by retrying the call it was stopped on.
          </p>
        }
        @for (proposal of waiting(); track proposal.id) {
          <app-agent-request-card
            class="border-b border-fl-border-subtle last:border-b-0"
            [proposal]="proposal"
            [agentName]="nameOf(proposal.keyId)"
            [busy]="deciding() === proposal.id"
            (decide)="decide.emit($event)"
          />
        } @empty {
          <fl-empty-state
            [compact]="true"
            title="Nothing is waiting on you"
            body="An agent that meets something it may not do on its own raises it here and carries on with the rest."
            data-testid="no-requests"
          />
        }
      }
    </fl-panel>
  `,
})
export class AgentRequestsPanel {
  readonly waiting = input<AgentProposal[]>([]);
  readonly loading = input(false);
  readonly answeredStatus = input<string | null>(null);
  readonly note = input('');
  readonly deciding = input<string | null>(null);
  readonly decideError = input<string | null>(null);
  readonly keyNames = input<Record<string, string>>({});

  readonly decide = output<{ id: string; decision: ProposalDecision }>();

  protected nameOf(keyId: string | null | undefined): string | null {
    if (!keyId) return null;
    return this.keyNames()[keyId] ?? null;
  }
}
