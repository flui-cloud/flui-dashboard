import { Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  PlacementStrategy,
  ProvisionMode,
  STRATEGIES,
  ScalingBounds,
  StrategyCopy,
} from '../../model/scaling-group.models';
import {
  NodeRequirement,
  SectionGroup,
} from '../../model/scaling-section.models';
import { refusesWholeCatalogue } from './scaling-tabs-format';

export type BoundRole = keyof ScalingBounds;

export type FieldValue = number | string | null;

export interface ListMove {
  index: number;
  by: -1 | 1;
}

export class GroupDraft {
  readonly group: Signal<SectionGroup>;

  private readonly state: WritableSignal<SectionGroup>;

  constructor(initial: SectionGroup) {
    this.state = signal<SectionGroup>(initial);
    this.group = this.state.asReadonly();
  }

  readonly canProvision = computed(() => this.group().capability.canProvision);

  readonly hasCatalogue = computed(() => this.group().capability.hasCatalogue);

  readonly provider = computed(() => this.group().capability.provider);

  readonly buyableRegions = computed(() => this.group().buyableRegions);

  readonly refusesEverything = computed(() =>
    refusesWholeCatalogue(
      this.group().capability,
      this.group().limits.hourlyBillingOnly,
    ),
  );

  /** What is wrong with each node limit as typed, said beside that field. */
  readonly boundProblems = computed(() => boundProblemsOf(this.group().bounds));

  readonly chosenStrategy = computed<StrategyCopy | null>(
    () => STRATEGIES.find((s) => s.id === this.group().strategy) ?? null,
  );

  setProvision(provision: ProvisionMode): void {
    this.state.update((group) => ({ ...group, provision }));
  }

  setBound(role: BoundRole, value: FieldValue): void {
    const next = whole(value);
    if (next === null) return;
    this.state.update((group) => {
      const bounds: ScalingBounds = { ...group.bounds };
      bounds[role] = next;
      return { ...group, bounds };
    });
  }

  setSettle(value: FieldValue): void {
    const next = whole(value);
    if (next === null) return;
    this.state.update((group) => ({ ...group, settleSeconds: next }));
  }

  addRegion(region: string): void {
    this.state.update((group) =>
      group.regions.includes(region)
        ? group
        : { ...group, regions: [...group.regions, region] },
    );
  }

  removeRegion(region: string): void {
    this.state.update((group) => ({
      ...group,
      regions: group.regions.filter((r) => r !== region),
    }));
  }

  addShape(shape: string): void {
    this.state.update((group) =>
      group.shapes.includes(shape)
        ? group
        : { ...group, shapes: [...group.shapes, shape] },
    );
  }

  removeShape(shape: string): void {
    this.state.update((group) => ({
      ...group,
      shapes: group.shapes.filter((s) => s !== shape),
    }));
  }

  moveShape(move: ListMove): void {
    this.state.update((group) => {
      const shapes = [...group.shapes];
      const to = move.index + move.by;
      if (to < 0 || to >= shapes.length) return group;
      [shapes[move.index], shapes[to]] = [shapes[to], shapes[move.index]];
      return { ...group, shapes };
    });
  }

  setStrategy(strategy: PlacementStrategy): void {
    this.state.update((group) => ({ ...group, strategy }));
  }

  setHourlyOnly(hourlyBillingOnly: boolean): void {
    this.state.update((group) => ({
      ...group,
      limits: { ...group.limits, hourlyBillingOnly },
    }));
  }

  setCost(value: FieldValue): void {
    this.state.update((group) => ({
      ...group,
      limits: { ...group.limits, maxMonthlyCost: euros(value) },
    }));
  }

  setRequirement(part: keyof NodeRequirement, value: string): void {
    this.state.update((group) => {
      const current: NodeRequirement = group.requirement ?? {
        cpu: '',
        memory: '',
      };
      return { ...group, requirement: { ...current, [part]: value } };
    });
  }
}

/**
 * Bounds count every node, master included, and the master can never be
 * removed — so one is the smallest a live cluster can be, and the API refuses
 * anything outside this range on either of its doors.
 */
export const MIN_FLEET_NODES = 1;
export const MAX_FLEET_NODES = 20;

export type BoundProblems = Partial<Record<BoundRole, string>>;

/**
 * A value out of range is kept in the draft and named beside its field, so
 * Save is never switched off without a reason on the screen.
 */
export function boundProblemsOf(bounds: ScalingBounds): BoundProblems {
  const out: BoundProblems = {};
  for (const role of ['min', 'desired', 'max'] as const) {
    const value = bounds[role];
    if (value > MAX_FLEET_NODES) {
      out[role] = `At most ${MAX_FLEET_NODES} nodes, master included.`;
    } else if (value < MIN_FLEET_NODES) {
      out[role] = `At least ${MIN_FLEET_NODES} node: the master.`;
    }
  }
  if (!out.max && !out.min && bounds.min > bounds.max) {
    out.max = 'Max nodes cannot be below min nodes.';
  }
  if (
    !out.desired &&
    !out.max &&
    !out.min &&
    (bounds.desired < bounds.min || bounds.desired > bounds.max)
  ) {
    out.desired = 'The target sits between min and max nodes.';
  }
  return out;
}

function whole(value: FieldValue): number | null {
  if (value === null || value === '') return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function euros(value: FieldValue): number | null {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}
