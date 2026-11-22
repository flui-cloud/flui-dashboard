import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import {
  AgentProposal,
  EstimateFact,
  PROPOSAL_DECISION,
  ProposalDecision,
  estimateFacts,
  offersAlways,
  splitAction,
} from '../../model/agent-cycle.models';
import { formatTimeSince } from '../../model/dns.models';
import { AgentCycleService } from '../../service/agent-cycle.service';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ConfirmOptions, ConfirmService } from '../../../ui/overlays/confirm';
import { riskOf } from './agent-request-risk';

@Component({
  selector: 'app-agent-request-card',
  imports: [FlKeyValue, FlKvItem, FlLoadingState, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'block' },
  template: `
    <article class="flex flex-col gap-3 px-4 py-3" data-testid="request">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="fl-row">
            <h3
              class="m-0 text-fl-body-sm font-semibold text-fl-ink"
              data-testid="request-sentence"
            >
              {{ headline() }}
            </h3>
            <span class="text-fl-caption text-fl-ink-muted" data-testid="request-asked">
              Asked {{ asked() }}
            </span>
          </div>
          @if (proposal().consequence) {
            <p class="m-0 text-fl-body-sm text-fl-ink-secondary" data-testid="request-consequence">
              <span class="font-medium text-fl-ink">If you allow it:</span>
              {{ proposal().consequence }}
            </p>
          }
          <p class="fl-mono m-0 text-fl-ink-muted" data-testid="request-who">
            <span class="text-fl-ink">{{ agentLabel() }}</span>
            @if (proposal().keyId) {
              · key {{ proposal().keyId }}
            }
          </p>
        </div>

        <div class="fl-row">
          <button
            flButton="primary"
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="answer(DECISION.ONCE)"
            data-testid="allow-once"
          >
            Allow once
          </button>
          @if (offersAlways()) {
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="answer(DECISION.ALWAYS)"
              data-testid="allow-always"
            >
              Allow always
            </button>
          }
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="answer(DECISION.DENY)"
            data-testid="deny"
          >
            Deny
          </button>
        </div>
      </div>

      <fl-key-value class="fl-kv--compact" data-testid="request-facts">
        <fl-kv-item key="Action" [mono]="true">{{ verb() }}</fl-kv-item>
        <fl-kv-item key="Route" [mono]="true">{{ pattern() }}</fl-kv-item>
        @for (bound of bindings(); track bound.label) {
          <fl-kv-item [key]="bound.label" [mono]="true">{{ bound.value }}</fl-kv-item>
        }
        @for (fact of facts(); track fact.label) {
          <fl-kv-item [key]="fact.label" [mono]="true" data-testid="estimate-fact">
            <span class="fl-num" [class.font-semibold]="fact.money">{{ fact.value }}</span>
          </fl-kv-item>
        }
      </fl-key-value>

      @if (pricing()) {
        <fl-loading-state [rows]="2" data-testid="estimate-loading" />
      } @else if (priceError()) {
        <p class="m-0 text-fl-caption text-fl-ink-muted" data-testid="estimate-error">
          {{ priceError() }}
        </p>
      }

      @if (offersAlways()) {
        <p class="m-0 text-fl-caption text-fl-ink-secondary" data-testid="grants-line">
          Allow always grants exactly this:
          <code class="fl-mono text-fl-ink">{{ proposal().sentence }}</code>. No other action, no
          other resource.
        </p>
      } @else if (proposal().asksEveryTime) {
        <p class="m-0 text-fl-caption text-fl-ink-muted" data-testid="every-time-note">
          Removing something, or widening what a key may do, is allowed one call at a time: there is
          no "always" for it.
        </p>
      } @else {
        <p class="m-0 text-fl-caption text-fl-ink-muted" data-testid="no-always-note">
          This request did not state its own boundary, so there is no standing permission it could
          be turned into. It can be allowed this once.
        </p>
      }

      @if (estimateBody() !== null) {
        <div>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="showEstimate()"
            (click)="showEstimate.set(!showEstimate())"
            data-testid="full-estimate"
          >
            <fl-icon [name]="showEstimate() ? 'lucideChevronUp' : 'lucideChevronDown'" />
            See full estimate
          </button>
        </div>
      }

      @if (showEstimate() && estimateBody() !== null) {
        <pre
          class="fl-mono m-0 max-h-72 overflow-auto whitespace-pre-wrap rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink-secondary"
          data-testid="estimate-body"
          >{{ estimateJson() }}</pre>
      }
    </article>
  `,
})
export class AgentRequestCardComponent implements OnInit {
  private readonly cycle = inject(AgentCycleService);
  private readonly confirmer = inject(ConfirmService);

  readonly proposal = input.required<AgentProposal>();
  readonly agentName = input<string | null>(null);
  readonly busy = input(false);

  readonly decide = output<{ id: string; decision: ProposalDecision }>();

  protected readonly DECISION = PROPOSAL_DECISION;

  protected readonly showEstimate = signal(false);
  protected readonly pricing = signal(false);
  protected readonly priceError = signal<string | null>(null);
  private readonly fetched = signal<unknown>(null);
  private priced: string | null = null;

  protected readonly offersAlways = computed(() => offersAlways(this.proposal()));

  protected readonly agentLabel = computed(() => this.agentName() ?? 'A credential of yours');

  protected readonly asked = computed(() =>
    formatTimeSince(this.proposal().createdAt).toLowerCase(),
  );

  protected readonly verb = computed(() => splitAction(this.proposal().action).verb);
  protected readonly pattern = computed(() => splitAction(this.proposal().action).pattern);

  protected readonly bindings = computed(() =>
    Object.entries(this.proposal().binding ?? {}).map(([label, value]) => ({
      label,
      value,
    })),
  );

  protected readonly estimateBody = computed<unknown>(() => {
    const own = this.proposal().estimate;
    if (own && Object.keys(own).length) return own;
    return this.fetched();
  });

  protected readonly facts = computed<EstimateFact[]>(() => estimateFacts(this.estimateBody()));

  protected readonly estimateJson = computed(() => {
    const body = this.estimateBody();
    return body === null ? '' : JSON.stringify(body, null, 2);
  });

  protected readonly headline = computed(() => {
    const sentence = this.proposal().sentence.trim();
    if (!sentence) return 'A request with no sentence';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  });

  ngOnInit(): void {
    this.price();
  }

  private price(): void {
    const proposal = this.proposal();
    const ref = proposal.estimateRef;
    if (!ref || this.priced === ref) return;
    if (proposal.estimate && Object.keys(proposal.estimate).length) return;
    this.priced = ref;
    this.pricing.set(true);
    this.cycle.estimate(ref).subscribe({
      next: (body) => {
        this.fetched.set(body ?? null);
        this.pricing.set(false);
      },
      error: () => {
        this.pricing.set(false);
        this.priceError.set(
          `This request names ${ref} as its price, and that route did not answer. Decide on what the request says, not on a figure that is missing.`,
        );
      },
    });
  }

  protected async answer(decision: ProposalDecision): Promise<void> {
    const proposal = this.proposal();
    const risk: ConfirmOptions | null = riskOf(proposal, decision, this.facts());
    if (risk && !(await this.confirmer.confirm(risk))) return;
    this.decide.emit({ id: proposal.id, decision });
  }
}
