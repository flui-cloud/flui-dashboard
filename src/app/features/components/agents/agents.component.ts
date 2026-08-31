import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideLoader, lucideTriangleAlert } from '@ng-icons/lucide';
import { AuthService as ApiAuthService } from '../../../core/api/api/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  AgentActivityPage,
  AgentIdentityActivity,
  identityNamesByAccount,
} from '../../model/agent-activity.models';
import {
  AgentConcession,
  AgentProposal,
  ConcessionOperation,
  ProposalDecision,
  ceilingSentence,
  expiredCount,
  standingConcessions,
  waitingOn,
} from '../../model/agent-cycle.models';
import { AgentCycleService } from '../../service/agent-cycle.service';
import { AgentActivityLogComponent } from './agent-activity-log.component';
import { AgentConcessionsTableComponent } from './agent-concessions-table.component';
import { AgentRequestCardComponent } from './agent-request-card.component';
import { AgentRevokeDialogComponent } from './agent-revoke-dialog.component';
import { AgentSkill, AgentSkillService } from '../settings/agent-keys/agent-skill.service';
import { ConnectAgentComponent } from '../settings/agent-keys/connect-agent.component';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    NgIcon,
    RouterLink,
    AgentActivityLogComponent,
    AgentRequestCardComponent,
    AgentConcessionsTableComponent,
    AgentRevokeDialogComponent,
    ConnectAgentComponent,
  ],
  providers: [provideIcons({ lucideKeyRound, lucideLoader, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-8 p-6">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
          <p class="m-0 text-sm text-muted-foreground">
            What your agents are asking to do, what they may already do, and what
            they have done.
          </p>
        </div>
        <a
          routerLink="/settings"
          fragment="agent-keys"
          data-testid="configure-key-link"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ng-icon name="lucideKeyRound" class="h-3.5 w-3.5" />
          Configure key
        </a>
      </header>

      <app-connect-agent [skill]="skill()" [skillError]="skillError()" />

      <div
        role="note"
        class="flex items-start gap-3.5 rounded-lg border border-primary/20 bg-primary/[0.07] px-4 py-3.5"
        data-testid="ceiling"
      >
        <span class="shrink-0 pt-0.5 font-mono text-[11px] font-semibold tracking-widest text-accent-foreground">
          CEILING
        </span>
        <p class="m-0 text-sm text-muted-foreground">
          <span class="font-semibold text-foreground">An agent can never do more than you can.</span>
          {{ ceiling() }}
        </p>
      </div>

      @if (loadError(); as e) {
        <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ e }}</span>
        </div>
      }

      <!-- ── Waiting on you ────────────────────────────────────── -->
      <section class="space-y-3" data-testid="group-waiting">
        <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
          <p class="text-label m-0">Waiting on you</p>
          <p class="m-0 text-[13px] text-muted-foreground" data-testid="waiting-count">
            {{ waitingNote() }}
          </p>
        </div>

        @if (loading()) {
          <div class="space-y-3" data-testid="waiting-loading" aria-busy="true">
            @for (row of [1, 2]; track row) {
              <div class="card-surface space-y-3 p-5">
                <div class="flex items-center gap-2.5">
                  <div class="skeleton h-5 w-64"></div>
                  <div class="skeleton h-4 w-20"></div>
                </div>
                <div class="skeleton h-3 w-48"></div>
                <div class="flex gap-2 pt-1">
                  <div class="skeleton h-8 w-24"></div>
                  <div class="skeleton h-8 w-24"></div>
                  <div class="skeleton h-8 w-16"></div>
                </div>
              </div>
            }
          </div>
        } @else if (answered()) {
          <p class="m-0 text-sm text-muted-foreground" data-testid="already-answered">
            The request you followed here was already answered ({{ answered()?.status }}).
            The agent finds out by retrying the call it was stopped on.
          </p>
        }

        @if (!loading()) {
          @for (proposal of waiting(); track proposal.id) {
            <app-agent-request-card
              [proposal]="proposal"
              [agentName]="agentName(proposal.keyId)"
              [busy]="deciding() === proposal.id"
              (decide)="answer($event)"
            />
          } @empty {
            <p class="m-0 text-sm text-muted-foreground" data-testid="no-requests">
              Nothing is waiting on you. An agent that meets something it may not
              do on its own raises it here and carries on with the rest.
            </p>
          }
        }

        @if (decideError(); as e) {
          <p class="m-0 text-sm text-destructive" data-testid="decide-error">{{ e }}</p>
        }
      </section>

      <!-- ── Granted permanently ───────────────────────────────── -->
      <section class="space-y-3" data-testid="group-granted">
        <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
          <p class="text-label m-0">Granted permanently</p>
          <p class="m-0 text-[13px] text-muted-foreground" data-testid="granted-count">
            {{ grantedNote() }}
          </p>
        </div>

        <app-agent-concessions-table
          [concessions]="concessions()"
          [busy]="revoking()"
          (revoke)="openRevoke($event)"
        />
      </section>

      <!-- ── What it has done ──────────────────────────────────── -->
      <section class="space-y-3" data-testid="group-activity">
        <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
          <p class="text-label m-0">What it has done</p>
          <p class="m-0 text-[13px] text-muted-foreground" data-testid="activity-count">
            {{ activityNote() }}
          </p>
        </div>

        @if (activityError(); as e) {
          <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
            <span data-testid="activity-error-banner">{{ e }}</span>
          </div>
        } @else {
          <app-agent-activity-log
            [entries]="activity().entries"
            [identities]="actingIdentities()"
            [scope]="activity().scope"
            [total]="activity().total"
            [keyNames]="keyNames()"
            [identityNames]="identityNames()"
          />
        }
      </section>
    </div>

    @if (revokeTarget(); as target) {
      <app-agent-revoke-dialog
        [concession]="target"
        [running]="running()"
        [loading]="loadingRunning()"
        [busy]="revoking() === target.id"
        [error]="revokeError()"
        (dismissed)="closeRevoke()"
        (confirm)="confirmRevoke($event.alsoStop)"
      />
    }
  `,
})
export class AgentsComponent implements OnInit {
  private readonly cycle = inject(AgentCycleService);
  private readonly keys = inject(ApiAuthService);
  private readonly perms = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly skills = inject(AgentSkillService);

  protected readonly skill = signal<AgentSkill | null>(null);
  protected readonly skillError = signal<string | null>(null);

  private readonly proposals = signal<AgentProposal[]>([]);
  protected readonly concessions = signal<AgentConcession[]>([]);
  protected readonly keyNames = signal<Record<string, string>>({});

  protected readonly activity = signal<AgentActivityPage>({
    scope: 'own',
    total: 0,
    limit: 0,
    offset: 0,
    entries: [],
  });
  protected readonly actingIdentities = signal<AgentIdentityActivity[]>([]);
  protected readonly activityError = signal<string | null>(null);

  protected readonly identityNames = signal<Record<string, string>>({});

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly deciding = signal<string | null>(null);
  protected readonly decideError = signal<string | null>(null);

  protected readonly revokeTarget = signal<AgentConcession | null>(null);
  protected readonly running = signal<ConcessionOperation[]>([]);
  protected readonly loadingRunning = signal(false);
  protected readonly revoking = signal<string | null>(null);
  protected readonly revokeError = signal<string | null>(null);

  private readonly followed = signal<string | null>(null);

  protected readonly ceiling = computed(() =>
    ceilingSentence(this.perms.isAdmin(), this.perms.permissions().length),
  );

  protected readonly waiting = computed(() => {
    const live = waitingOn(this.proposals());
    const target = this.followed();
    if (!target) return live;
    const found = live.find((p) => p.id === target);
    return found ? [found, ...live.filter((p) => p !== found)] : live;
  });

  protected readonly answered = computed(() => {
    const target = this.followed();
    if (!target) return null;
    if (this.waiting().some((p) => p.id === target)) return null;
    return this.proposals().find((p) => p.id === target) ?? null;
  });

  protected readonly waitingNote = computed(() => {
    const count = this.waiting().length;
    const stale = expiredCount(this.proposals());
    const head = count === 1 ? '1 request' : `${count} requests`;
    if (!stale) return head;
    return `${head} · ${stale} expired unanswered`;
  });

  protected readonly activityNote = computed(() => {
    const page = this.activity();
    if (this.activityError()) return 'could not be read';
    if (!page.total) return 'nothing yet';
    const calls = page.total === 1 ? '1 call' : `${page.total} calls`;
    return page.scope === 'instance' ? `${calls} · whole instance` : calls;
  });

  protected readonly grantedNote = computed(() => {
    const count = standingConcessions(this.concessions()).length;
    if (!count) return 'none';
    const grants = count === 1 ? '1 grant' : `${count} grants`;
    return `${grants} · all revocable`;
  });

  ngOnInit(): void {
    this.perms.load();
    this.followed.set(this.route.snapshot.paramMap.get('proposalId'));
    this.loadProposals();
    this.loadConcessions();
    this.loadKeyNames();
    this.loadActivity();
    this.loadAgentIdentities();
    this.loadSkill();
  }

  private loadSkill(): void {
    this.skills.skill().subscribe({
      next: (doc) => {
        this.skill.set(doc);
        this.skillError.set(null);
      },
      error: () => {
        this.skill.set(null);
        this.skillError.set(
          'The instructions for agents could not be read from this instance.',
        );
      },
    });
  }

  protected agentName(keyId: string | null | undefined): string | null {
    if (!keyId) return null;
    return this.keyNames()[keyId] ?? null;
  }

  private loadProposals(): void {
    this.loading.set(true);
    this.cycle.listProposals().subscribe({
      next: (list) => {
        this.proposals.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.proposals.set([]);
        this.loading.set(false);
        this.loadError.set(
          messageOf(err, 'What your agents are asking for could not be read.'),
        );
      },
    });
  }

  private loadConcessions(): void {
    this.cycle.listConcessions().subscribe({
      next: (list) => this.concessions.set(list),
      error: (err: unknown) => {
        this.concessions.set([]);
        this.loadError.set(
          this.loadError() ??
            messageOf(err, 'What your agents may already do could not be read.'),
        );
      },
    });
  }

  private loadKeyNames(): void {
    this.keys.apiKeysControllerListApiKeys().subscribe({
      next: (list) => {
        const names: Record<string, string> = {};
        for (const key of list ?? []) names[key.id] = key.name;
        this.keyNames.set(names);
      },
      error: () => this.keyNames.set({}),
    });
  }

  private loadActivity(): void {
    this.cycle.activity().subscribe({
      next: (page) => {
        this.activity.set(page);
        this.activityError.set(null);
      },
      error: (err: unknown) =>
        this.activityError.set(
          messageOf(err, 'What your agents have done could not be read.'),
        ),
    });
    this.cycle.activityIdentities().subscribe({
      next: (page) => this.actingIdentities.set(page.identities),
      error: () => this.actingIdentities.set([]),
    });
  }

  private loadAgentIdentities(): void {
    this.cycle.agentIdentities().subscribe({
      next: (list) => this.identityNames.set(identityNamesByAccount(list ?? [])),
      error: () => this.identityNames.set({}),
    });
  }

  protected answer(event: { id: string; decision: ProposalDecision }): void {
    this.deciding.set(event.id);
    this.decideError.set(null);
    this.cycle.decide(event.id, event.decision).subscribe({
      next: () => {
        this.deciding.set(null);
        this.loadProposals();
        this.loadConcessions();
      },
      error: (err: unknown) => {
        this.deciding.set(null);
        this.decideError.set(messageOf(err, 'That answer did not go through.'));
      },
    });
  }

  protected openRevoke(concession: AgentConcession): void {
    this.revokeTarget.set(concession);
    this.running.set([]);
    this.revokeError.set(null);
    this.loadingRunning.set(true);
    this.cycle.runningUnder(concession.id).subscribe({
      next: (ops) => {
        this.running.set(ops);
        this.loadingRunning.set(false);
      },
      error: (err: unknown) => {
        this.running.set([]);
        this.loadingRunning.set(false);
        this.revokeError.set(
          messageOf(
            err,
            'What is still running under this permission could not be read.',
          ),
        );
      },
    });
  }

  protected closeRevoke(): void {
    this.revokeTarget.set(null);
    this.running.set([]);
    this.revokeError.set(null);
  }

  protected confirmRevoke(alsoStop: boolean): void {
    const target = this.revokeTarget();
    if (!target) return;
    this.revoking.set(target.id);
    this.revokeError.set(null);
    this.cycle.revoke(target.id, alsoStop).subscribe({
      next: () => {
        this.revoking.set(null);
        this.closeRevoke();
        this.loadConcessions();
      },
      error: (err: unknown) => {
        this.revoking.set(null);
        this.revokeError.set(
          messageOf(err, 'That permission could not be revoked.'),
        );
      },
    });
  }
}

function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error
    ?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
