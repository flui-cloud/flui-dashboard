import { consequenceOf } from './scaling-consequence';
import { WriteScalingGroup } from '../../model/scaling-group.models';

function draft(over: Partial<WriteScalingGroup> = {}): WriteScalingGroup {
  return {
    name: 'default',
    bounds: { min: 1, desired: 1, max: 4 },
    provision: 'manual',
    settleSeconds: 30,
    ...over,
  };
}

describe('consequenceOf', () => {
  it('says nothing will be bought while Flui only alerts', () => {
    const reading = consequenceOf(draft(), 1);
    expect(reading.sentence).toContain('will not add a node or spend anything');
    expect(reading.sentence).not.toContain('without asking you');
  });

  it('names how many nodes and how much money before Flui may buy', () => {
    const reading = consequenceOf(
      draft({ provision: 'automatic', limits: { maxMonthlyCost: 45 } }),
      1,
    );
    expect(reading.sentence).toBe(
      'Flui may grow this cluster up to 3 more nodes, spending at most €45 a month, without asking you again.',
    );
  });

  it('counts the room from the nodes the cluster already has, not from the floor', () => {
    const reading = consequenceOf(
      draft({
        bounds: { min: 1, desired: 3, max: 4 },
        provision: 'automatic',
        limits: { maxMonthlyCost: 45 },
      }),
      3,
    );
    expect(reading.sentence).toContain('1 more node');
  });

  it('never claims room a cluster already past its ceiling does not have', () => {
    const reading = consequenceOf(
      draft({
        bounds: { min: 1, desired: 2, max: 2 },
        provision: 'automatic',
        limits: { maxMonthlyCost: 20 },
      }),
      5,
    );
    expect(reading.sentence).toContain('0 more nodes');
  });

  it('speaks in the ceiling where the caller does not know the node count', () => {
    const reading = consequenceOf(
      draft({ provision: 'automatic', limits: { maxMonthlyCost: 45 } }),
    );
    expect(reading.sentence).toContain('to at most 4 nodes');
  });

  it('admits an uncapped sentence for what it is, so the form can refuse it', () => {
    const reading = consequenceOf(draft({ provision: 'automatic' }), 1);
    expect(reading.sentence).toContain('an unlimited amount');
  });

  it('repeats the wait and the floor, the two things a reader forgets', () => {
    const reading = consequenceOf(
      draft({
        provision: 'automatic',
        settleSeconds: 60,
        limits: { maxMonthlyCost: 45 },
      }),
      1,
    );
    expect(reading.clauses[0]).toContain('60 seconds');
    expect(reading.clauses[1]).toContain('never going below 1');
  });
});
