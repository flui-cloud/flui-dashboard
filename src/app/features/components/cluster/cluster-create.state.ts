import { computed, inject, signal } from '@angular/core';
import { AsyncValidatorFn, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { AutoscaleDefaults } from '../../model/autoscale.models';
import { NodeSizeOption, isControlClusterType } from '../../model/cluster.models';
import { SubnetInfo, VNetInfo } from '../../model/vnet.models';
import { ClusterService } from '../../service/cluster.service';
import { DnsZonesService } from '../../service/dns-zones.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import {
  AvailabilityChoice,
  STANDARD_AVAILABILITY,
  STANDARD_DRAFT,
} from './cluster-availability-choice.component';
import { isSubnetUsable } from './cluster-create-network-model';

export class ClusterCreateState {
  private readonly fb = inject(FormBuilder);
  private readonly clusterService = inject(ClusterService);
  private readonly wizardService = inject(ProviderWizardService);
  readonly dnsZonesService = inject(DnsZonesService);
  readonly pricingService = inject(PricingService);

  basicConfigForm!: FormGroup;
  firewallConfigForm!: FormGroup;
  readonly formValid = signal<boolean>(false);
  readonly providerRefusal = signal<string | null>(null);
  readonly environmentNetwork = signal<{ name: string; ipRange: string } | null>(null);
  readonly overlayEnabled = signal(false);

  readonly selectedProvider = signal<string>('');
  readonly generatingName = signal(false);
  readonly selectedRegion = signal<string>('');
  readonly selectedServerTypeId = signal<string>('');
  readonly selectedSshKeyId = signal<string | undefined>(undefined);
  readonly selectedVNetId = signal<string | null>(null);
  readonly selectedSubnetId = signal<string | null>(null);
  readonly selectedVNetData = signal<VNetInfo | null>(null);

  readonly minNodes = signal<number>(1);
  readonly maxNodes = signal<number>(3);
  readonly fixedNodes = signal<number>(1);

  readonly availabilityDraft = signal(STANDARD_DRAFT);
  readonly availability = signal<AvailabilityChoice>(STANDARD_AVAILABILITY);
  readonly highlyAvailable = computed(() => this.availability().level === 'three-locations');
  readonly availabilityZones = computed(() =>
    [...this.availability().servers.map((s) => s.zone), ...this.availability().later].join(' · '),
  );
  readonly costedNodes = computed(() =>
    this.highlyAvailable() ? this.availability().servers.length : this.fixedNodes(),
  );

  readonly autoscaleDefaults = signal<AutoscaleDefaults | null>(null);

  readonly diskSizeGb = signal<number>(20);

  readonly sharedStorageEnabled = signal<boolean>(true);
  readonly sharedStorageVolumeSizeGb = signal<number>(20);

  readonly endpointHostnameMode = signal<'ip' | 'domain'>('ip');
  readonly selectedDnsZoneId = signal<string | null>(null);

  readonly fluiBuildsNetwork = signal(false);
  readonly fluiNetworkCidr = signal('');
  readonly showNetworkHelp = signal(false);

  readonly dnsZones = computed(() => this.dnsZonesService.zones());

  readonly selectedZone = computed<DnsZoneResponseDto | null>(() => {
    const id = this.selectedDnsZoneId();
    return id ? (this.dnsZones().find((z) => z.id === id) ?? null) : null;
  });

  readonly selectedServerType = computed(() => {
    const cacheKey = `${this.selectedProvider()}:${this.selectedRegion()}`;
    const serverTypes = this.wizardService.serverTypesData()[cacheKey] || [];
    return serverTypes.find((st) => st.id === this.selectedServerTypeId()) ?? null;
  });

  readonly needsDiskConfig = computed(() => this.selectedServerType()?.storageType === 'network');

  readonly storageCostPerHour = computed(() => {
    const serverType = this.selectedServerType();
    if (!serverType?.blockStoragePricePerGbMonthly) return 0;
    return (serverType.blockStoragePricePerGbMonthly * this.diskSizeGb()) / 730;
  });

  readonly totalCostPerNodePerHour = computed(() => {
    const serverType = this.selectedServerType();
    if (!serverType) return 0;
    return serverType.pricePerHour + this.storageCostPerHour();
  });

  readonly controlClusterProvider = computed<string | null>(() => {
    const observability = this.clusterService
      .clusters()
      .find((c) => isControlClusterType(c.clusterType));
    return observability?.provider ?? null;
  });

  readonly lockedProvider = computed<string | null>(() => null);

  readonly vnetRequired = computed<boolean>(() => {
    const provider = this.selectedProvider();
    if (!provider) return false;
    return this.wizardService.getProviderDefinition(provider)?.capabilities?.vnetRequired ?? false;
  });

  readonly canBuildNetwork = computed<boolean>(() => {
    const provider = this.selectedProvider();
    if (!provider) return false;
    return (
      this.wizardService.getProviderDefinition(provider)?.capabilities?.supportsFluiManagedVNet ??
      false
    );
  });

  private readonly controlCluster = computed(
    () => this.clusterService.clusters().find((c) => isControlClusterType(c.clusterType)) ?? null,
  );

  readonly isCrossProviderWorkload = computed<boolean>(() => {
    const control = this.controlClusterProvider();
    const workload = this.selectedProvider();
    return !!control && !!workload && control !== workload;
  });

  readonly managedFirewallRules = computed(() => {
    if (!this.isCrossProviderWorkload() || this.overlayEnabled()) return [];
    return [
      {
        description: 'Kubernetes API, control-plane access',
        protocol: 'TCP',
        port: '6443',
        direction: 'IN',
        source: this.controlCluster()?.name ?? 'control cluster',
      },
    ];
  });

  initializeForms(nameValidator: AsyncValidatorFn): void {
    this.basicConfigForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)], [nameValidator]],
    });

    this.firewallConfigForm = this.fb.group({
      enabled: [true],
      rules: this.fb.array([]),
    });
  }

  getFirewallRulesArray(): FormArray {
    return this.firewallConfigForm.get('rules') as FormArray;
  }

  isNetworkStepValid(): boolean {
    if (this.environmentNetwork()) return true;
    if (this.vnetRequired()) return !!this.selectedVNetId() && this.hasUsableSubnetSelected();
    if (this.selectedVNetId()) return this.hasUsableSubnetSelected();
    return true;
  }

  private hasUsableSubnetSelected(): boolean {
    const subnet = this.selectedVNetData()?.subnets.find((s) => s.id === this.selectedSubnetId());
    return !!subnet && this.isSubnetUsable(subnet);
  }

  isSubnetUsable(subnet: SubnetInfo): boolean {
    return isSubnetUsable(subnet, this.selectedRegion());
  }

  getSelectedSubnet() {
    const vnetData = this.selectedVNetData();
    const subnetId = this.selectedSubnetId();
    if (!vnetData || !subnetId) return null;
    return vnetData.subnets.find((s) => s.id === subnetId);
  }

  canComplete(): boolean {
    const vnetOk = this.isNetworkStepValid();
    return (
      this.basicConfigForm.valid &&
      !!this.selectedProvider() &&
      !!this.selectedRegion() &&
      !!this.selectedServerTypeId() &&
      this.availability().ready &&
      vnetOk
    );
  }

  setMinNodes(count: number): void {
    this.minNodes.set(count);
  }

  setMaxNodes(count: number): void {
    this.maxNodes.set(count);
  }

  setFixedNodes(count: number): void {
    this.fixedNodes.set(count);
  }

  setDiskSizeGb(value: number): void {
    this.diskSizeGb.set(Math.min(500, Math.max(5, value || 5)));
  }

  setSharedStorageEnabled(enabled: boolean): void {
    this.sharedStorageEnabled.set(enabled);
  }

  setSharedStorageVolumeSizeGb(value: number): void {
    this.sharedStorageVolumeSizeGb.set(Math.min(1000, Math.max(10, value || 10)));
  }

  getClusterName(): string {
    return this.basicConfigForm?.get('name')?.value || '';
  }

  getSelectedProviderName(): string {
    const provider = this.wizardService
      .providersData()
      .find((p) => p.id === this.selectedProvider());
    return provider?.name || '';
  }

  getSelectedRegionName(): string {
    const regions = this.wizardService.regionsData()[this.selectedProvider()] || [];
    const region = regions.find((r) => r.id === this.selectedRegion());
    return region?.name || '';
  }

  getSelectedServerType(): NodeSizeOption | undefined {
    const cacheKey = `${this.selectedProvider()}:${this.selectedRegion()}`;
    const serverTypes = this.wizardService.serverTypesData()[cacheKey] || [];
    return serverTypes.find((st) => st.id === this.selectedServerTypeId());
  }

  getEstimatedMonthlyCost(): string {
    const serverType = this.getSelectedServerType();
    if (!serverType) return '0.00';

    const haHourly = this.highlyAvailable() ? this.availability().pricePerHour : null;
    if (haHourly !== null) return this.pricingService.formatMonthlyPrice(haHourly);

    const nodes = this.costedNodes();
    return this.pricingService.formatClusterMonthlyCost(serverType.pricePerHour, nodes);
  }

  getSshKeyById(keyId: string) {
    return this.wizardService.sshKeysData().find((key) => key.id === keyId);
  }
}
