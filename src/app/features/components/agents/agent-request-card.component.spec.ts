import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  AgentProposal,
  PROPOSAL_STATUS,
  ProposalDecision,
} from '../../model/agent-cycle.models';
import { AgentCycleService } from '../../service/agent-cycle.service';
import { AgentRequestCardComponent } from './agent-request-card.component';

const PROPOSAL: AgentProposal = {
  id: 'p-1',
  keyId: 'k-1',
  action: 'POST /infrastructure/clusters/:id/workers',
  routePath: '/infrastructure/clusters/c-1/workers',
  binding: { id: 'c-1' },
  argsDigest: 'digest',
  sentence: 'add nodes to cluster c-1',
  offersAlways: true,
  estimateRef: '/infrastructure/clusters/c-1/capacity-plan',
  status: PROPOSAL_STATUS.PENDING,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  createdAt: new Date(Date.now() - 120_000).toISOString(),
};

describe('one request, and the answers on offer', () => {
  let fixture: ComponentFixture<AgentRequestCardComponent>;
  let cycle: jasmine.SpyObj<AgentCycleService>;

  const build = async (
    over: Partial<AgentProposal> = {},
    estimate: unknown = { nodeType: 'CPU-4', monthlyCost: '€8.49 / month' },
  ): Promise<void> => {
    cycle = jasmine.createSpyObj<AgentCycleService>('AgentCycleService', [
      'estimate',
    ]);
    cycle.estimate.and.returnValue(of(estimate));

    await TestBed.configureTestingModule({
      imports: [AgentRequestCardComponent],
      providers: [{ provide: AgentCycleService, useValue: cycle }],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentRequestCardComponent);
    fixture.componentRef.setInput('proposal', { ...PROPOSAL, ...over });
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const findAll = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  afterEach(() => TestBed.resetTestingModule());

  describe('what happens if you allow it', () => {
    it('shows the consequence the route declared', async () => {
      await build({ consequence: 'Servers start being billed.' });
      expect(find('request-consequence')?.textContent).toContain(
        'Servers start being billed.',
      );
    });

    it('shows nothing at all when the route declared none', async () => {
      await build({ consequence: null });
      expect(find('request-consequence')).toBeNull();
    });
  });

  describe('three choices, not two', () => {
    it('offers once, always and deny when the request stated its boundary', async () => {
      await build();
      expect(find('allow-once')).toBeTruthy();
      expect(find('allow-always')).toBeTruthy();
      expect(find('deny')).toBeTruthy();
    });

    it('does not render "always" at all when the request stated no boundary', async () => {
      await build({ offersAlways: false });
      expect(find('allow-always')).toBeNull();
      expect(find('allow-once')).toBeTruthy();
      expect(find('deny')).toBeTruthy();
    });

    it('does not render "always" for a request that arrived without the flag', async () => {
      await build({ offersAlways: undefined as unknown as boolean });
      expect(find('allow-always')).toBeNull();
    });

    it('offers no disabled stand-in for the answer it withheld', async () => {
      await build({ offersAlways: false });
      const labels = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).map((b) => (b as HTMLButtonElement).textContent?.trim().toLowerCase());
      expect(labels.some((l) => l?.includes('always'))).toBe(false);
    });

    it('reports the answer with the id of the request it belongs to', async () => {
      await build();
      const seen: { id: string; decision: ProposalDecision }[] = [];
      fixture.componentInstance.decide.subscribe((e) => seen.push(e));

      find('allow-once')?.click();
      find('allow-always')?.click();
      find('deny')?.click();

      expect(seen).toEqual([
        { id: 'p-1', decision: 'once' },
        { id: 'p-1', decision: 'always' },
        { id: 'p-1', decision: 'deny' },
      ]);
    });
  });

  describe('what "always" would concede', () => {
    it('states the exact sentence, verbatim', async () => {
      await build();
      const line = find('grants-line');
      expect(line?.textContent).toContain('add nodes to cluster c-1');
      expect(line?.querySelector('code')?.textContent?.trim()).toBe(
        'add nodes to cluster c-1',
      );
    });

    it('states the fact instead when there is no boundary to state', async () => {
      await build({ offersAlways: false });
      expect(find('grants-line')).toBeNull();
      expect(find('no-always-note')?.textContent).toContain(
        'did not state its own boundary',
      );
    });
  });

  describe('the cost, before the decision', () => {
    it('prices the request from the route the request named', async () => {
      await build();
      expect(cycle.estimate).toHaveBeenCalledWith(
        '/infrastructure/clusters/c-1/capacity-plan',
      );
      const facts = findAll('estimate-fact').map((f) => f.textContent ?? '');
      expect(facts.join(' ')).toContain('€8.49 / month');
    });

    it('shows the figure without anything being opened', async () => {
      await build();
      expect(findAll('estimate-fact').length).toBeGreaterThan(0);
      expect(find('estimate-body')).toBeNull();
      expect(find('full-estimate')).toBeTruthy();
    });

    it('opens the full breakdown behind the link', async () => {
      await build();
      find('full-estimate')?.click();
      fixture.detectChanges();
      expect(find('estimate-body')?.textContent).toContain('monthlyCost');
    });

    it('does not price a request that names no route', async () => {
      await build({ estimateRef: null });
      expect(cycle.estimate).not.toHaveBeenCalled();
      expect(find('full-estimate')).toBeNull();
    });

    it('says the price is missing rather than inventing one', async () => {
      cycle = jasmine.createSpyObj<AgentCycleService>('AgentCycleService', [
        'estimate',
      ]);
      cycle.estimate.and.returnValue(throwError(() => new Error('no')));
      await TestBed.configureTestingModule({
        imports: [AgentRequestCardComponent],
        providers: [{ provide: AgentCycleService, useValue: cycle }],
      }).compileComponents();
      fixture = TestBed.createComponent(AgentRequestCardComponent);
      fixture.componentRef.setInput('proposal', PROPOSAL);
      fixture.detectChanges();

      expect(find('estimate-error')?.textContent).toContain('did not answer');
      expect(findAll('estimate-fact')).toHaveSize(0);
      expect(find('allow-once')).toBeTruthy();
    });

    it('prefers a price already stamped on the request over fetching one', async () => {
      await build({ estimate: { monthlyCost: '€4.00 / month' } });
      expect(cycle.estimate).not.toHaveBeenCalled();
      expect(findAll('estimate-fact')[0].textContent).toContain('€4.00 / month');
    });
  });

  describe('who is speaking', () => {
    it('sets the machine half of the card in monospace', async () => {
      await build();
      const facts = find('request-facts');
      expect(facts?.className).toContain('grid');
      const values = Array.from(facts?.querySelectorAll('dd') ?? []);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(value.className)
          .withContext(value.textContent ?? '')
          .toContain('font-mono');
      }
      expect(find('request-who')?.className).toContain('font-mono');
    });

    it('leaves the product half in the product typeface', async () => {
      await build();
      expect(find('request-sentence')?.className).not.toContain('font-mono');
    });

    it('names the credential when the page resolved it, and never invents one', async () => {
      await build();
      expect(find('request-who')?.textContent).toContain('A credential of yours');

      fixture.componentRef.setInput('agentName', "Dawit's MacBook");
      fixture.detectChanges();
      expect(find('request-who')?.textContent).toContain("Dawit's MacBook");
      expect(find('request-who')?.textContent).toContain('k-1');
    });

    it('shows the action shape and the resource it is bound to', async () => {
      await build();
      const facts = find('request-facts')?.textContent ?? '';
      expect(facts).toContain('POST');
      expect(facts).toContain('/infrastructure/clusters/:id/workers');
      expect(facts).toContain('c-1');
    });
  });
});

