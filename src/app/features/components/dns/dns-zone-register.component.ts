import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { DnsZonesService } from '../../service/dns-zones.service';
import { CreateDnsZoneDto } from '../../../core/api/model/createDnsZoneDto';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlWizardSteps, WizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Select provider',
  2: 'Select zone',
  3: 'Confirm',
};

@Component({
  selector: 'app-dns-zone-register',
  imports: [
    RouterLink,
    FormsModule,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlWizardSteps,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideExternalLink })],
  templateUrl: './dns-zone-register.component.html',
})
export class DnsZoneRegisterComponent implements OnInit {
  protected dnsZonesService = inject(DnsZonesService);
  private readonly router = inject(Router);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Domains', link: '/infrastructure/domains' },
    { label: 'Register zone' },
  ];

  readonly step = signal<Step>(1);
  readonly selectedProvider = signal('');
  readonly selectedZoneId = signal('');
  readonly description = signal('');

  readonly loadingProviders = signal(false);
  readonly loadingZones = signal(false);

  readonly selectedProviderInfo = computed(() =>
    this.dnsZonesService.dnsCapableProviders().find((p) => p.id === this.selectedProvider()),
  );

  readonly providerName = computed(
    () => this.selectedProviderInfo()?.displayName ?? this.selectedProvider(),
  );

  readonly stepLabel = computed(() => STEP_TITLES[this.step()]);

  readonly selectedZoneName = computed(() => {
    const id = this.selectedZoneId();
    return this.dnsZonesService.providerZones().find((z) => z.zoneId === id)?.name ?? '';
  });

  readonly registeredZoneIds = computed(
    () => new Set(this.dnsZonesService.zones().map((z) => z.providerZoneId)),
  );

  readonly wizardSteps = computed<WizardStep[]>(() => [
    { name: STEP_TITLES[1], summary: this.step() > 1 ? this.providerName() : undefined },
    { name: STEP_TITLES[2], summary: this.step() > 2 ? this.selectedZoneName() : undefined },
    { name: STEP_TITLES[3] },
  ]);

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

  goToStepIndex(index: number): void {
    this.step.set((index + 1) as Step);
  }

  async goToStep2(): Promise<void> {
    if (!this.selectedProvider()) return;
    this.loadingZones.set(true);
    await this.dnsZonesService.loadProviderZones(this.selectedProvider());
    this.loadingZones.set(false);
    this.selectedZoneId.set('');
    this.step.set(2);
  }

  async register(): Promise<void> {
    const provider = this.selectedProvider();
    if (!this.selectedZoneId() || !provider) return;
    const zoneName = this.selectedZoneName();
    if (!zoneName) return;
    const description = this.description();

    const dto: CreateDnsZoneDto = {
      providerZoneId: this.selectedZoneId(),
      zoneName,
      dnsProvider: provider as CreateDnsZoneDto.DnsProviderEnum,
      ...(description ? { description } : {}),
    };

    const result = await this.dnsZonesService.registerZone(dto);
    if (result) {
      this.router.navigate(['/infrastructure/domains']);
    }
  }
}
