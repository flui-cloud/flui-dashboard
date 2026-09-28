import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CostsComponent } from './costs.component';
import { CostsService } from '../../service/costs.service';
import { Costs } from '../../model/costs.models';

const m = (month: string, current: boolean, spent: number, forecast: number | null = null) => ({
  month,
  current,
  spentNet: spent,
  spentGross: null,
  forecastNet: current ? forecast : null,
  forecastGross: null,
});

const COSTS: Costs = {
  currency: 'EUR',
  months: ['2026-08', '2026-09'],
  totals: [m('2026-08', false, 20.004), m('2026-09', true, 11.2449, 12.3051)],
  providers: [
    {
      provider: 'hetzner',
      priced: true,
      billedAs: 'Billed by the hour, never more than the monthly price in one month',
      vatIncluded: true,
      vatRatePercent: '19',
      months: [m('2026-08', false, 20.004), m('2026-09', true, 11.2449, 12.3051)],
      clusters: [
        { clusterId: 'c2', clusterName: 'wc-1', region: 'nbg1', removed: true, months: [m('2026-08', false, 3), m('2026-09', true, 0.3, 0.3)], unpriced: 0, listPriced: 0 },
      ],
      unpriced: 0,
      listPriced: 2,
      note: null,
    },
    {
      provider: 'byos',
      priced: false,
      billedAs: null,
      vatIncluded: false,
      vatRatePercent: null,
      months: [m('2026-08', false, 0), m('2026-09', true, 0, 0)],
      clusters: [],
      unpriced: 1,
      listPriced: 0,
      note: 'Flui has no price list for this provider: the machines are counted, not priced. You pay it directly.',
    },
  ],
  recordedSince: '2026-05-12T08:00:00.000Z',
  notes: ['Traffic above what each machine includes is not counted.'],
  calculatedAt: '2026-09-26T14:00:00.000Z',
};

describe('the Costs page', () => {
  const render = async (costs: Costs | null, error: string | null = null) => {
    const load = jasmine.createSpy('load').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [CostsComponent],
      providers: [
        {
          provide: CostsService,
          useValue: { costs: signal(costs), loading: signal(false), error: signal(error), load },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CostsComponent);
    fixture.detectChanges();
    const amounts = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('td.tabular-nums'),
    ).map((cell) => cell.textContent!.trim());
    return { text: fixture.nativeElement.textContent as string, load, amounts };
  };

  it('shows spent, expected and last month, month by month and provider by provider', async () => {
    const { text, load, amounts } = await render(COSTS);
    expect(load).toHaveBeenCalledWith(6);
    expect(text).toContain('Spent this month');
    expect(text).toContain('€11.24');
    expect(text).toContain('€12.31');
    expect(text).toContain('Aug 2026');
    expect(text).toContain('€20.00');
    expect(text).toContain('wc-1');
    expect(text).toContain('deleted');
    expect(text).toContain('19% VAT on this account');
    expect(text).toContain('not priced');
    expect(text).toContain("priced at today's list price");
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(amount).toMatch(/^(€[\d,]+\.\d{2}|—)$/);
  });

  it('says nothing is recorded instead of drawing an empty table', async () => {
    const { text } = await render({ ...COSTS, providers: [] });
    expect(text).toContain('Nothing recorded yet');
    expect(text).not.toContain('All providers');
  });

  it('says why the costs cannot be read', async () => {
    const { text } = await render(null, 'Costs cover the whole installation, so only an administrator of the infrastructure can read them.');
    expect(text).toContain('only an administrator');
  });
});
