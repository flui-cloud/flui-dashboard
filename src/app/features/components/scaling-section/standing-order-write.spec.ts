import { SectionGroup } from '../../model/scaling-section.models';
import { withExpansion, withoutOrder } from './standing-order-write';

const group = (over: Partial<SectionGroup> = {}): SectionGroup =>
  ({
    id: 'g-1',
    name: 'default',
    bounds: { min: 1, desired: 1, max: 3 },
    standingOrders: [],
    ...over,
  }) as SectionGroup;

describe('writing a standing order', () => {
  it('raises the target with the order, so the order has something to wait below', () => {
    const write = withExpansion(group(), {
      shape: 'cx33',
      region: 'fsn1',
      wanted: 1,
    });

    expect(write).toEqual({
      name: 'default',
      bounds: { min: 1, desired: 2, max: 3 },
      standingOrders: [
        { kind: 'expand', shape: 'cx33', region: 'fsn1', wanted: 1, replaces: null },
      ],
    });
  });

  it('keeps the orders already there', () => {
    const existing = group({
      standingOrders: [
        {
          kind: 'replace',
          shape: 'cx33',
          region: 'fsn1',
          wanted: 1,
          replaces: 'w-1',
          outlook: null,
          drainable: null,
        },
      ],
    });

    const write = withExpansion(existing, { shape: 'cx23', region: 'nbg1', wanted: 1 });

    expect('standingOrders' in write && write.standingOrders?.length).toBe(2);
  });

  it('refuses a target above the ceiling, and says what to do', () => {
    const write = withExpansion(group({ bounds: { min: 1, desired: 3, max: 3 } }), {
      shape: 'cx33',
      region: 'fsn1',
      wanted: 1,
    });

    expect(write).toEqual({
      refused: 'That makes the target 4, above the ceiling of 3. Raise the ceiling in Group first.',
    });
  });

  it('lowers the target back when an expansion is cancelled, never below the floor', () => {
    const write = withoutOrder(
      group({
        bounds: { min: 1, desired: 2, max: 3 },
        standingOrders: [
          {
            kind: 'expand',
            shape: 'cx33',
            region: 'fsn1',
            wanted: 3,
            replaces: null,
            outlook: null,
            drainable: null,
          },
        ],
      }),
      0,
    );

    expect(write.bounds.desired).toBe(1);
    expect(write.standingOrders).toEqual([]);
  });
});
