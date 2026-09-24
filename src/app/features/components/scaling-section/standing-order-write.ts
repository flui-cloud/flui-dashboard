import {
  StandingOrder,
  WriteScalingGroup,
  WriteStandingOrder,
} from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';

/** The orders as the API takes them back: only what a person set. */
export function ordersOf(group: SectionGroup): WriteStandingOrder[] {
  return group.standingOrders.map((order: StandingOrder) => ({
    kind: order.kind,
    shape: order.shape,
    region: order.region,
    wanted: order.wanted,
    replaces: order.replaces,
  }));
}

/**
 * The write that adds an expansion.
 *
 * An expansion buys only while the fleet is below its target, so asking for
 * one more machine is also moving the target up by one: the two go in one
 * write or the order would wait on a target it can never be below.
 */
export function withExpansion(
  group: SectionGroup,
  order: { shape: string; region: string; wanted: number },
): WriteScalingGroup | { refused: string } {
  const desired = group.bounds.desired + order.wanted;
  if (desired > group.bounds.max) {
    return {
      refused: `That makes the target ${desired}, above the ceiling of ${group.bounds.max}. Raise the ceiling in Group first.`,
    };
  }
  return {
    name: group.name,
    bounds: { ...group.bounds, desired },
    standingOrders: [
      ...ordersOf(group),
      { kind: 'expand', ...order, replaces: null },
    ],
  };
}

/** Taking an expansion back also takes back the target it raised. */
export function withoutOrder(
  group: SectionGroup,
  index: number,
): WriteScalingGroup {
  const orders = ordersOf(group);
  const [dropped] = orders.splice(index, 1);
  const lowered =
    dropped?.kind === 'expand'
      ? Math.max(group.bounds.min, group.bounds.desired - dropped.wanted)
      : group.bounds.desired;
  return {
    name: group.name,
    bounds: { ...group.bounds, desired: lowered },
    standingOrders: orders,
  };
}
