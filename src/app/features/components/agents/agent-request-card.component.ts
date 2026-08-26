import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideLoader } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
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

@Component({
  selector: 'app-agent-request-card',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucideChevronDown, lucideLoader })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="grid grid-cols-[3px_1fr] overflow-hidden rounded-lg border border-border bg-card"
      data-testid="request"
    >
      <div class="bg-orange-400 dark:bg-orange-500"></div>

      <div class="flex flex-col gap-4 px-5 py-4">
        <div class="flex flex-wrap items-center gap-2.5">
          <h3
            class="m-0 text-[17px] font-semibold tracking-tight text-foreground"
            data-testid="request-sentence"
          >
            {{ headline() }}
          </h3>
          <span class="badge badge-pending" data-testid="request-asked">
            Asked {{ asked() }}
          </span>
        </div>

        <p class="m-0 font-mono text-[13px] text-muted-foreground" data-testid="request-who">
          <span class="font-medium text-foreground">{{ agentLabel() }}</span>
          @if (proposal().keyId) {
            · key {{ proposal().keyId }}
          }
        </p>

        <dl
          class="grid gap-px overflow-hidden rounded-md border border-border bg-border"
          style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))"
          data-testid="request-facts"
        >
          <div class="flex flex-col gap-0.5 bg-card px-3 py-2.5">
            <dt class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Action</dt>
            <dd class="m-0 font-mono text-sm font-medium text-foreground">{{ verb() }}</dd>
          </div>
          <div class="flex flex-col gap-0.5 bg-card px-3 py-2.5">
            <dt class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Route</dt>
            <dd class="m-0 break-all font-mono text-sm font-medium text-foreground">{{ pattern() }}</dd>
          </div>
          @for (bound of bindings(); track bound.label) {
            <div class="flex flex-col gap-0.5 bg-card px-3 py-2.5">
              <dt class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{{ bound.label }}</dt>
              <dd class="m-0 break-all font-mono text-sm font-medium text-foreground">{{ bound.value }}</dd>
            </div>
          }
          @for (fact of facts(); track fact.label) {
            <div class="flex flex-col gap-0.5 bg-card px-3 py-2.5" data-testid="estimate-fact">
              <dt class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{{ fact.label }}</dt>
              <dd
                class="m-0 break-all font-mono text-sm font-medium tabular-nums"
                [class]="fact.money ? 'text-orange-700 dark:text-orange-400 font-semibold' : 'text-foreground'"
              >
                {{ fact.value }}
              </dd>
            </div>
          }
        </dl>

        @if (pricing()) {
          <p class="m-0 flex items-center gap-2 text-xs text-muted-foreground" data-testid="estimate-loading">
            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            Pricing this request…
          </p>
        } @else if (priceError()) {
          <p class="m-0 text-xs text-muted-foreground" data-testid="estimate-error">
            {{ priceError() }}
          </p>
        }

        @if (offersAlways()) {
          <p
            class="m-0 rounded-md border border-dashed border-orange-400 bg-orange-50 px-3 py-2.5 text-[13px] text-foreground dark:border-orange-500/60 dark:bg-orange-500/10"
            data-testid="grants-line"
          >
            Allow always grants exactly this:
            <code class="font-mono text-[12.5px] font-medium">{{ proposal().sentence }}</code
            >. No other action, no other resource.
          </p>
        } @else {
          <p class="m-0 text-[13px] text-muted-foreground" data-testid="no-always-note">
            This request did not state its own boundary, so there is no standing
            permission it could be turned into. It can be allowed this once.
          </p>
        }

        <div class="flex flex-wrap items-center gap-2">
          <button
            hlmBtn
            type="button"
            size="sm"
            [disabled]="busy()"
            (click)="answer(DECISION.ONCE)"
            data-testid="allow-once"
          >
            Allow once
          </button>

          @if (offersAlways()) {
            <button
              hlmBtn
              type="button"
              size="sm"
              variant="outline"
              [disabled]="busy()"
              (click)="answer(DECISION.ALWAYS)"
              class="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
              data-testid="allow-always"
            >
              Allow always
            </button>
          }

          <button
            hlmBtn
            type="button"
            size="sm"
            variant="outline"
            [disabled]="busy()"
            (click)="answer(DECISION.DENY)"
            class="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
            data-testid="deny"
          >
            Deny
          </button>

          @if (estimateBody() !== null) {
            <button
              hlmBtn
              type="button"
              size="sm"
              variant="ghost"
              (click)="showEstimate.set(!showEstimate())"
              data-testid="full-estimate"
            >
              <ng-icon
                name="lucideChevronDown"
                class="mr-1 h-3.5 w-3.5 transition-transform"
                [class.rotate-180]="showEstimate()"
              />
              See full estimate
            </button>
          }
        </div>

        @if (showEstimate() && estimateBody() !== null) {
          <pre
            class="m-0 max-h-72 overflow-auto rounded-md bg-muted/60 px-3 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground"
            data-testid="estimate-body"
            >{{ estimateJson() }}</pre
          >
        }
      </div>
    </article>
  `,
})
export class AgentRequestCardComponent implements OnInit {
  private readonly cycle = inject(AgentCycleService);

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

  protected readonly agentLabel = computed(
    () => this.agentName() ?? 'A credential of yours',
  );

  protected readonly asked = computed(() =>
    formatTimeSince(this.proposal().createdAt).toLowerCase(),
  );

  protected readonly verb = computed(() => splitAction(this.proposal().action).verb);
  protected readonly pattern = computed(
    () => splitAction(this.proposal().action).pattern,
  );

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

  protected readonly facts = computed<EstimateFact[]>(() =>
    estimateFacts(this.estimateBody()),
  );

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

  protected answer(decision: ProposalDecision): void {
    this.decide.emit({ id: this.proposal().id, decision });
  }
}
