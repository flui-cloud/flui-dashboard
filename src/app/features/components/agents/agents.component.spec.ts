import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService as ApiAuthService } from '../../../core/api/api/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AgentSkillService } from '../settings/agent-keys/agent-skill.service';
import {
  ActivityScope,
  AgentActivityEntry,
  AgentIdentity,
  AgentIdentityActivity,
} from '../../model/agent-activity.models';
import {
  AgentConcession,
  AgentProposal,
  PROPOSAL_STATUS,
} from '../../model/agent-cycle.models';
import { AgentCycleService } from '../../service/agent-cycle.service';
import { AgentsComponent } from './agents.component';

const live = (over: Partial<AgentProposal> = {}): AgentProposal => ({
  id: 'p-live',
  keyId: 'k-1',
  action: 'POST /infrastructure/clusters/:id/workers',
  binding: { id: 'c-1' },
  argsDigest: 'd',
  sentence: 'add nodes to cluster c-1',
  offersAlways: true,
  estimateRef: null,
  status: PROPOSAL_STATUS.PENDING,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  ...over,
});

const CONCESSION: AgentConcession = {
  id: 'g-1',
  keyId: 'k-1',
  action: 'POST /applications/:id/deploy',
  binding: { id: 'a-1' },
  sentence: 'deploy application a-1',
  createdAt: '2026-08-20T09:00:00.000Z',
  lastUsedAt: null,
};

const ACTED: AgentActivityEntry = {
  id: 'act-1',
  at: new Date(Date.now() - 3_600_000).toISOString(),
  userId: 'u-owner',
  tool: 'cluster_add_worker',
  scope: 'mcp:cluster:write',
  allowed: true,
  outcome: null,
  error: null,
  actorKind: 'agent',
  actorKeyId: 'k-1',
  actorKeyName: "Dawit's MacBook",
  actorKeyRevoked: false,
  args: { nodeType: 'worker', name: '****' },
  operationId: 'op-1',
  operation: {
    id: 'op-1',
    operationType: 'ADD_WORKER',
    status: 'COMPLETED',
    progress: 100,
    resourceType: 'cluster',
    resourceName: 'control-cluster',
    resourceId: 'c-1',
    currentStep: null,
    startedAt: null,
    completedAt: null,
    cancelRequestedAt: null,
    grantId: 'g-1',
  },
  under: 'concession',
  underSentence: 'add nodes to cluster c-1',
};

describe('the agents section', () => {
  let fixture: ComponentFixture<AgentsComponent>;
  let cycle: jasmine.SpyObj<AgentCycleService>;
  let keys: jasmine.SpyObj<ApiAuthService>;

  const build = async (opts: {
    proposals?: AgentProposal[];
    concessions?: AgentConcession[];
    isAdmin?: boolean;
    permissions?: string[];
    proposalId?: string | null;
    proposalsFail?: boolean;
    activity?: AgentActivityEntry[];
    activityScope?: ActivityScope;
    activityTotal?: number;
    activityFails?: boolean;
    actors?: AgentIdentityActivity[];
    identities?: AgentIdentity[];
    identitiesFail?: boolean;
  } = {}): Promise<void> => {
    cycle = jasmine.createSpyObj<AgentCycleService>('AgentCycleService', [
      'listProposals',
      'listConcessions',
      'runningUnder',
      'revoke',
      'decide',
      'estimate',
      'activity',
      'activityIdentities',
      'agentIdentities',
    ]);
    cycle.activity.and.returnValue(
      opts.activityFails
        ? throwError(() => ({ error: { message: 'no register for you' } }))
        : of({
            scope: opts.activityScope ?? 'own',
            total: opts.activityTotal ?? (opts.activity?.length ?? 0),
            limit: 50,
            offset: 0,
            entries: opts.activity ?? [],
          }),
    );
    cycle.activityIdentities.and.returnValue(
      of({ scope: 'own', identities: opts.actors ?? [] }),
    );
    cycle.agentIdentities.and.returnValue(
      opts.identitiesFail
        ? throwError(() => ({ status: 403 }))
        : of(opts.identities ?? []),
    );
    cycle.listProposals.and.returnValue(
      opts.proposalsFail
        ? throwError(() => ({ error: { message: 'no proposals for you' } }))
        : of(opts.proposals ?? []),
    );
    cycle.listConcessions.and.returnValue(of(opts.concessions ?? []));
    cycle.runningUnder.and.returnValue(of([]));
    cycle.revoke.and.returnValue(
      of({ concession: CONCESSION, stopRequested: [], stillRunning: [] }),
    );
    cycle.decide.and.returnValue(of({ proposal: live(), concession: null }));
    cycle.estimate.and.returnValue(of({}));

    keys = jasmine.createSpyObj<ApiAuthService>('ApiAuthService', [
      'apiKeysControllerListApiKeys',
    ]);
    keys.apiKeysControllerListApiKeys.and.returnValue(
      of([{ id: 'k-1', name: "Dawit's MacBook" }]) as never,
    );

    await TestBed.configureTestingModule({
      imports: [AgentsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AgentCycleService, useValue: cycle },
        { provide: ApiAuthService, useValue: keys },
        {
          provide: AgentSkillService,
          useValue: { skill: () => throwError(() => ({ status: 404 })) },
        },
        {
          provide: PermissionService,
          useValue: {
            load: () => undefined,
            isAdmin: () => opts.isAdmin ?? true,
            permissions: () => opts.permissions ?? ['a', 'b'],
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(
                opts.proposalId ? { proposalId: opts.proposalId } : {},
              ),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentsComponent);
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const findAll = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  afterEach(() => TestBed.resetTestingModule());

  describe('the ceiling, stated first', () => {
    it('says an agent can never do more than you can', async () => {
      await build();
      const ceiling = find('ceiling');
      expect(ceiling?.textContent).toContain(
        'An agent can never do more than you can',
      );
      expect(ceiling?.textContent).toContain('cannot reach past it');
    });

    it('sits above every grant on the page', async () => {
      await build({ proposals: [live()], concessions: [CONCESSION] });
      const html: string = fixture.nativeElement.innerHTML;
      expect(html.indexOf('data-testid="ceiling"')).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="ceiling"')).toBeLessThan(
        html.indexOf('data-testid="group-waiting"'),
      );
    });

    it('names the rank the API reported and no other', async () => {
      await build({ isAdmin: false, permissions: ['x'] });
      expect(find('ceiling')?.textContent).toContain('You hold 1 permission');
      expect(find('ceiling')?.textContent).not.toContain('administrator');
    });
  });

  describe('the order of the page', () => {
    it('puts what is waiting on a person above what has already been allowed', async () => {
      await build();
      const html: string = fixture.nativeElement.innerHTML;
      expect(html.indexOf('data-testid="group-waiting"')).toBeLessThan(
        html.indexOf('data-testid="group-granted"'),
      );
      expect(html.indexOf('data-testid="group-granted"')).toBeLessThan(
        html.indexOf('data-testid="group-activity"'),
      );
    });
  });

  describe('what is waiting on you', () => {
    it('shows only the requests that can still be answered', async () => {
      await build({
        proposals: [
          live(),
          live({ id: 'p-old', expiresAt: new Date(Date.now() - 1000).toISOString() }),
          live({ id: 'p-done', status: PROPOSAL_STATUS.DENIED }),
        ],
      });
      expect(findAll('request')).toHaveSize(1);
      expect(find('waiting-count')?.textContent).toContain('1 request');
      expect(find('waiting-count')?.textContent).toContain('1 expired');
    });

    it('says so plainly when nothing is waiting', async () => {
      await build();
      expect(find('no-requests')?.textContent).toContain('Nothing is waiting');
    });

    it('answers a request and reads both lists again', async () => {
      await build({ proposals: [live()] });
      expect(cycle.listProposals).toHaveBeenCalledTimes(1);
      find('allow-once')?.click();
      expect(cycle.decide).toHaveBeenCalledWith('p-live', 'once');
      expect(cycle.listProposals).toHaveBeenCalledTimes(2);
      expect(cycle.listConcessions).toHaveBeenCalledTimes(2);
    });

    it('reports a refused answer without pretending it went through', async () => {
      await build({ proposals: [live()] });
      cycle.decide.and.returnValue(
        throwError(() => ({ error: { message: 'already answered' } })),
      );
      find('deny')?.click();
      fixture.detectChanges();
      expect(find('decide-error')?.textContent).toContain('already answered');
    });

    it('names the credential that asked', async () => {
      await build({ proposals: [live()] });
      expect(find('request-who')?.textContent).toContain("Dawit's MacBook");
    });

    it('reports a list it could not read', async () => {
      await build({ proposalsFail: true });
      expect(fixture.nativeElement.textContent).toContain('no proposals for you');
    });
  });

  describe('a link followed out of an agent refusal', () => {
    it('hoists the request that was linked to', async () => {
      await build({
        proposalId: 'p-second',
        proposals: [live(), live({ id: 'p-second', sentence: 'restart app a-2' })],
      });
      expect(findAll('request-sentence')[0].textContent).toContain(
        'Restart app a-2',
      );
    });

    it('says the request was already answered rather than showing nothing', async () => {
      await build({
        proposalId: 'p-done',
        proposals: [live({ id: 'p-done', status: PROPOSAL_STATUS.DENIED })],
      });
      expect(find('already-answered')?.textContent).toContain('DENIED');
    });
  });

  describe('what stands, and taking it back', () => {
    it('lists what may be done without asking', async () => {
      await build({ concessions: [CONCESSION] });
      expect(findAll('concession')).toHaveSize(1);
      expect(find('granted-count')?.textContent).toContain('1 grant');
    });

    it('drops what was already revoked', async () => {
      await build({
        concessions: [
          CONCESSION,
          { ...CONCESSION, id: 'g-2', revokedAt: '2026-08-22T00:00:00.000Z' },
        ],
      });
      expect(findAll('concession')).toHaveSize(1);
    });

    it('asks what is still running before offering the revoke', async () => {
      await build({ concessions: [CONCESSION] });
      find('revoke')?.click();
      fixture.detectChanges();
      expect(cycle.runningUnder).toHaveBeenCalledWith('g-1');
      expect(find('revoke-dialog')).toBeTruthy();
      expect(cycle.revoke).not.toHaveBeenCalled();
    });

    it('revokes once confirmed, and reads the list again', async () => {
      await build({ concessions: [CONCESSION] });
      find('revoke')?.click();
      fixture.detectChanges();
      find('confirm-revoke')?.click();
      fixture.detectChanges();
      expect(cycle.revoke).toHaveBeenCalledWith('g-1', false);
      expect(cycle.listConcessions).toHaveBeenCalledTimes(2);
      expect(find('revoke-dialog')).toBeNull();
    });

    it('keeps the dialog open when the revoke was refused', async () => {
      await build({ concessions: [CONCESSION] });
      cycle.revoke.and.returnValue(
        throwError(() => ({ error: { message: 'not yours' } })),
      );
      find('revoke')?.click();
      fixture.detectChanges();
      find('confirm-revoke')?.click();
      fixture.detectChanges();
      expect(find('revoke-error')?.textContent).toContain('not yours');
      expect(find('revoke-dialog')).toBeTruthy();
    });
  });

  describe('what it has done', () => {
    it('draws the register the API now serves', async () => {
      await build({ activity: [ACTED], activityTotal: 1 });
      expect(find('activity-log')).toBeTruthy();
      expect(find('activity-what')?.textContent).toContain('cluster_add_worker');
      expect(find('activity-count')?.textContent).toContain('1 call');
    });

    it('says plainly when nothing has been done, rather than looking broken', async () => {
      await build();
      expect(find('no-activity')?.textContent).toContain('Nothing has been done');
      expect(find('activity-count')?.textContent).toContain('nothing yet');
    });

    it('keeps the rest of the page when the register will not load', async () => {
      await build({ proposals: [live()], activityFails: true });
      expect(find('activity-error-banner')?.textContent).toContain(
        'no register for you',
      );
      expect(findAll('request')).toHaveSize(1);
      expect(find('activity-count')?.textContent).toContain('could not be read');
    });

    it('says when it is showing the whole instance and not only you', async () => {
      await build({
        activity: [ACTED],
        activityScope: 'instance',
        activityTotal: 9,
      });
      expect(find('activity-scope')?.textContent).toContain(
        'every agent on the instance',
      );
      expect(find('activity-count')?.textContent).toContain('whole instance');
    });

    it('names an actor that holds an account instead of a key', async () => {
      await build({
        activity: [
          { ...ACTED, actorKeyId: null, actorKeyName: null, userId: 'u-bot' },
        ],
        identities: [
          {
            userId: 'idp-77',
            userName: 'flui-agent-release',
            name: 'release-bot',
            fluiUserId: 'u-bot',
          },
        ],
      });
      expect(find('activity-what')?.textContent).toContain('release-bot');
    });

    it('shows no name rather than a wrong one when the directory is refused', async () => {
      await build({
        activity: [
          { ...ACTED, actorKeyId: null, actorKeyName: null, userId: 'u-bot' },
        ],
        identitiesFail: true,
      });
      expect(find('activity-what')?.textContent).not.toContain('u-bot');
      expect(find('activity-log')).toBeTruthy();
    });
  });
});
