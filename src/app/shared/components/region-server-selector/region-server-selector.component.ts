import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideLoader,
  lucideMapPin,
  lucideServer,
  lucideShieldOff,
} from '@ng-icons/lucide';
import {
  ProviderWizardService,
  ProviderRegion,
  ServerTypeOption,
} from '../../services/provider-wizard.service';
import { PricingService } from '../../services/pricing.service';

type CpuTypeFilter = 'all' | 'shared' | 'dedicated';

@Component({
  selector: 'app-region-server-selector',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCircleAlert,
      lucideLoader,
      lucideMapPin,
      lucideServer,
      lucideShieldOff,
    }),
  ],
  template: `
    <div class="space-y-6">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <ng-icon name="lucideMapPin" class="h-4 w-4 text-muted-foreground" />
          <label class="text-sm font-bold">Region</label>
          <span class="text-xs text-muted-foreground">Prices vary by region — pick the cheapest that has the size you need</span>
        </div>

        <div *ngIf="wizardService.isRegionLoading()" class="flex items-center justify-center py-6">
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-blue-500" />
        </div>

        <div
          *ngIf="wizardService.serverTypeError() && !wizardService.isServerTypeLoading()"
          class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm mb-3"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4" />
          <span>{{ wizardService.serverTypeError() }}</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <button
            *ngFor="let region of regions()"
            type="button"
            (click)="selectRegion(region)"
            [disabled]="!isRegionSelectable(region)"
            [class]="regionCardClass(region)"
            class="flex items-center gap-3 p-3 border-2 rounded-lg text-left transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span class="text-2xl leading-none">{{ region.flagEmoji }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold truncate">{{ region.name }}</p>
              <p
                *ngIf="cheapestByRegion()[region.id] !== undefined; else regionUnavailable"
                class="text-xs text-muted-foreground truncate"
              >
                from €{{ pricingService.formatMonthlyPrice(cheapestByRegion()[region.id]) }}/mo
              </p>
              <ng-template #regionUnavailable>
                <p class="text-xs text-muted-foreground/60 truncate">Unavailable</p>
              </ng-template>
            </div>
            <ng-icon
              *ngIf="selectedRegion() === region.id"
              name="lucideCheck"
              class="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
            />
          </button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideServer" class="h-4 w-4 text-muted-foreground" />
            <label class="text-sm font-bold">Node size</label>
            <span *ngIf="selectedRegionName()" class="text-xs text-muted-foreground">
              in {{ selectedRegionName() }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-medium text-muted-foreground">CPU</label>
            <select
              [value]="cpuTypeFilter()"
              (change)="setCpuTypeFilter($any($event.target).value)"
              class="h-7 rounded-md border border-border bg-background px-2 py-0.5 text-xs"
            >
              <option value="all">All</option>
              <option value="shared">Shared (VPS)</option>
              <option value="dedicated">Dedicated</option>
            </select>
            <span class="text-xs text-muted-foreground">({{ filteredServerTypes().length }})</span>
          </div>
        </div>

        <div
          *ngIf="!selectedRegion()"
          class="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border rounded-lg"
        >
          Select a region above to see available node sizes.
        </div>

        <div
          *ngIf="selectedRegion() && wizardService.isServerTypeLoading()"
          class="flex items-center justify-center py-8"
        >
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-blue-500" />
        </div>

        <div
          *ngIf="selectedRegion() && !wizardService.isServerTypeLoading()"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <button
            *ngFor="let serverType of filteredServerTypes()"
            type="button"
            (click)="selectServerType(serverType)"
            [disabled]="!serverType.managedFirewall"
            [class]="serverCardClass(serverType)"
            class="relative p-4 border-2 rounded-lg text-left transition-all"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="min-w-0">
                <p class="text-base font-bold truncate">{{ serverType.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ serverType.architecture === 'x86' ? 'x86' : 'ARM' }}
                </p>
              </div>
              <span [class]="cpuBadgeClass(serverType.cpuType)" class="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0">
                {{ serverType.cpuType === 'dedicated' ? 'Dedicated' : 'Shared' }}
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
              <div>
                <p class="text-xs text-muted-foreground">vCPU</p>
                <p class="text-sm font-semibold">{{ serverType.vcpu }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">RAM</p>
                <p class="text-sm font-semibold">{{ serverType.ram }}GB</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Disk</p>
                <p class="text-sm font-semibold">
                  {{ serverType.storageType === 'local' ? serverType.disk + 'G' : 'Network' }}
                </p>
              </div>
            </div>

            <div class="flex items-end justify-between pt-3 border-t border-border">
              <div>
                <p class="text-base font-bold">
                  ~€{{ pricingService.formatMonthlyPrice(serverType.pricePerHour) }}<span class="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
                <p class="text-xs text-muted-foreground">€{{ serverType.pricePerHour.toFixed(4) }}/h</p>
              </div>
              <ng-icon
                *ngIf="selectedServerTypeId() === serverType.id"
                name="lucideCheck"
                class="h-5 w-5 text-blue-600 dark:text-blue-400"
              />
            </div>

            <div *ngIf="!serverType.managedFirewall" class="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <ng-icon name="lucideShieldOff" class="h-3 w-3" />
              No managed firewall
            </div>

            <div *ngIf="otherRegionNames(serverType).length > 0" class="mt-2 text-[11px] text-muted-foreground truncate">
              Also in {{ otherRegionNames(serverType).join(', ') }}
            </div>
          </button>
        </div>

        <div
          *ngIf="selectedRegion() && !wizardService.isServerTypeLoading() && filteredServerTypes().length === 0"
          class="text-center py-8 text-sm text-muted-foreground"
        >
          No node sizes match this filter in {{ selectedRegionName() }}.
        </div>
      </div>
    </div>
  `,
  styles: [],
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

  readonly regions = computed<ProviderRegion[]>(
    () => this.wizardService.regionsData()[this.selectedProvider()] ?? []
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

  readonly cheapestByRegion = computed<Record<string, number>>(() => {
    const provider = this.selectedProvider();
    const catalog = this.wizardService.serverTypesData();
    const result: Record<string, number> = {};
    for (const region of this.regions()) {
      const selectable = (catalog[`${provider}:${region.id}`] ?? []).filter(
        (type) => type.managedFirewall
      );
      if (selectable.length > 0) {
        result[region.id] = Math.min(...selectable.map((type) => type.pricePerHour));
      }
    }
    return result;
  });

  private readonly regionNamesById = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const region of this.regions()) result[region.id] = region.name;
    return result;
  });

  readonly selectedRegionName = computed<string>(
    () => this.regionNamesById()[this.selectedRegion()] ?? ''
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
          (error) => console.error('Failed to load server catalog:', error)
        );
      });
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

  selectServerType(serverType: ServerTypeOption): void {
    if (!serverType.managedFirewall) return;
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

  regionCardClass(region: ProviderRegion): string {
    if (!this.isRegionSelectable(region)) {
      return 'border-border bg-muted/30';
    }
    return this.selectedRegion() === region.id
      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
      : 'border-border hover:border-blue-300 dark:hover:border-blue-600 hover:bg-muted/40 cursor-pointer';
  }

  serverCardClass(serverType: ServerTypeOption): string {
    if (!serverType.managedFirewall) {
      return 'border-border bg-muted/30 opacity-70 cursor-not-allowed';
    }
    return this.selectedServerTypeId() === serverType.id
      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
      : 'border-border hover:border-blue-300 dark:hover:border-blue-600 hover:bg-muted/40 cursor-pointer';
  }

  cpuBadgeClass(cpuType: 'shared' | 'dedicated'): string {
    return cpuType === 'dedicated'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
  }
}
