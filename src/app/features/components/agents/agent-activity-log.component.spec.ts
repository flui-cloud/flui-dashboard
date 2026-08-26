import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AgentActivityEntry,
  AgentIdentityActivity,
} from '../../model/agent-activity.models';
import { AgentActivityLogComponent } from './agent-activity-log.component';

const entry = (over: Partial<AgentActivityEntry> = {}): AgentActivityEntry => ({
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
  actorKeyName: 'release-bot',
  actorKeyRevoked: false,
  args: { nodeType: 'worker' },
  operationId: 'op-1',
  operation: {
    id: 'op-4c1f0000-0000-0000-0000-000000000000',
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
  ...over,
});

const actor = (
  over: Partial<AgentIdentityActivity> = {},
): AgentIdentityActivity => ({
  actorKind: 'agent',
  actorKeyId: 'k-1',
  actorKeyName: 'release-bot',
  actorKeyRevoked: false,
  keyLastUsedAt: new Date().toISOString(),
  userId: 'u-owner',
  lastActivityAt: new Date(Date.now() - 120_000).toISOString(),
  lastTool: 'cluster_add_worker',
  lastOutcome: null,
  lastAllowed: true,
  calls: 12,
  refused: 2,
  ...over,
});

describe('the register of what an agent did', () => {
  let fixture: ComponentFixture<AgentActivityLogComponent>;

  const build = async (opts: {
    entries?: AgentActivityEntry[];
    identities?: AgentIdentityActivity[];
    total?: number;
    keyNames?: Record<string, string>;
    identityNames?: Record<string, string>;
  } = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AgentActivityLogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentActivityLogComponent);
    fixture.componentRef.setInput('entries', opts.entries ?? []);
    fixture.componentRef.setInput('identities', opts.identities ?? []);
    fixture.componentRef.setInput(
      'total',
      opts.total ?? (opts.entries?.length ?? 0),
    );
    fixture.componentRef.setInput('keyNames', opts.keyNames ?? {});
    fixture.componentRef.setInput('identityNames', opts.identityNames ?? {});
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const findAll = (testid: string): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`),
    );

  afterEach(() => TestBed.resetTestingModule());

  describe('every row names its permission', () => {
    it('separates a standing grant from a one-off answer', async () => {
      await build({
        entries: [
          entry({ id: 'a', under: 'concession' }),
          entry({ id: 'b', under: 'approval', underSentence: null }),
        ],
      });
      const labels = findAll('activity-under').map((n) => n.textContent?.trim());
      expect(labels).toEqual(['standing grant', 'allowed once']);
    });

    it('reads a refusal and a pause before it reads the permission', async () => {
      await build({
        entries: [
          entry({ id: 'a', allowed: false, under: 'approval' }),
          entry({ id: 'b', outcome: 'input_required', under: 'concession' }),
        ],
      });
      const labels = findAll('activity-under').map((n) => n.textContent?.trim());
      expect(labels).toEqual(['refused', 'stopped to ask you']);
    });

    it('says the trace is missing, not that the permission was', async () => {
      await build({
        entries: [
          entry({ under: null, underSentence: null, operationId: null, operation: null }),
        ],
      });
      const cell = find('activity-under');
      expect(cell?.textContent?.trim()).toBe('not traced');
      expect(cell?.getAttribute('title')).toContain('started none');
      expect(cell?.textContent).not.toContain('no permission');
    });

    it('carries the words that were read at the moment of the yes', async () => {
      await build({ entries: [entry()] });
      expect(find('activity-under')?.getAttribute('title')).toBe(
        'add nodes to cluster c-1',
      );
    });
  });

  describe('what the row says happened', () => {
    it('names the resource the operation recorded', async () => {
      await build({ entries: [entry()] });
      const said = find('activity-what')?.textContent ?? '';
      expect(said).toContain('cluster_add_worker');
      expect(said).toContain('control-cluster');
      expect(find('activity-operation')?.textContent).toContain('completed');
    });

    it('distinguishes an operation withheld from one never started', async () => {
      await build({
        entries: [
          entry({ id: 'a', operationId: 'op-9', operation: null }),
          entry({ id: 'b', operationId: null, operation: null }),
        ],
      });
      const notes = findAll('activity-operation').map((n) => n.textContent?.trim());
      expect(notes).toEqual(['started something you cannot read']);
      expect(fixture.nativeElement.textContent).toContain(
        'started something you cannot read',
      );
    });
  });

  describe('the message a refusal came back with', () => {
    it('is not rendered until it is asked for', async () => {
      await build({ entries: [entry({ allowed: false, error: 'no such scope' })] });
      expect(find('activity-error')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('no such scope');

      find('activity-error-toggle')?.click();
      fixture.detectChanges();
      expect(find('activity-error')?.textContent).toContain('no such scope');
    });

    it('is not offered at all on a call that went through', async () => {
      await build({ entries: [entry({ allowed: true, error: 'stale' })] });
      expect(find('activity-error-toggle')).toBeNull();
    });
  });

  describe('whose activity it is', () => {
    it('names the credential the register itself named', async () => {
      await build({ entries: [entry()] });
      expect(find('activity-what')?.textContent).toContain('release-bot');
    });

    it('falls back to the key directory', async () => {
      await build({
        entries: [entry({ actorKeyName: null })],
        keyNames: { 'k-1': 'laptop' },
      });
      expect(find('activity-what')?.textContent).toContain('laptop');
    });

    it('stops there, rather than putting a uuid where a name goes', async () => {
      await build({ entries: [entry({ actorKeyName: null })] });
      expect(find('activity-what')?.textContent).not.toContain('k-1');
      expect(find('activity-what')?.textContent).toContain('cluster_add_worker');
    });

    it('names a keyless actor through the account it acts as', async () => {
      await build({
        entries: [entry({ actorKeyId: null, actorKeyName: null, userId: 'u-bot' })],
        identityNames: { 'u-bot': 'release-bot' },
      });
      expect(find('activity-what')?.textContent).toContain('release-bot');
    });

    it('summarises each credential by what it did, refusals included', async () => {
      await build({ identities: [actor()], entries: [entry()] });
      const said = find('activity-actor')?.textContent ?? '';
      expect(said).toContain('release-bot');
      expect(said).toContain('12 calls');
      expect(said).toContain('2 refused');
      expect(said).toContain('last acted');
    });

    it('marks a credential that has since been switched off', async () => {
      await build({
        identities: [actor({ actorKeyRevoked: true })],
        entries: [entry()],
      });
      expect(find('activity-actor')?.textContent).toContain('revoked');
    });
  });

  it('says how much of the register it is showing', async () => {
    await build({ entries: [entry()], total: 240 });
    expect(find('activity-more')?.textContent).toContain('most recent of 240');
  });

  it('reads as empty rather than as broken when nothing was done', async () => {
    await build();
    expect(find('no-activity')?.textContent).toContain('written by the act');
    expect(find('activity-log')).toBeNull();
  });
});
