import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PendingAction } from '../../service/assistant.service';
import { AssistantConfirmCardComponent } from './assistant-confirm-card.component';

const ESTIMATE_NOTE =
  'This request has a cost estimate attached and you are NOT being shown it — ' +
  'the person deciding reads it on that page. Tell the user this action has a ' +
  'price you cannot see; do not describe it as free and do not invent a figure.';

const PLAIN: PendingAction = {
  toolCallId: 'tc-1',
  name: 'app_restart',
  arguments: { id: 'a-1' },
  tier: 'write',
  label: 'Restart my-api',
  groupKey: 'app_restart:a-1',
};

const RAISED: PendingAction = {
  toolCallId: 'tc-2',
  name: 'cluster_node_add',
  arguments: { count: 1 },
  tier: 'write',
  label: 'Add 1 node to control-cluster',
  groupKey: 'cluster_node_add:c-1',
  request: {
    proposalId: 'p-1',
    sentence: 'add nodes to cluster c-1',
    estimateNote: ESTIMATE_NOTE,
    decideUrl: 'https://console.test/settings/agents/requests/p-1',
  },
};

describe('confirming an action in the chat', () => {
  let fixture: ComponentFixture<AssistantConfirmCardComponent>;

  const build = async (pending: PendingAction[]): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AssistantConfirmCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AssistantConfirmCardComponent);
    fixture.componentRef.setInput('pending', pending);
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const findAll = (testid: string): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`),
    );

  afterEach(() => TestBed.resetTestingModule());

  it('shows the cycle’s sentence before the buttons, in its own words', async () => {
    await build([RAISED]);
    expect(find('cycle-sentence')?.textContent?.trim()).toBe(
      'add nodes to cluster c-1',
    );
  });

  it('says a price is attached, in the same sentence the agent is told', async () => {
    await build([RAISED]);
    expect(find('cycle-estimate')?.textContent).toContain(
      'cost estimate attached',
    );
  });

  it('stays silent about a price when there is none attached', async () => {
    await build([
      { ...RAISED, request: { ...RAISED.request!, estimateNote: undefined } },
    ]);
    expect(find('cycle-request')).toBeTruthy();
    expect(find('cycle-estimate')).toBeNull();
  });

  it('points at the page that resolves the figure', async () => {
    await build([RAISED]);
    expect(find('cycle-decide-url')?.getAttribute('href')).toBe(
      'https://console.test/settings/agents/requests/p-1',
    );
  });

  it('shows no request for a call that never raised one', async () => {
    await build([PLAIN]);
    expect(find('cycle-request')).toBeNull();
  });

  it('keeps every sentence when several calls collapse into one confirmation', async () => {
    await build([
      RAISED,
      {
        ...RAISED,
        toolCallId: 'tc-3',
        request: { proposalId: 'p-2', sentence: 'add nodes to cluster c-2' },
      },
    ]);
    expect(findAll('cycle-sentence').map((el) => el.textContent?.trim())).toEqual(
      ['add nodes to cluster c-1', 'add nodes to cluster c-2'],
    );
  });

  it('still marks a destructive action as destructive', async () => {
    await build([{ ...RAISED, tier: 'destructive' }]);
    expect(fixture.nativeElement.textContent).toContain('Destructive action');
    expect(find('cycle-sentence')).toBeTruthy();
  });

  it('approves every tool call behind the confirmation, and denies with none', async () => {
    await build([
      RAISED,
      {
        ...RAISED,
        toolCallId: 'tc-3',
        request: { proposalId: 'p-3', sentence: 'add nodes to cluster c-3' },
      },
    ]);
    const decided: string[][] = [];
    fixture.componentInstance.decided.subscribe((ids: string[]) =>
      decided.push(ids),
    );
    (
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>
    ).forEach((b) => b.click());
    expect(decided).toEqual([[], ['tc-2', 'tc-3']]);
  });
});
