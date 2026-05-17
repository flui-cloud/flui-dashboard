import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideChevronDown, lucideAlertCircle, lucideExternalLink, lucideGlobe, lucideServer } from '@ng-icons/lucide';
import { DnsZonesService } from '../../service/dns-zones.service';
import { CreateDnsZoneDto } from '../../../core/api/model/createDnsZoneDto';

type Step = 1 | 2 | 3;

@Component({
  selector: 'app-dns-zone-register',
  standalone: true,
  imports: [RouterLink, FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideArrowLeft, lucideChevronDown, lucideAlertCircle, lucideExternalLink, lucideGlobe, lucideServer })],
  template: `
    <div class="p-6 flex justify-center">
    <div class="w-full max-w-xl">
      <!-- Header -->
      <div class="flex items-start gap-4 mb-6">
        <a
          routerLink="/infrastructure/domains"
          class="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </a>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Register DNS Zone</h1>
      </div>

      <!-- Error banner -->
      @if (dnsZonesService.error()) {
        <div class="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{{ dnsZonesService.error() }}</span>
        </div>
      }

      <!-- Step indicator -->
      <div class="flex items-center gap-2 mb-6">
        @for (s of [1,2,3]; track s) {
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              [class]="step() >= s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
            >{{ s }}</div>
            @if (s < 3) {
              <div class="w-8 h-0.5" [class]="step() > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'"></div>
            }
          </div>
        }
        <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">{{ stepLabel() }}</span>
      </div>

      <!-- Step 1: Select Provider -->
      @if (step() === 1) {
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DNS Provider
            </label>
            @if (loadingProviders()) {
              <div class="h-10 bg-gray-100 dark:bg-gray-700 rounded-md animate-pulse"></div>
            } @else {
              <select
                [(ngModel)]="selectedProvider"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a provider...</option>
                @for (p of dnsZonesService.dnsCapableProviders(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
              @if (!loadingProviders() && dnsZonesService.dnsCapableProviders().length === 0) {
                <p class="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  No active providers with DNS zone support found. Configure a provider with DNS capabilities first.
                </p>
              }
            }
          </div>
          <div class="flex justify-end">
            <button
              (click)="goToStep2()"
              [disabled]="!selectedProvider || loadingZones()"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ loadingZones() ? 'Loading zones...' : 'Next' }}
            </button>
          </div>
        </div>
      }

      <!-- Step 2: Select Zone -->
      @if (step() === 2) {
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zone from <span class="font-semibold">{{ selectedProvider }}</span>
            </label>
            @if (dnsZonesService.providerZones().length === 0) {
              <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-3">
                <div class="flex items-center gap-2">
                  <ng-icon name="lucideGlobe" class="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">No DNS zones found in your {{ selectedProvider }} account</p>
                </div>
                <p class="text-sm text-amber-700 dark:text-amber-400">
                  These zones are read directly from your <span class="font-semibold">{{ selectedProvider }}</span> account via API. To add a domain, you have two options:
                </p>
                <ul class="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                  <li><span class="font-medium">Purchase a domain</span> directly on <span class="font-semibold">{{ selectedProvider }}</span> — it will appear here automatically once active.</li>
                  <li><span class="font-medium">Transfer an existing domain</span> to <span class="font-semibold">{{ selectedProvider }}</span> by updating the nameservers at your current registrar.</li>
                </ul>
                <p class="text-xs text-amber-600 dark:text-amber-500">
                  Once the zone is active in <span class="font-semibold">{{ selectedProvider }}</span>, come back and refresh this step.
                </p>
              </div>
            } @else {
              <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2">
                @for (zone of dnsZonesService.providerZones(); track zone.zoneId) {
                  @let alreadyRegistered = registeredZoneIds().has(zone.zoneId);
                  <label
                    class="flex items-center gap-3 p-2 rounded-md transition-colors"
                    [class]="alreadyRegistered
                      ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'"
                  >
                    <input
                      type="radio"
                      name="zone"
                      [value]="zone.zoneId"
                      [(ngModel)]="selectedZoneId"
                      [disabled]="alreadyRegistered"
                      class="text-blue-600 disabled:cursor-not-allowed"
                    />
                    <div class="flex-1 flex items-center justify-between gap-2 min-w-0">
                      <div class="min-w-0">
                        <span class="text-sm font-medium font-mono"
                          [class]="alreadyRegistered ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'"
                        >{{ zone.name }}</span>
                        <span class="ml-2 text-xs text-gray-400">{{ zone.zoneId }}</span>
                      </div>
                      @if (alreadyRegistered) {
                        <span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Already registered
                        </span>
                      }
                    </div>
                  </label>
                }
              </div>
              <!-- Origin info -->
              <div class="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-1.5">
                <p class="text-xs font-medium text-amber-800 dark:text-amber-300">Don't see your domain?</p>
                <p class="text-xs text-amber-700 dark:text-amber-400">
                  These zones are read directly from your <span class="font-semibold">{{ selectedProvider }}</span> account. To add a missing domain, either purchase it on <span class="font-semibold">{{ selectedProvider }}</span> or transfer it by updating its nameservers at your current registrar. Then come back and refresh.
                </p>
                @if (selectedProviderInfo?.dnsZoneDelegation; as delegation) {
                  <div class="pt-1 border-t border-amber-200 dark:border-amber-700">
                    <a
                      [href]="delegation.delegationGuideUrl"
                      target="_blank"
                      class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline"
                    >
                      View official delegation guide
                      <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                    </a>
                  </div>
                }
              </div>
            }
          </div>
          <div class="flex justify-between">
            <button
              (click)="step.set(1)"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              (click)="step.set(3)"
              [disabled]="!selectedZoneId"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      }

      <!-- Step 3: Confirm -->
      @if (step() === 3) {
        <div class="space-y-4">
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Provider</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ selectedProvider }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Zone</span>
              <span class="font-medium text-gray-900 dark:text-white font-mono">{{ selectedZoneName() }}</span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span class="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              [(ngModel)]="description"
              placeholder="e.g. Production zone for flui.cloud"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div class="flex justify-between">
            <button
              (click)="step.set(2)"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              (click)="register()"
              [disabled]="dnsZonesService.loading()"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ dnsZonesService.loading() ? 'Registering...' : 'Register Zone' }}
            </button>
          </div>
        </div>
      }
    </div>
    </div>
  `,
})
export class DnsZoneRegisterComponent implements OnInit {
  protected dnsZonesService = inject(DnsZonesService);
  private readonly router = inject(Router);

  step = signal<Step>(1);
  selectedProvider = '';
  selectedZoneId = '';
  description = '';

  loadingProviders = signal(false);
  loadingZones = signal(false);

  get selectedProviderInfo() {
    return this.dnsZonesService.dnsCapableProviders().find(p => p.id === this.selectedProvider);
  }

  stepLabel = computed(() => {
    switch (this.step()) {
      case 1: return 'Select provider';
      case 2: return 'Select zone';
      case 3: return 'Confirm';
    }
  });

  selectedZoneName = computed(() => {
    const zone = this.dnsZonesService.providerZones().find(z => z.zoneId === this.selectedZoneId);
    return zone?.name ?? '';
  });

  readonly registeredZoneIds = computed(() =>
    new Set(this.dnsZonesService.zones().map(z => z.providerZoneId))
  );

  ngOnInit(): void {
    void (async () => {
      this.loadingProviders.set(true);
      await Promise.all([
        this.dnsZonesService.loadDnsCapableProviders(),
        this.dnsZonesService.loadZones(),
      ]);
      this.loadingProviders.set(false);
    })();
  }

  async goToStep2(): Promise<void> {
    if (!this.selectedProvider) return;
    this.loadingZones.set(true);
    await this.dnsZonesService.loadProviderZones(this.selectedProvider);
    this.loadingZones.set(false);
    this.selectedZoneId = '';
    this.step.set(2);
  }

  async register(): Promise<void> {
    if (!this.selectedZoneId || !this.selectedProvider) return;
    const zoneName = this.selectedZoneName();
    if (!zoneName) return;

    const dto: CreateDnsZoneDto = {
      providerZoneId: this.selectedZoneId,
      zoneName,
      dnsProvider: this.selectedProvider as CreateDnsZoneDto.DnsProviderEnum,
      ...(this.description ? { description: this.description } : {}),
    };

    const result = await this.dnsZonesService.registerZone(dto);
    if (result) {
      this.router.navigate(['/infrastructure/domains']);
    }
  }
}
