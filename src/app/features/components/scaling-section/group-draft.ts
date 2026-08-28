import { Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  PlacementStrategy,
  ProvisionMode,
  STRATEGIES,
  ScalingBounds,
  StrategyCopy,
} from '../../model/scaling-group.models';
import { NodeRequirement, SectionGroup } from '../../model/scaling-section.models';
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

  readonly refusesEverything = computed(() =>
    refusesWholeCatalogue(this.group().capability, this.group().limits.hourlyBillingOnly),
  );

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
      group.shapes.includes(shape) ? group : { ...group, shapes: [...group.shapes, shape] },
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
      limits: { ...group.limits, maxMonthlyCost: whole(value) },
    }));
  }

  setRequirement(part: keyof NodeRequirement, value: string): void {
    this.state.update((group) => {
      const current: NodeRequirement = group.requirement ?? { cpu: '', memory: '' };
      return { ...group, requirement: { ...current, [part]: value } };
    });
  }
}

function whole(value: FieldValue): number | null {
  if (value === null || value === '') return null;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
