import { Costs, CostProvider } from '../../model/costs.models';
import { clusterRows, headline, monthLabel, vatNote } from './costs-view';

const m = (month: string, current: boolean, spent: number, forecast: number | null = null) => ({
  month,
  current,
  spentNet: spent,
  spentGross: null,
  forecastNet: current ? forecast : null,
  forecastGross: null,
});

const hetzner: CostProvider = {
  provider: 'hetzner',
  priced: true,
  billedAs: 'Billed by the hour, never more than the monthly price in one month',
  vatIncluded: true,
  vatRatePercent: '19',
  months: [m('2026-08', false, 20), m('2026-09', true, 11.24, 12.31)],
  clusters: [
    { clusterId: 'c1', clusterName: 'control', region: 'fsn1', removed: false, months: [m('2026-08', false, 20), m('2026-09', true, 10.94, 12.01)], unpriced: 0, listPriced: 0 },
    { clusterId: 'c2', clusterName: 'wc-1', region: 'nbg1', removed: true, months: [m('2026-08', false, 0), m('2026-09', true, 0.3, 0.3)], unpriced: 0, listPriced: 0 },
    { clusterId: 'c3', clusterName: 'idle', region: 'nbg1', removed: true, months: [m('2026-08', false, 0), m('2026-09', true, 0, 0)], unpriced: 0, listPriced: 0 },
  ],
  unpriced: 0,
  listPriced: 0,
  note: null,
};

const COSTS: Costs = {
  currency: 'EUR',
  months: ['2026-08', '2026-09'],
  totals: [m('2026-08', false, 20), m('2026-09', true, 11.24, 12.31)],
  providers: [hetzner],
  recordedSince: '2026-05-12T08:00:00.000Z',
  notes: [],
  calculatedAt: '2026-09-26T14:00:00.000Z',
};

describe('the Costs section', () => {
  it('reads this month, its forecast and last month from the totals', () => {
    expect(headline(COSTS)).toEqual({
      spent: 11.24,
      forecast: 12.31,
      spentGross: null,
      forecastGross: null,
      lastMonth: 20,
      lastMonthLabel: 'Aug 2026',
    });
    expect(monthLabel('2026-01')).toBe('Jan 2026');
  });

  it('lists the clusters that cost something, deleted ones included', () => {
    const rows = clusterRows(hetzner);
    expect(rows.map((r) => [r.name, r.removed, r.spent, r.forecast, r.lastMonth])).toEqual([
      ['control', false, 10.94, 12.01, 20],
      ['wc-1', true, 0.3, 0.3, 0],
    ]);
  });

  it('names the VAT the provider applies, or says there is none published', () => {
    expect(vatNote(hetzner)).toBe('19% VAT on this account');
    expect(vatNote({ ...hetzner, vatIncluded: false, vatRatePercent: null })).toBe('Prices published without VAT');
  });

  it('shows no figures for a provider Flui cannot price', () => {
    const byos: CostProvider = {
      ...hetzner,
      provider: 'byos',
      priced: false,
      clusters: [{ ...hetzner.clusters[0], unpriced: 1 }],
    };
    expect(clusterRows(byos)[0]).toEqual(jasmine.objectContaining({ spent: null, forecast: null, unpriced: 1 }));
  });
});
