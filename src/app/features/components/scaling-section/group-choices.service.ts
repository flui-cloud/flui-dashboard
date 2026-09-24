import { Injectable, inject, signal } from '@angular/core';
import {
  ProviderRegion,
  ProviderWizardService,
  ServerTypeOption,
} from '../../../shared/services/provider-wizard.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { ListChoice } from './settings-list-editor.component';

/**
 * The regions and machines a scaling group may be pointed at, read from the
 * same catalogue the cluster wizard reads.
 *
 * Deliberately not a second source: a person choosing where a group may buy is
 * choosing from the list they were offered when they made the cluster, and two
 * lists that drift apart would make the group look wrong for reasons nobody
 * could see. The scaling section only narrows it — to what this cluster's own
 * private network can be reached from.
 */
@Injectable({ providedIn: 'root' })
export class GroupChoicesService {
  private readonly wizard = inject(ProviderWizardService);
  private readonly pricing = inject(PricingService);

  private readonly regionsByProvider = signal<Record<string, ProviderRegion[]>>(
    {},
  );
  private readonly machinesByProvider = signal<
    Record<string, ServerTypeOption[]>
  >({});

  /** Silent by design: a catalogue that will not load leaves a free field, not an error. */
  async load(provider: string): Promise<void> {
    if (this.regionsByProvider()[provider]) return;
    try {
      const regions = await this.wizard.loadServerTypesAllRegions(provider);
      const machines = new Map<string, ServerTypeOption>();
      for (const region of regions) {
        for (const machine of this.wizard.getServerTypes(provider, region.id)) {
          machines.set(machine.id, machine);
        }
      }
      this.regionsByProvider.update((all) => ({ ...all, [provider]: regions }));
      this.machinesByProvider.update((all) => ({
        ...all,
        [provider]: [...machines.values()],
      }));
    } catch {
      // Left unset: every reader treats a missing catalogue as "no list", which
      // is the free field they had before this existed.
    }
  }

  /**
   * Where a group may be pointed, narrowed to the regions its cluster's network
   * can be reached from. Null where no catalogue was read — the caller then
   * falls back to a free field rather than offering an empty list.
   */
  regionChoices(
    provider: string,
    reachable: string[] | null,
  ): ListChoice[] | null {
    const regions = this.regionsByProvider()[provider];
    if (!regions?.length) return reachable?.length ? bare(reachable) : null;

    const within = reachable
      ? regions.filter((region) => reachable.includes(region.id))
      : regions;

    return within.map((region) => ({
      value: region.id,
      label: `${region.flagEmoji} ${region.name}`,
      note: region.country,
      unavailable: !region.available,
    }));
  }

  /**
   * What a group may buy, smallest first and marked where no region it buys in
   * offers it — those first, then the rest, cheapest first within each.
   *
   * The rest are marked rather than hidden, because the reading behind them
   * cannot tell "not sold there" from "sold out this morning". Hiding would
   * mean a machine could never be put on the list during the very outage that
   * makes a person go and look.
   */
  machineChoices(provider: string, regions: string[]): ListChoice[] | null {
    const machines = this.machinesByProvider()[provider];
    if (!machines?.length) return null;

    const offeredHere = (machine: ServerTypeOption) =>
      !regions.length ||
      regions.some((region) =>
        (machine.availableRegionIds ?? []).includes(region),
      );

    return [...machines]
      .sort(
        (a, b) =>
          Number(offeredHere(b)) - Number(offeredHere(a)) ||
          a.pricePerHour - b.pricePerHour,
      )
      .map((machine) => ({
        value: machine.id,
        label: machine.name,
        note: `${machine.vcpu} vCPU · ${machine.ram} GB · \u20ac${this.pricing.formatMonthlyPrice(machine.pricePerHour)}/mo`,
        unavailable: !offeredHere(machine),
      }));
  }

  /**
   * The cheapest machine a group may buy, in euros a month, or null where the
   * catalogue was not read. Narrowed to the machines the group names, because
   * the ones it does not name are not what a cap has to leave room for.
   */
  cheapestMonthly(provider: string, shapes: string[]): number | null {
    const machines = this.machinesByProvider()[provider];
    if (!machines?.length) return null;
    const eligible = shapes.length
      ? machines.filter((machine) => shapes.includes(machine.id))
      : machines;
    if (!eligible.length) return null;
    return Math.min(
      ...eligible.map((machine) =>
        this.pricing.calculateMonthlyPrice(machine.pricePerHour),
      ),
    );
  }

  /** How a code already saved should read, for both lists. */
  labels(provider: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const region of this.regionsByProvider()[provider] ?? []) {
      out[region.id] = `${region.flagEmoji} ${region.name}`;
    }
    for (const machine of this.machinesByProvider()[provider] ?? []) {
      out[machine.id] =
        `${machine.vcpu} vCPU · ${machine.ram} GB · \u20ac${this.pricing.formatMonthlyPrice(machine.pricePerHour)}/mo`;
    }
    return out;
  }
}

/** A reachable region the catalogue says nothing about is still a choice. */
function bare(values: string[]): ListChoice[] {
  return values.map((value) => ({ value, label: value }));
}
