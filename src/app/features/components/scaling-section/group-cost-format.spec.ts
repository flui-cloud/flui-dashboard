import { costRows } from './group-cost-format';

describe('costRows', () => {
  it('shows each scenario as the API priced it, with two decimals', () => {
    expect(
      costRows({
        priced: true,
        says: '',
        unpricedShapes: [],
        scenarios: [
          { kind: 'at-min', label: 'Always at the minimum, 1 node', lowEur: 10, highEur: 10 },
          { kind: 'short-peak', label: 'Peak', lowEur: null, highEur: null },
          { kind: 'worst-case', label: 'Worst', lowEur: 50, highEur: 100.456 },
        ],
        ceiling: { monthlyEur: null, nodesWithin: null, stopsBeforeMax: false, says: '' },
        suggestedCeilingEur: 101,
      }).map((r) => r.value),
    ).toEqual(['€10.00/mo', '— no hourly price', '€50.00 – €100.46/mo']);
  });

  it('has no rows where nothing was priced', () => {
    expect(costRows(null)).toEqual([]);
  });
});
