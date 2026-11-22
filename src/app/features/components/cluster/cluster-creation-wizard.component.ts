import {
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';

import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../../../core/services/app-config.service';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormArray,
  Validators,
  AsyncValidatorFn,
} from '@angular/forms';
import {
  WizardStep,
  NodeSizeOption,
  ClusterConfiguration,
  ProviderType,
  isControlClusterType,
} from '../../model/cluster.models';
import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterNameAvailabilityService } from '../../service/cluster-name-availability.service';
import { AutoscaleDefaults } from '../../model/autoscale.models';
import { AccessManagementService } from '../../../core/api/api/accessManagement.service';
import { VNetInfo, SubnetInfo, AddSubnetConfiguration } from '../../model/vnet.models';
import { VNetService } from '../../service/vnet.service';
import { DnsZonesService } from '../../service/dns-zones.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { firstValueFrom } from 'rxjs';

import { SshKeySelectorComponent } from '../../../shared/components/ssh-key-selector/ssh-key-selector.component';
import {
  AvailabilityChoice,
  STANDARD_AVAILABILITY,
  STANDARD_DRAFT,
} from './cluster-availability-choice.component';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { IpDetectionService } from '../../../shared/services/ip-detection.service';
import { ClusterType, getDefaultRulesForClusterType } from '../../model/firewall-v2.models';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlWizardSteps, WizardStep as FlWizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import {
  FirewallRuleDto,
  applyRuleDirection,
  countSourceCidrs,
  customRuleGroup,
  defaultRuleGroup,
  toFirewallRuleDtos,
} from './cluster-create-firewall-form';
import {
  deriveSubnetCidr,
  isSubnetUsable,
  isValidSubnetCidr,
  orderSubnets,
} from './cluster-create-network-model';
import {
  clusterNameValidator,
  createClusterErrorMessage,
  suggestClusterName,
  tagsWithClusterId,
} from './cluster-create-helpers';
import { ClusterCreateStepInfrastructure } from './cluster-create-step-infrastructure';
import { ClusterCreateStepResources } from './cluster-create-step-resources';
import { ClusterCreateStepNetwork } from './cluster-create-step-network';
import { ClusterCreateStepEndpoint } from './cluster-create-step-endpoint';
import { ClusterCreateStepFirewall } from './cluster-create-step-firewall';
import { ClusterCreateStepReview, ReviewVnet } from './cluster-create-step-review';

const EDITABLE_STEPS = [
  'infrastructure',
  'resources',
  'ssh-keys',
  'network',
  'endpoint',
  'firewall',
];

@Component({
  selector: 'cluster-creation-wizard',
  imports: [
    SshKeySelectorComponent,
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlButton,
    FlSpinner,
    ClusterCreateStepInfrastructure,
    ClusterCreateStepResources,
    ClusterCreateStepNetwork,
    ClusterCreateStepEndpoint,
    ClusterCreateStepFirewall,
    ClusterCreateStepReview,
  ],
  templateUrl: './cluster-creation-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ClusterCreationWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly nameAvailabilityService = inject(ClusterNameAvailabilityService);
  private readonly wizardService = inject(ProviderWizardService);
  private readonly vnetService = inject(VNetService);
  private readonly accessManagementService = inject(AccessManagementService);
  private readonly clusterDnsZoneService = inject(ClusterDnsZoneService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  readonly dnsZonesService = inject(DnsZonesService);
  public pricingService = inject(PricingService);
  readonly ipDetectionService = inject(IpDetectionService);

  completeOutput = output<{ success: boolean; cluster?: any; error?: string }>();
  cancelled = output<void>();

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Clusters', link: '/cluster' },
    { label: 'Create cluster' },
  ];
  protected readonly editableSteps = EDITABLE_STEPS;

  basicConfigForm!: FormGroup;
  firewallConfigForm!: FormGroup;
  formValid = signal<boolean>(false);
  currentStepIndex = signal<number>(0);
  isCreating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly providerRefusal = signal<string | null>(null);
  /** Set when a cluster on the chosen provider joins the control's network without being asked. */
  readonly environmentNetwork = signal<{ name: string; ipRange: string } | null>(null);
  /** The Flui network is on: a workload on another provider is reached through the tunnel. */
  readonly overlayEnabled = signal(false);

  selectedProvider = signal<string>('');
  generatingName = signal(false);
  selectedRegion = signal<string>('');
  selectedServerTypeId = signal<string>('');
  selectedSshKeyId = signal<string | undefined>(undefined);
  selectedVNetId = signal<string | null>(null);
  selectedSubnetId = signal<string | null>(null);
  selectedVNetData = signal<VNetInfo | null>(null);

  showAddSubnetForm = signal<boolean>(false);
  addingSubnet = signal<boolean>(false);
  addSubnetError = signal<string | null>(null);
  addSubnetZone = '';
  addSubnetIpRange = '';
  minNodes = signal<number>(1);
  maxNodes = signal<number>(3);
  fixedNodes = signal<number>(1);

  readonly availabilityDraft = signal(STANDARD_DRAFT);
  readonly availability = signal<AvailabilityChoice>(STANDARD_AVAILABILITY);
  readonly highlyAvailable = computed(() => this.availability().level === 'three-locations');
  readonly availabilityZones = computed(() =>
    [...this.availability().servers.map((s) => s.zone), ...this.availability().later].join(' · '),
  );
  readonly costedNodes = computed(() =>
    this.highlyAvailable() ? this.availability().servers.length : this.fixedNodes(),
  );

  autoscaleDefaults = signal<AutoscaleDefaults | null>(null);

  diskSizeGb = signal<number>(20);

  sharedStorageEnabled = signal<boolean>(true);
  sharedStorageVolumeSizeGb = signal<number>(20);

  endpointHostnameMode = signal<'ip' | 'domain'>('ip');
  selectedDnsZoneId = signal<string | null>(null);

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

  /**
   * Nothing is locked here any more.
   *
   * Whether two clusters can reach each other privately is the API's question
   * to answer, per installation. A copy of that rule here would refuse a
   * topology the API accepts, in the browser, without ever showing the reason.
   *
   * Kept as a computed rather than deleted: the input it feeds is how the
   * provider step is told a choice was made for it, and a future lock with a
   * real reason belongs here.
   */
  readonly lockedProvider = computed<string | null>(() => null);

  readonly vnetRequired = computed<boolean>(() => {
    const provider = this.selectedProvider();
    if (!provider) return false;
    return this.wizardService.getProviderDefinition(provider)?.capabilities?.vnetRequired ?? false;
  });

  /** Only some providers can offer this: the ones with no private network of
   *  their own, where pod traffic would otherwise cross the internet in clear. */
  readonly canBuildNetwork = computed<boolean>(() => {
    const provider = this.selectedProvider();
    if (!provider) return false;
    return (
      this.wizardService.getProviderDefinition(provider)?.capabilities?.supportsFluiManagedVNet ??
      false
    );
  });

  readonly fluiBuildsNetwork = signal(false);
  readonly fluiNetworkCidr = signal('');
  readonly showNetworkHelp = signal(false);

  private readonly controlCluster = computed(
    () => this.clusterService.clusters().find((c) => isControlClusterType(c.clusterType)) ?? null,
  );

  /** A workload on a different provider than the control reaches it over the
   *  public interface, so Flui opens a fixed set of ports for the control's IP. */
  readonly isCrossProviderWorkload = computed<boolean>(() => {
    const control = this.controlClusterProvider();
    const workload = this.selectedProvider();
    return !!control && !!workload && control !== workload;
  });

  /** Non-editable rules Flui applies automatically for cross-provider reachability.
   *  Display-only — the control's real source IP is resolved and enforced server-side. */
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

  protected readonly stepList = computed<FlWizardStep[]>(() => {
    const summaries: Record<string, string> = {
      infrastructure: [this.getClusterName(), this.getSelectedProviderName()]
        .filter(Boolean)
        .join(' · '),
      resources: [this.getSelectedRegionName(), this.selectedServerType()?.name]
        .filter(Boolean)
        .join(' · '),
    };
    return this.wizardSteps().map((step) => ({ name: step.title, summary: summaries[step.id] }));
  });

  protected readonly reviewVnet = computed<ReviewVnet | null>(() => {
    const vnet = this.selectedVNetData();
    if (!this.selectedVNetId() || !this.selectedSubnetId()) return null;
    return {
      name: vnet?.name ?? '',
      ipRange: vnet?.ipRange ?? '',
      subnet: this.getSelectedSubnet()?.ipRange ?? '',
    };
  });

  protected get nameControl(): FormControl<string> {
    return this.basicConfigForm.get('name') as FormControl<string>;
  }

  constructor() {
    effect(() => {
      const locked = this.lockedProvider();
      if (locked && this.selectedProvider() !== locked) {
        untracked(() => this.onProviderSelected(locked));
      }
    });
  }

  private isNetworkStepValid(): boolean {
    if (this.environmentNetwork()) return true;
    if (this.vnetRequired()) return !!this.selectedVNetId() && this.hasUsableSubnetSelected();
    if (this.selectedVNetId()) return this.hasUsableSubnetSelected();
    return true;
  }

  private hasUsableSubnetSelected(): boolean {
    const subnet = this.selectedVNetData()?.subnets.find((s) => s.id === this.selectedSubnetId());
    return !!subnet && this.isSubnetUsable(subnet);
  }

  readonly wizardSteps = computed<WizardStep[]>(() => {
    const currentIndex = this.currentStepIndex();

    return [
      {
        id: 'infrastructure',
        title: 'Infrastructure',
        description: 'Configure name and provider',
        icon: 'lucideSettings',
        isValid: this.formValid() && !!this.selectedProvider() && !this.providerRefusal(),
        isCompleted: currentIndex > 0 && this.formValid() && !!this.selectedProvider(),
      },
      {
        id: 'resources',
        title: 'Resources',
        description: 'Choose region, node size and scaling',
        icon: 'lucideServer',
        isValid:
          !!this.selectedRegion() && !!this.selectedServerTypeId() && this.availability().ready,
        isCompleted: currentIndex > 1 && !!this.selectedRegion() && !!this.selectedServerTypeId(),
      },
      {
        id: 'ssh-keys',
        title: 'SSH key',
        description: 'Configure secure access',
        icon: 'lucideKey',
        isValid: true,
        isCompleted: currentIndex > 2,
      },
      {
        id: 'network',
        title: 'Network',
        description: this.vnetRequired()
          ? 'Configure virtual network'
          : 'Configure virtual network (optional)',
        icon: 'lucideNetwork',
        isValid: this.isNetworkStepValid(),
        isCompleted: currentIndex > 3,
      },
      {
        id: 'endpoint',
        title: 'Endpoint',
        description: 'Test addresses or your own domain',
        icon: 'lucideZap',
        isValid: !!this.endpointHostnameMode(),
        isCompleted: currentIndex > 4,
      },
      {
        id: 'firewall',
        title: 'Firewall',
        description: 'Configure firewall rules and source IPs',
        icon: 'lucideShield',
        isValid: this.firewallConfigForm?.valid ?? true,
        isCompleted: currentIndex > 5,
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review and create cluster',
        icon: 'lucideCheck',
        isValid: this.canComplete(),
        isCompleted: false,
      },
    ];
  });

  ngOnInit(): void {
    void (async () => {
      this.initializeForm();
      await this.initializeFirewall();

      try {
        const defs = await this.autoscaleService.loadDefaults();
        this.autoscaleDefaults.set(defs);
        if (defs.defaultMinNodes) this.minNodes.set(defs.defaultMinNodes);
        if (defs.defaultMaxNodes) this.maxNodes.set(defs.defaultMaxNodes);
      } catch {
        this.autoscaleDefaults.set(null);
      }

      await Promise.all([
        this.clusterService.loadClusters(),
        this.wizardService.loadProviders(),
        this.dnsZonesService.loadZones(),
      ]);

      const zones = this.dnsZones();
      if (zones.length === 1) {
        this.selectedDnsZoneId.set(zones[0].id);
      }

      this.basicConfigForm.statusChanges.subscribe(() => {
        this.formValid.set(this.basicConfigForm.valid);
      });

      this.formValid.set(this.basicConfigForm.valid);
    })();
  }

  private initializeForm(): void {
    this.basicConfigForm = this.fb.group({
      name: [
        '',
        [Validators.required, Validators.minLength(3)],
        [this.clusterNameAsyncValidator()],
      ],
    });

    this.firewallConfigForm = this.fb.group({
      enabled: [true],
      rules: this.fb.array([]),
    });
  }

  async generateUniqueClusterName(): Promise<void> {
    this.generatingName.set(true);
    try {
      const suggestedName = await suggestClusterName(
        this.clusterService.clusters(),
        this.selectedProvider(),
        this.checkName,
      );
      this.basicConfigForm.patchValue({ name: suggestedName });
    } finally {
      this.generatingName.set(false);
    }
  }

  private readonly checkName = (name: string, provider: string) =>
    this.nameAvailabilityService.check(name, provider);

  private clusterNameAsyncValidator(): AsyncValidatorFn {
    return clusterNameValidator(
      () => this.clusterService.clusters(),
      () => this.selectedProvider(),
      this.checkName,
    );
  }

  private async initializeFirewall(): Promise<void> {
    try {
      const defaultRules = getDefaultRulesForClusterType(ClusterType.WORKLOAD);
      const userIP = await this.ipDetectionService.detectPublicIP();
      const rulesArray = this.getFirewallRulesArray();
      for (const rule of defaultRules) {
        rulesArray.push(defaultRuleGroup(this.fb, rule, userIP));
      }
    } catch (error) {
      console.error('Failed to initialize firewall rules:', error);
    }
  }

  onProviderSelected(providerId: string): void {
    this.selectedProvider.set(providerId);
    this.selectedRegion.set('');
    this.selectedServerTypeId.set('');
    this.availabilityDraft.set(STANDARD_DRAFT);
    this.availability.set(STANDARD_AVAILABILITY);
    this.providerRefusal.set(null);
    this.environmentNetwork.set(null);
    if (providerId) {
      void this.wizardService.loadServerTypesAllRegions(providerId).catch(() => undefined);
      void this.checkWorkloadProvider(providerId);
    }
  }

  private async checkWorkloadProvider(providerId: string): Promise<void> {
    try {
      const verdict = await firstValueFrom(
        this.http.get<{
          allowed: boolean;
          reason: string | null;
          overlayEnabled?: boolean;
          environmentNetwork?: { name: string; ipRange: string } | null;
        }>(
          `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/workload-providers/${providerId}`,
        ),
      );
      if (this.selectedProvider() !== providerId) return;
      this.providerRefusal.set(verdict.allowed ? null : verdict.reason);
      this.environmentNetwork.set(verdict.environmentNetwork ?? null);
      this.overlayEnabled.set(!!verdict.overlayEnabled);
    } catch {
      if (this.selectedProvider() === providerId) {
        this.providerRefusal.set(null);
        this.environmentNetwork.set(null);
      }
    }
  }

  onRegionSelected(regionId: string): void {
    this.selectedRegion.set(regionId);
    this.selectedServerTypeId.set('');
  }

  onServerTypeSelected(serverTypeId: string): void {
    this.selectedServerTypeId.set(serverTypeId);
  }

  onSshKeySelected(keyId: string | undefined): void {
    this.selectedSshKeyId.set(keyId);
  }

  onVNetSelected(vnet: VNetInfo | null): void {
    if (vnet) {
      this.selectedVNetId.set(vnet.id);
      this.selectedVNetData.set(vnet);
      const usable = vnet.subnets.filter((s) => this.isSubnetUsable(s));
      this.selectedSubnetId.set(usable.length === 1 ? usable[0].id : null);
    } else {
      this.selectedVNetId.set(null);
      this.selectedVNetData.set(null);
      this.selectedSubnetId.set(null);
    }
  }

  selectSubnet(subnetId: string): void {
    const subnet = this.selectedVNetData()?.subnets.find((s) => s.id === subnetId);
    if (subnet && !this.isSubnetUsable(subnet)) return;
    this.selectedSubnetId.set(subnetId);
  }

  isSubnetUsable(subnet: SubnetInfo): boolean {
    return isSubnetUsable(subnet, this.selectedRegion());
  }

  readonly orderedSubnets = computed(() => orderSubnets(this.selectedVNetData()?.subnets ?? []));

  private readonly providerVnetTopology = computed(
    () =>
      this.wizardService.getProviderDefinition(this.selectedProvider())?.capabilities
        ?.vnetTopology ?? null,
  );
  readonly addSubnetZones = computed(() => this.providerVnetTopology()?.zones ?? []);
  private readonly addSubnetConstraints = computed(
    () => this.providerVnetTopology()?.subnetIpRange ?? null,
  );

  private deriveSubnetCidr(vnetIpRange: string): string | undefined {
    return deriveSubnetCidr(
      vnetIpRange,
      this.addSubnetConstraints(),
      this.selectedVNetData()?.subnets.length ?? 0,
    );
  }

  isValidAddSubnetCidr(): boolean {
    if (!this.addSubnetIpRange) return true;
    return isValidSubnetCidr(this.addSubnetIpRange, this.addSubnetConstraints());
  }

  isAddSubnetValid(): boolean {
    if (this.addSubnetZones().length > 0 && !this.addSubnetZone) return false;
    return this.isValidAddSubnetCidr();
  }

  openAddSubnetForm(): void {
    const vnet = this.selectedVNetData();
    const zones = this.addSubnetZones();
    this.addSubnetZone = vnet?.subnets[0]?.networkZone || zones[0]?.id || '';
    this.addSubnetIpRange = vnet ? (this.deriveSubnetCidr(vnet.ipRange) ?? '') : '';
    this.addSubnetError.set(null);
    this.showAddSubnetForm.set(true);
  }

  closeAddSubnetForm(): void {
    this.showAddSubnetForm.set(false);
    this.addSubnetError.set(null);
  }

  async submitAddSubnet(): Promise<void> {
    const vnet = this.selectedVNetData();
    if (!vnet || !this.isAddSubnetValid()) return;
    this.addingSubnet.set(true);
    this.addSubnetError.set(null);
    const existingIds = new Set(vnet.subnets.map((s) => s.id));

    const config: AddSubnetConfiguration = {
      networkZone: this.addSubnetZone,
      ipRange: this.addSubnetIpRange || this.deriveSubnetCidr(vnet.ipRange),
    };

    try {
      const updated = await this.vnetService.addSubnet(vnet.id, config);
      this.selectedVNetData.set(updated);
      const added = updated.subnets.find((s) => !existingIds.has(s.id)) ?? updated.subnets.at(-1);
      if (added) {
        this.selectedSubnetId.set(added.id);
      }
      this.showAddSubnetForm.set(false);
    } catch (error: any) {
      this.addSubnetError.set(error?.error?.message || 'Failed to add subnet');
    } finally {
      this.addingSubnet.set(false);
    }
  }

  getSelectedSubnet() {
    const vnetData = this.selectedVNetData();
    const subnetId = this.selectedSubnetId();
    if (!vnetData || !subnetId) return null;
    return vnetData.subnets.find((s) => s.id === subnetId);
  }

  nextStep(): void {
    if (this.canProceedFromCurrentStep()) {
      this.currentStepIndex.update((index) => Math.min(index + 1, this.wizardSteps().length - 1));
    }
  }

  previousStep(): void {
    this.currentStepIndex.update((index) => Math.max(index - 1, 0));
  }

  goToStep(index: number): void {
    if (index >= 0 && index < this.currentStepIndex()) this.currentStepIndex.set(index);
  }

  editStep(stepId: string): void {
    this.goToStep(this.wizardSteps().findIndex((step) => step.id === stepId));
  }

  navigateBack(): void {
    this.router.navigate(['/cluster']);
  }

  canProceedFromCurrentStep(): boolean {
    const step = this.wizardSteps()[this.currentStepIndex()];
    return step?.isValid || false;
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

  getFirewallRulesArray(): FormArray {
    return this.firewallConfigForm.get('rules') as FormArray;
  }

  async detectAndSetIP(ruleIndex: number): Promise<void> {
    const ip = await this.ipDetectionService.detectPublicIP(true);
    if (ip) {
      const ruleControl = this.getFirewallRulesArray().at(ruleIndex);
      const currentValue = ruleControl.get('sourceIps')?.value || '';
      const ipWithCidr = `${ip}/32`;

      if (currentValue.trim()) {
        const cidrs = currentValue.split(',').map((c: string) => c.trim());
        if (!cidrs.includes(ipWithCidr)) {
          ruleControl.patchValue({
            sourceIps: `${currentValue}, ${ipWithCidr}`,
          });
        }
      } else {
        ruleControl.patchValue({ sourceIps: ipWithCidr });
      }
    }
  }

  resetRuleIPs(ruleIndex: number): void {
    const ruleControl = this.getFirewallRulesArray().at(ruleIndex);
    if (ruleControl.get('direction')?.value === 'out') {
      ruleControl.patchValue({ destinationIps: ruleControl.get('originalDestinationIps')?.value });
    } else {
      ruleControl.patchValue({ sourceIps: ruleControl.get('originalSourceIps')?.value });
    }
  }

  /** Append a blank, fully-editable rule the user can shape (e.g. open :6443 to a
   *  specific IP). Defaults to an inbound TCP rule; buildFirewallRules() picks it
   *  up like any other. */
  addCustomRule(): void {
    this.getFirewallRulesArray().push(customRuleGroup(this.fb));
  }

  /** Only user-added custom rules can be removed; the default template rules are
   *  protected (the backend also re-injects 80/443 if omitted). */
  removeRule(ruleIndex: number): void {
    const rulesArray = this.getFirewallRulesArray();
    if (!rulesArray.at(ruleIndex)?.get('isCustom')?.value) return;
    rulesArray.removeAt(ruleIndex);
  }

  /** Swap the required-CIDR validator between source/destination when a custom
   *  rule flips direction, so the field the template hides never blocks submit. */
  onCustomRuleDirectionChange(ruleIndex: number): void {
    applyRuleDirection(this.getFirewallRulesArray().at(ruleIndex));
  }

  getTotalCustomCIDRs(): number {
    if (!this.firewallConfigForm.get('enabled')?.value) {
      return 0;
    }
    return countSourceCidrs(this.getFirewallRulesArray());
  }

  /**
   * Build firewall rules array for CreateClusterDto
   * Validates CIDR and ensures at least one inbound rule
   */
  buildFirewallRules(): Array<FirewallRuleDto> | undefined {
    if (!this.firewallConfigForm.get('enabled')?.value) {
      return undefined;
    }
    return toFirewallRuleDtos(this.getFirewallRulesArray());
  }

  async createCluster(): Promise<void> {
    if (!this.canComplete()) return;

    const serverType = this.getSelectedServerType();
    if (!serverType) return;

    this.isCreating.set(true);
    this.createError.set(null);

    try {
      const configuration = this.buildClusterConfiguration(serverType);
      const result = await this.clusterService.createCluster(configuration);

      if (this.selectedSshKeyId()) {
        await this.updateSshKeyTagsWithClusterId(result.clusterId, this.selectedSshKeyId()!);
      }

      await this.attachSelectedDnsZone(result.clusterId);
      this.navigateAfterCreate(result);

      this.completeOutput.emit({
        success: true,
        cluster: {
          ...configuration,
          id: result.clusterId,
          clusterId: result.clusterId,
          operationId: result.operationId,
        },
      });
    } catch (error: any) {
      console.error('Failed to create cluster:', error);
      const message = this.mapCreateClusterError(error);
      this.createError.set(message);
      this.completeOutput.emit({ success: false, error: message });
    } finally {
      this.isCreating.set(false);
    }
  }

  private buildClusterConfiguration(serverType: { id: string }): ClusterConfiguration {
    const availability = this.availability();
    return {
      name: this.basicConfigForm.get('name')?.value || '',
      provider: this.selectedProvider() as ProviderType,
      region: this.selectedRegion(),
      nodeTypeId: serverType.id,
      minNodes: this.costedNodes(),
      maxNodes: this.costedNodes(),
      highAvailability: this.highlyAvailable()
        ? { shapes: availability.shapes, completeLater: availability.completeLater }
        : undefined,
      sshKeys: this.selectedSshKeyId() ? [this.selectedSshKeyId()!] : [],
      diskSizeGb: this.needsDiskConfig() ? this.diskSizeGb() : undefined,
      firewallRules: this.buildFirewallRules(),
      vnetConfig:
        !this.environmentNetwork() &&
        !this.fluiBuildsNetwork() &&
        this.selectedVNetId() &&
        this.selectedSubnetId()
          ? {
              vnetId: this.selectedVNetId()!,
              subnetId: this.selectedSubnetId()!,
              autoAssignIp: true,
            }
          : undefined,
      fluiManagedNetwork: this.buildFluiManagedNetwork(),
      endpointHostnameMode: this.endpointHostnameMode(),
      sharedStorageEnabled: this.sharedStorageEnabled(),
      sharedStorageVolumeSizeGb: this.sharedStorageEnabled()
        ? this.sharedStorageVolumeSizeGb()
        : undefined,
    };
  }

  private buildFluiManagedNetwork(): ClusterConfiguration['fluiManagedNetwork'] {
    if (!this.fluiBuildsNetwork()) {
      return undefined;
    }
    const ipRange = this.fluiNetworkCidr().trim();
    return ipRange ? { ipRange } : {};
  }

  private navigateAfterCreate(result: { operationId?: string; clusterId?: string }): void {
    if (result.operationId) {
      this.router.navigate(['/cluster/create', result.operationId]);
    } else if (result.clusterId) {
      this.router.navigate(['/cluster', result.clusterId]);
    } else {
      this.router.navigate(['/cluster']);
    }
  }

  private async attachSelectedDnsZone(clusterId: string): Promise<void> {
    if (this.endpointHostnameMode() !== 'domain') return;
    const zoneId = this.selectedDnsZoneId();
    if (!zoneId || !clusterId) return;

    const assigned = await this.clusterDnsZoneService.assignZone(clusterId, { dnsZoneId: zoneId });
    if (!assigned) {
      console.error(
        'Cluster created but DNS zone assignment failed:',
        this.clusterDnsZoneService.error(),
      );
    }
  }

  private mapCreateClusterError(error: any): string {
    return createClusterErrorMessage(error);
  }

  private async updateSshKeyTagsWithClusterId(clusterId: string, keyId: string): Promise<void> {
    try {
      const existingKey = this.getSshKeyById(keyId);
      if (!existingKey) return;

      const updatedTags = tagsWithClusterId(
        existingKey.tags as Record<string, unknown> | undefined,
        clusterId,
      );

      await firstValueFrom(
        this.accessManagementService.accessControllerUpdateSSHKey(keyId, {
          tags: updatedTags,
        }),
      );
    } catch {
      return;
    }
  }
}
