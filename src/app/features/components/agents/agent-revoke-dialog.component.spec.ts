import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AgentConcession,
  ConcessionOperation,
} from '../../model/agent-cycle.models';
import { AgentRevokeDialogComponent } from './agent-revoke-dialog.component';

const CONCESSION: AgentConcession = {
  id: 'g-1',
  keyId: 'k-1',
  action: 'POST /infrastructure/clusters/:id/workers',
  binding: { id: 'c-1' },
  sentence: 'add nodes to cluster c-1',
  createdAt: '2026-08-20T09:00:00.000Z',
};

const RUNNING: ConcessionOperation[] = [
  {
    id: 'o-1',
    operationType: 'ADD_WORKER',
    status: 'IN_PROGRESS',
    progress: 40,
    resourceName: 'worker-3',
    startedAt: '2026-08-24T11:50:00.000Z',
  },
  {
    id: 'o-2',
    operationType: 'ADD_WORKER',
    status: 'PENDING',
    progress: null,
    resourceName: null,
    startedAt: null,
  },
];

describe('taking a standing permission back', () => {
  let fixture: ComponentFixture<AgentRevokeDialogComponent>;

  const build = async (
    inputs: Record<string, unknown> = {},
  ): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AgentRevokeDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentRevokeDialogComponent);
    fixture.componentRef.setInput('concession', CONCESSION);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const findAll = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  afterEach(() => TestBed.resetTestingModule());

  it('names the permission being taken back, in the words it was granted in', async () => {
    await build();
    expect(find('revoke-dialog')?.textContent).toContain(
      'add nodes to cluster c-1',
    );
  });

  it('says what carries on regardless', async () => {
    await build({ running: RUNNING });
    const said = find('what-continues')?.textContent ?? '';
    expect(said).toContain('2');
    expect(said).toContain('carry on');
    expect(findAll('running-operation').length).toBe(2);
    expect(findAll('running-operation')[0].textContent).toContain('ADD_WORKER');
    expect(findAll('running-operation')[0].textContent).toContain('worker-3');
  });

  it('says so plainly when nothing is running under it', async () => {
    await build({ running: [] });
    expect(find('what-continues')?.textContent).toContain('Nothing is running');
    expect(find('also-stop')).toBeNull();
  });

  it('will not confirm against an answer it has not read yet', async () => {
    await build({ loading: true });
    expect(find('confirm-revoke')).toBeNull();
    expect(find('running-loading')).toBeTruthy();
  });

  it('confirms without asking anything to stop, by default', async () => {
    await build({ running: RUNNING });
    const seen: { alsoStop: boolean }[] = [];
    fixture.componentInstance.confirm.subscribe((e) => seen.push(e));
    find('confirm-revoke')?.click();
    expect(seen).toEqual([{ alsoStop: false }]);
  });

  it('carries the second gesture only when it was asked for', async () => {
    await build({ running: RUNNING });
    const seen: { alsoStop: boolean }[] = [];
    fixture.componentInstance.confirm.subscribe((e) => seen.push(e));

    find('also-stop')?.click();
    fixture.detectChanges();
    expect(find('confirm-revoke')?.textContent).toContain('ask them to stop');

    find('confirm-revoke')?.click();
    expect(seen).toEqual([{ alsoStop: true }]);
  });

  it('says the stop is honoured between steps and never mid-step', async () => {
    await build({ running: RUNNING });
    const label = find('also-stop')?.closest('label')?.textContent ?? '';
    expect(label).toContain('next step boundary');
  });

  it('reports a failure without closing itself', async () => {
    await build({ running: RUNNING, error: 'nope' });
    expect(find('revoke-error')?.textContent).toContain('nope');
    expect(find('revoke-dialog')).toBeTruthy();
  });
});
