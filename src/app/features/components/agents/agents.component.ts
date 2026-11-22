import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideKeyRound } from '@ng-icons/lucide';
import { AuthService as ApiAuthService } from '../../../core/api/api/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  AgentActivityPage,
  AgentIdentityActivity,
  identityNamesByAccount,
  namedActor,
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
import { AgentRequestsPanel } from './agent-requests-panel';
import { AgentRevokeDialogComponent } from './agent-revoke-dialog.component';
import { AgentSkill, AgentSkillService } from '../settings/agent-keys/agent-skill.service';
import { ConnectAgentComponent } from '../settings/agent-keys/connect-agent.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  AgentGrantRow,
  AgentRequestRow,
  AgentsSurfaceInput,
  AgentsSurfaceRevision,
  buildAgentsSurface,
  presentedContent,
} from './agents-surface';

@Component({
  selector: 'app-agents',
  imports: [
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlButton,
    FlIcon,
    AgentActivityLogComponent,
    AgentRequestsPanel,
    AgentConcessionsTableComponent,
    AgentRevokeDialogComponent,
    ConnectAgentComponent,
  ],
  providers: [provideIcons({ lucideKeyRound })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Agents">
        <span headerMeta
          >What your agents ask to do, what they may already do, and what they did</span
        >
        <ng-container headerActions>
          <a flButton routerLink="/settings" fragment="agent-keys" data-testid="configure-key-link">
            <fl-icon name="lucideKeyRound" />
            Configure key
          </a>
        </ng-container>
      </fl-page-header>

      <app-connect-agent [skill]="skill()" [skillError]="skillError()" />

      <fl-alert tone="info" title="An agent can never do more than you can." data-testid="ceiling">
        {{ ceiling() }}
      </fl-alert>

      @if (loadError(); as e) {
        <fl-alert tone="error" title="Could not load">{{ e }}</fl-alert>
      }

      <app-agent-requests-panel
        data-testid="group-waiting"
        [waiting]="waiting()"
        [loading]="loading()"
        [answeredStatus]="answered()?.status ?? null"
        [note]="waitingNote()"
        [deciding]="deciding()"
        [decideError]="decideError()"
        [keyNames]="keyNames()"
        (decide)="answer($event)"
      />

      <app-agent-concessions-table
        data-testid="group-granted"
        [concessions]="concessions()"
        [busy]="revoking()"
        [note]="grantedNote()"
        (revoke)="openRevoke($event)"
      />

      @if (activityError(); as e) {
        <section class="fl-stack" data-testid="group-activity">
          <fl-panel title="Activity">
            <span
              panelActions
              class="text-fl-caption text-fl-ink-muted"
              data-testid="activity-count"
            >
              {{ activityNote() }}
            </span>
            <fl-alert tone="error" title="Could not load activity">
              <span data-testid="activity-error-banner">{{ e }}</span>
            </fl-alert>
          </fl-panel>
        </section>
      } @else {
        <app-agent-activity-log
          data-testid="group-activity"
          [entries]="activity().entries"
          [identities]="actingIdentities()"
          [scope]="activity().scope"
          [total]="activity().total"
          [keyNames]="keyNames()"
          [identityNames]="identityNames()"
          [note]="activityNote()"
        />
      }
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
export class AgentsComponent implements OnInit, OnDestroy {
  private readonly cycle = inject(AgentCycleService);
  private readonly keys = inject(ApiAuthService);
  private readonly perms = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly skills = inject(AgentSkillService);
  private readonly currentSurface = inject(CurrentSurfaceService);

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

  private readonly surfaceRevision = new AgentsSurfaceRevision();

  readonly surface = computed(() => {
    const target = this.followed();
    const input: AgentsSurfaceInput = {
      ceiling: this.ceiling(),
      waitingRows: this.waiting().map((proposal): AgentRequestRow => ({
        proposal,
        agentName: this.agentName(proposal.keyId),
      })),
      loadingWaiting: this.loading(),
      followedProposalId: target,
      followedAnsweredStatus: this.answered()?.status ?? null,
      expiredCount: expiredCount(this.proposals()),
      grantRows: standingConcessions(this.concessions()).map((concession): AgentGrantRow => ({
        concession,
        agentName: this.agentName(concession.keyId),
      })),
      activityTotal: this.activity().total,
      activityScope: this.activity().scope,
      activityShownCount: this.activity().entries.length,
      actorRows: this.actingIdentities().map((identity) => ({
        identity,
        name: namedActor(identity, this.keyNames(), this.identityNames()),
      })),
      revokeTarget: this.revokeTarget(),
    };
    return buildAgentsSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

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
        this.skillError.set('The instructions for agents could not be read from this instance.');
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
        this.loadError.set(messageOf(err, 'What your agents are asking for could not be read.'));
      },
    });
  }

  private loadConcessions(): void {
    this.cycle.listConcessions().subscribe({
      next: (list) => this.concessions.set(list),
      error: (err: unknown) => {
        this.concessions.set([]);
        this.loadError.set(
          this.loadError() ?? messageOf(err, 'What your agents may already do could not be read.'),
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
        this.activityError.set(messageOf(err, 'What your agents have done could not be read.')),
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
          messageOf(err, 'What is still running under this permission could not be read.'),
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
        this.revokeError.set(messageOf(err, 'That permission could not be revoked.'));
      },
    });
  }
}

function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
