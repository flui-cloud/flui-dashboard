import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import {
  ProviderWizardService,
  ProviderRegion,
  ServerTypeOption,
} from '../../services/provider-wizard.service';
import { PricingService } from '../../services/pricing.service';
import { architectureLabel, architectureWarning } from '../architecture-badge.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

type CpuTypeFilter = 'all' | 'shared' | 'dedicated';

@Component({
  selector: 'app-region-server-selector',
  imports: [FlAlert, FlEmptyState, FlLoadingState, FlTable, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'fl-stack' },
  templateUrl: './region-server-selector.component.html',
})
export class RegionServerSelectorComponent {
  readonly wizardService = inject(ProviderWizardService);
  readonly pricingService = inject(PricingService);

  readonly selectedProvider = input<string>('');
  readonly selectedRegion = input<string>('');
  readonly selectedServerTypeId = input<string>('');

  readonly regionSelected = output<string>();
  readonly serverTypeSelected = output<string>();

  readonly cpuTypeFilter = signal<CpuTypeFilter>('all');
  protected readonly architectureLabel = architectureLabel;

  readonly regions = computed<ProviderRegion[]>(
    () => this.wizardService.regionsData()[this.selectedProvider()] ?? [],
  );

  readonly serverTypesForRegion = computed<ServerTypeOption[]>(() => {
    const provider = this.selectedProvider();
    const region = this.selectedRegion();
    if (!provider || !region) return [];
    return this.wizardService.serverTypesData()[`${provider}:${region}`] ?? [];
  });

  readonly filteredServerTypes = computed<ServerTypeOption[]>(() => {
    const filter = this.cpuTypeFilter();
    const types = this.serverTypesForRegion();
    if (filter === 'all') return types;
    return types.filter((type) => type.cpuType === filter);
  });

  private static readonly CURATED_SIZE_COUNT = 6;

  readonly showAllSizes = signal(false);

  private sampleSpread(sorted: ServerTypeOption[], count: number): ServerTypeOption[] {
    const total = sorted.length;
    if (count >= total) return sorted;
    const picked: ServerTypeOption[] = [];
    const seenIndexes = new Set<number>();
    for (let i = 0; i < count; i++) {
      const index = Math.round((i * (total - 1)) / (count - 1));
      if (seenIndexes.has(index)) continue;
      seenIndexes.add(index);
      picked.push(sorted[index]);
    }
    return picked;
  }

  readonly curatedServerTypes = computed<ServerTypeOption[]>(() => {
    const sorted = this.filteredServerTypes();
    const budget = RegionServerSelectorComponent.CURATED_SIZE_COUNT;
    if (sorted.length <= budget) return sorted;

    const groups = [
      sorted.filter((type) => type.cpuType === 'shared'),
      sorted.filter((type) => type.cpuType === 'dedicated'),
    ].filter((group) => group.length > 0);

    if (groups.length <= 1) {
      return this.sampleSpread(sorted, budget);
    }

    const perGroup = Math.floor(budget / groups.length);
    const remainder = budget - perGroup * groups.length;
    const picked = groups.flatMap((group, i) =>
      this.sampleSpread(group, perGroup + (i < remainder ? 1 : 0)),
    );
    return picked.sort((a, b) => a.pricePerHour - b.pricePerHour);
  });

  readonly hiddenServerTypeCount = computed<number>(
    () => this.filteredServerTypes().length - this.curatedServerTypes().length,
  );

  readonly isShowingAll = computed<boolean>(() => {
    if (this.showAllSizes()) return true;
    const selectedId = this.selectedServerTypeId();
    if (!selectedId) return false;
    return !this.curatedServerTypes().some((type) => type.id === selectedId);
  });

  readonly displayedServerTypes = computed<ServerTypeOption[]>(() =>
    this.isShowingAll() ? this.filteredServerTypes() : this.curatedServerTypes(),
  );

  readonly cheapestByRegion = computed<Record<string, number>>(() => {
    const provider = this.selectedProvider();
    const catalog = this.wizardService.serverTypesData();
    const result: Record<string, number> = {};
    for (const region of this.regions()) {
      const selectable = (catalog[`${provider}:${region.id}`] ?? []).filter((type) =>
        this.isSelectable(type),
      );
      if (selectable.length > 0) {
        result[region.id] = Math.min(...selectable.map((type) => type.pricePerHour));
      }
    }
    return result;
  });

  readonly selectedArchitectureWarning = computed(() =>
    architectureWarning(
      this.serverTypesForRegion().find((type) => type.id === this.selectedServerTypeId())
        ?.architecture,
    ),
  );

  private readonly regionNamesById = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const region of this.regions()) result[region.id] = region.name;
    return result;
  });

  readonly selectedRegionName = computed<string>(
    () => this.regionNamesById()[this.selectedRegion()] ?? '',
  );

  constructor() {
    effect(() => {
      const provider = this.selectedProvider();
      if (!provider) return;
      untracked(() => {
        this.wizardService.loadServerTypesAllRegions(provider).then(
          (regions) => {
            if (this.selectedRegion()) return;
            const firstAvailable = regions.find((region) => this.isRegionSelectable(region));
            if (firstAvailable) this.regionSelected.emit(firstAvailable.id);
          },
          (error) => console.error('Failed to load server catalog:', error),
        );
      });
    });

    effect(() => {
      this.selectedRegion();
      untracked(() => this.showAllSizes.set(false));
    });
  }

  isRegionSelectable(region: ProviderRegion): boolean {
    if (!region.available) return false;
    return this.cheapestByRegion()[region.id] !== undefined;
  }

  selectRegion(region: ProviderRegion): void {
    if (!this.isRegionSelectable(region)) return;
    this.regionSelected.emit(region.id);
  }

  isSelectable(serverType: ServerTypeOption): boolean {
    return serverType.managedFirewall;
  }

  cardTitle(serverType: ServerTypeOption): string | null {
    return (
      architectureWarning(serverType.architecture) ??
      (serverType.managedFirewall ? null : 'No managed firewall')
    );
  }

  selectServerType(serverType: ServerTypeOption): void {
    if (!this.isSelectable(serverType)) return;
    this.serverTypeSelected.emit(serverType.id);
  }

  setCpuTypeFilter(value: string): void {
    this.cpuTypeFilter.set(value as CpuTypeFilter);
  }

  otherRegionNames(serverType: ServerTypeOption): string[] {
    const names = this.regionNamesById();
    const current = this.selectedRegion();
    return (serverType.availableRegionIds ?? [])
      .filter((id) => id !== current)
      .map((id) => names[id])
      .filter((name): name is string => !!name);
  }
}
