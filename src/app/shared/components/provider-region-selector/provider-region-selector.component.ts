import {
  Component,
  OnInit,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';

import { RouterLink } from '@angular/router';
import {
  ProviderWizardService,
  ProviderOption,
  ProviderRegion,
  ServerTypeOption,
} from '../../services/provider-wizard.service';
import { PricingService } from '../../services/pricing.service';
import { architectureLabel, architectureWarning } from '../architecture-badge.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-provider-region-selector',
  imports: [RouterLink, FlAlert, FlLoadingState, FlEmptyState, FlTable, FlButton],
  host: { class: 'fl-stack' },
  templateUrl: './provider-region-selector.component.html',
})
export class ProviderRegionSelectorComponent implements OnInit {
  readonly wizardService = inject(ProviderWizardService);
  readonly pricingService = inject(PricingService);

  readonly currentStep = input.required<number>();
  readonly selectedProvider = input<string>('');
  readonly selectedRegion = input<string>('');
  readonly selectedServerTypeId = input<string>('');
  readonly lockedProvider = input<string | null>(null);

  readonly providerSelected = output<string>();
  readonly regionSelected = output<string>();
  readonly serverTypeSelected = output<string>();

  readonly cpuTypeFilter = signal<'all' | 'shared' | 'dedicated'>('all');
  readonly regions = signal<ProviderRegion[]>([]);
  readonly serverTypes = signal<ServerTypeOption[]>([]);

  readonly hasConfiguredProvider = computed(() =>
    this.wizardService.providersData().some((p) => !p.comingSoon && p.configured),
  );

  readonly filteredServerTypes = computed<ServerTypeOption[]>(() => {
    const filter = this.cpuTypeFilter();
    const types = this.serverTypes();

    if (filter === 'all') return types;
    return types.filter((type) => type.cpuType === filter);
  });

  readonly selectedArchitectureWarning = computed(() =>
    architectureWarning(
      this.serverTypes().find((type) => type.id === this.selectedServerTypeId())?.architecture,
    ),
  );

  constructor() {
    effect(() => {
      const provider = this.selectedProvider();
      if (provider && this.currentStep() === 2) {
        untracked(() =>
          this.wizardService.loadRegions(provider).then(
            (regions) => this.regions.set(regions),
            (error) => console.error('Failed to load regions:', error),
          ),
        );
      }
    });

    effect(() => {
      const provider = this.selectedProvider();
      const region = this.selectedRegion();
      if (provider && region && this.currentStep() === 3) {
        untracked(() =>
          this.wizardService.loadServerTypes(provider, region).then(
            (serverTypes) => this.serverTypes.set(serverTypes),
            (error) => console.error('Failed to load server types:', error),
          ),
        );
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      if (this.currentStep() === 1) {
        try {
          await this.wizardService.loadProviders();
        } catch (error) {
          console.error('Failed to load providers:', error);
        }
      }
    })();
  }

  selectProvider(providerId: string): void {
    const locked = this.lockedProvider();
    if (locked && providerId !== locked) return;
    this.providerSelected.emit(providerId);
  }

  isProviderDisabled(provider: ProviderOption): boolean {
    if (provider.comingSoon || !provider.configured) return true;
    const locked = this.lockedProvider();
    return !!locked && provider.id !== locked;
  }

  selectRegion(regionId: string): void {
    this.regionSelected.emit(regionId);
  }

  selectServerType(serverTypeId: string): void {
    this.serverTypeSelected.emit(serverTypeId);
  }

  setCpuTypeFilter(value: string): void {
    this.cpuTypeFilter.set(value as 'all' | 'shared' | 'dedicated');
  }

  protected readonly architectureWarning = architectureWarning;
  protected readonly architectureLabel = architectureLabel;

  isSelectable(serverType: ServerTypeOption): boolean {
    return serverType.managedFirewall;
  }
}
