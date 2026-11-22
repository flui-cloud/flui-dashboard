import {
  Component,
  inject,
  input,
  output,
  signal,
  OnChanges,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideWand2, lucideX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { ChoiceOption, EndpointChoiceGroup } from './endpoint-choice-group';
import {
  challengeOptions,
  hostnameOptions,
  internalTypeTooltip,
  typeOptions,
} from './endpoint-form-options';
import { EndpointCertificateOptions } from './endpoint-certificate-options';
import {
  CertChallenge,
  DnsCheckResult,
  EndpointFormState,
  EndpointType,
  HostnameMode,
  InternalHostingMissing,
  SubmitContext,
  buildCreateDto,
  buildUpdateDto,
  dnsMismatchLabel,
  emptyEndpointForm,
  formFromEndpoint,
  internalHostingMissingLabel,
  ipFqdn,
  isEndpointFormValid,
  validateFqdn,
  validateSubdomain,
  zoneMatchingFqdn,
} from './endpoint-form-model';

export interface AppOption {
  id: string;
  name: string;
  slug: string;
  isInternal?: boolean;
}

@Component({
  selector: 'app-cluster-endpoint-form',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    FlAlert,
    FlCopyId,
    FlField,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    EndpointChoiceGroup,
    EndpointCertificateOptions,
  ],
  providers: [provideIcons({ lucidePencil, lucideWand2, lucideX })],
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cluster-endpoint-form.component.html',
})
export class ClusterEndpointFormComponent implements OnChanges {
  clusterId = input.required<string>();
  assignments = input<ClusterDnsZoneResponseDto[]>([]);
  endpoint = input<AppEndpointResponseDto | undefined>(undefined);
  /** When provided, a select is shown to pick the target application. */
  applications = input<AppOption[]>([]);
  /** Pre-set applicationId — used when the form is opened from the app context. */
  fixedApplicationId = input<string>('');
  /** Pre-set slug used to suggest the FQDN placeholder. */
  fixedAppSlug = input<string>('');
  /** Master IP of the cluster — shown in BYOD mode so the user knows where to point the A record. */
  masterIp = input<string>('');
  /** Whether at least one certificate issuer is ready on this cluster. */
  issuersReady = input<boolean>(true);
  /** Whether a DNS-01-capable (wildcard) issuer is Ready in cert-manager. Gates the Wildcard option. */
  wildcardIssuersReady = input<boolean>(false);
  /** Initial endpoint type when creating — `internal` if the app is private, `public` otherwise. Ignored in edit mode. */
  defaultEndpointType = input<EndpointType>('public');
  /** True when the cluster supports internal hosting (DNS zone + wildcard issuer). Gates the "Internal" option. */
  internalHostingAvailable = input<boolean>(false);
  /** Granular list of missing prerequisites when internalHostingAvailable=false. */
  internalHostingMissing = input<readonly InternalHostingMissing[]>([]);
  /** True when the Flui Auth Proxy is installed and running on the cluster — required for internal endpoints. */
  authzReady = input<boolean>(false);
  /** True while an Auth Proxy install request is in flight. */
  authzInstalling = input<boolean>(false);

  save = output<
    { clusterId: string; dto: CreateAppEndpointDto } | { id: string; dto: UpdateAppEndpointDto }
  >();
  cancelled = output<void>();
  configureIssuers = output<void>();
  /** Fired when the user clicks "Configure wildcard issuers" on the DNS-01 missing banner. */
  configureWildcardIssuers = output<void>();
  /** Fired when the user clicks "Configure now" on the missing-prereqs banner. */
  configureInternalHosting = output<void>();
  /** Fired when the user clicks "Install Auth Proxy". */
  installAuthz = output<void>();

  private readonly dnsZonesApi = inject(DNSZonesService);
  private readonly appConfig = inject(AppConfigService);
  private dnsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected certificateMode = this.appConfig.certificateMode;
  protected startsInStaging =
    this.certificateMode === 'staging' || this.certificateMode === 'preflight';

  protected byodOverride = signal(false);
  protected selectedZoneId = signal('');
  protected assignment = computed(() => this.assignments()[0] ?? null);
  protected selectedAssignment = computed(
    () => this.assignments().find((a) => a.id === this.selectedZoneId()) ?? this.assignment(),
  );
  protected effectiveAssignment = computed(() =>
    this.byodOverride() ? null : this.selectedAssignment(),
  );

  protected form: EndpointFormState = this.emptyForm();
  protected fqdnError = signal<string | null>(null);
  protected subdomainError = signal<string | null>(null);
  protected ipSlugError = signal<string | null>(null);
  protected ipSlugEditing = signal(false);
  protected dnsChecking = signal(false);
  protected dnsResult = signal<DnsCheckResult | null>(null);
  protected promoteToProd = signal(false);

  protected selectedAppId = signal<string>('');

  protected endpointType = signal<EndpointType>('public');

  protected isInternal = computed(() => this.endpointType() === 'internal');

  protected internalAvailable = computed(
    () => this.internalHostingAvailable() && this.authzReady(),
  );

  protected internalHostingMissingLabel = computed(() =>
    internalHostingMissingLabel(this.internalHostingMissing()),
  );

  protected internalTypeTooltip = computed(() =>
    internalTypeTooltip({
      locked: this.isEditMode() && this.endpointType() !== 'internal',
      hostingAvailable: this.internalHostingAvailable(),
      missingLabel: this.internalHostingMissingLabel(),
      authzReady: this.authzReady(),
    }),
  );

  protected typeOptions = computed(() =>
    typeOptions({
      editMode: this.isEditMode(),
      internalSelected: this.endpointType() === 'internal',
      internalAvailable: this.internalAvailable(),
      internalTooltip: this.internalTypeTooltip(),
    }),
  );

  protected hostnameOptions(): ChoiceOption<HostnameMode>[] {
    return hostnameOptions(this.masterIp(), !!this.effectiveAssignment());
  }

  protected challengeOptions(): ChoiceOption<CertChallenge>[] {
    return challengeOptions(this.canUseDns01(), this.wildcardButtonTooltip());
  }

  protected onEndpointTypeChange(t: EndpointType): void {
    if (this.isEditMode()) return;
    if (t === 'internal' && !this.internalAvailable()) return;
    this.endpointType.set(t);
    if (t === 'internal') {
      this.form.hostnameMode = 'domain';
      this.form.certificateRequired = true;
    }
  }

  protected zoneSuffix = computed(() => {
    const zone = this.effectiveAssignment();
    if (!zone) return '';
    return this.isInternal() ? `internal.${zone.dnsZone.zoneName}` : zone.dnsZone.zoneName;
  });

  protected canUseDns01 = computed(() => {
    const zone = this.effectiveAssignment();
    return !!zone && !!zone.wildcardCertificate && this.wildcardIssuersReady();
  });

  protected wildcardIssuersMissing = computed(() => {
    const zone = this.effectiveAssignment();
    return !!zone && !!zone.wildcardCertificate && !this.wildcardIssuersReady();
  });

  protected ipDashed = computed(() => this.masterIp().replaceAll('.', '-'));

  protected effectiveIpSlug = computed(() => {
    const override = this.form.ipSlugOverride.trim();
    return override || this.currentSlug() || 'app';
  });

  protected ipFqdnPreview = computed(() => {
    const ip = this.masterIp();
    return ip ? ipFqdn(this.effectiveIpSlug(), ip) : '';
  });

  protected byodToggleLabel(): string {
    if (!this.byodOverride()) return 'Use a different domain';
    if (this.assignments().length > 1) return 'Use a cluster zone';
    return `Use the cluster zone (${this.assignment()?.dnsZone.zoneName ?? ''})`;
  }

  protected dnsMismatch(result: DnsCheckResult): string {
    return dnsMismatchLabel(result, this.masterIp());
  }

  protected onHostnameModeChange(mode: HostnameMode): void {
    this.form.hostnameMode = mode;
    if (mode === 'ip') this.form.certChallenge = 'http-01';
  }

  protected onCertChallengeChange(c: CertChallenge): void {
    if (c === 'dns-01' && !this.canUseDns01()) return;
    this.form.certChallenge = c;
  }

  protected wildcardButtonTooltip(): string {
    if (this.canUseDns01()) return '';
    if (this.wildcardIssuersMissing()) {
      return 'Wildcard issuers are not configured on this cluster yet';
    }
    return 'Available when a managed DNS zone with wildcard support is configured';
  }

  protected isEditMode = computed(() => !!this.endpoint());
  protected isStagingCert = computed(
    () => this.endpoint()?.certificateProvider === 'lets_encrypt_staging',
  );
  protected isProdCert = computed(() => this.endpoint()?.certificateProvider === 'lets_encrypt');
  protected stagingCertValid = computed(
    () => this.isStagingCert() && this.endpoint()?.certificateStatus === 'valid',
  );

  protected fqdnPlaceholder = computed(() => {
    const zone = this.effectiveAssignment();
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    if (slug && zone) return `${slug}.${this.zoneSuffix()}`;
    if (slug) return `${slug}.example.com`;
    return 'app.example.com';
  });

  protected subdomainPlaceholder = computed(() => {
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    return slug || 'api';
  });

  protected selectedAppName = computed(() => {
    const id = this.form.applicationId;
    return this.applications().find((a) => a.id === id)?.name ?? id;
  });

  private slugFromSelect(): string {
    return this.applications().find((a) => a.id === this.form.applicationId)?.slug ?? '';
  }

  protected currentSlug = computed(() => {
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    return slug.replaceAll('_', '-').toLowerCase();
  });

  protected toggleByodOverride(): void {
    const next = !this.byodOverride();
    this.byodOverride.set(next);
    this.form.fqdn = '';
    this.form.subdomainPrefix = '';
    this.fqdnError.set(null);
    this.subdomainError.set(null);
    this.dnsResult.set(null);
    this.dnsChecking.set(false);
    if (next && this.form.certChallenge === 'dns-01') {
      this.form.certChallenge = 'http-01';
    }
    if (!next) this.prefillZoneFromExistingFqdn();
  }

  private prefillZoneFromExistingFqdn(): void {
    const fqdn = (this.endpoint()?.fqdn ?? '').toLowerCase();
    const match = zoneMatchingFqdn(fqdn, this.assignments());
    if (!match) return;
    this.selectedZoneId.set(match.id);
    const zn = match.dnsZone.zoneName;
    this.form.subdomainPrefix = fqdn === zn ? '' : fqdn.slice(0, fqdn.length - zn.length - 1);
  }

  protected onZoneSelect(zoneId: string): void {
    this.selectedZoneId.set(zoneId);
    if (this.form.certChallenge === 'dns-01' && !this.canUseDns01()) {
      this.form.certChallenge = 'http-01';
    }
  }

  protected autoGenerate(): void {
    const slug = this.currentSlug();
    if (!slug) return;
    if (this.effectiveAssignment()) {
      this.form.subdomainPrefix = slug;
      this.onSubdomainChange();
    } else {
      this.form.fqdn = `${slug}.example.com`;
      this.onFqdnChange();
    }
  }

  ngOnChanges(): void {
    const ep = this.endpoint();
    if (ep) {
      this.applyExistingEndpoint(ep);
    } else {
      this.applyNewEndpointDefaults();
    }
    this.promoteToProd.set(false);
    this.fqdnError.set(null);
    this.subdomainError.set(null);
    this.ipSlugError.set(null);
    this.ipSlugEditing.set(false);
    this.dnsResult.set(null);
    this.dnsChecking.set(false);
    if (this.dnsDebounceTimer) clearTimeout(this.dnsDebounceTimer);
  }

  private applyExistingEndpoint(ep: AppEndpointResponseDto): void {
    this.selectedAppId.set(ep.applicationId ?? this.fixedApplicationId());
    this.endpointType.set((ep.endpointType as EndpointType) ?? 'public');
    this.byodOverride.set(this.assignments().length > 0 && !ep.clusterDnsZoneId);
    this.selectedZoneId.set(ep.clusterDnsZoneId ?? '');
    this.form = formFromEndpoint(ep, {
      zone: this.effectiveAssignment(),
      zoneSuffix: this.zoneSuffix(),
      fallbackApplicationId: this.fixedApplicationId(),
      masterIp: this.masterIp(),
    });
  }

  private applyNewEndpointDefaults(): void {
    this.selectedAppId.set(this.fixedApplicationId());
    this.byodOverride.set(false);
    this.selectedZoneId.set('');
    const wanted = this.defaultEndpointType();
    this.endpointType.set(
      wanted === 'internal' && this.internalAvailable() ? 'internal' : 'public',
    );
    this.form = this.emptyForm();
    if (this.endpointType() === 'internal') {
      this.form.hostnameMode = 'domain';
      this.form.certificateRequired = true;
    }
  }

  protected onFqdnChange(): void {
    const v = this.form.fqdn.trim();
    if (!v) {
      this.fqdnError.set(null);
      this.dnsResult.set(null);
      this.dnsChecking.set(false);
      return;
    }
    this.fqdnError.set(validateFqdn(v));
    if (this.dnsDebounceTimer) clearTimeout(this.dnsDebounceTimer);
    const ip = this.masterIp();
    if (!this.effectiveAssignment() && ip && !this.fqdnError()) {
      this.dnsResult.set(null);
      this.dnsChecking.set(true);
      this.dnsDebounceTimer = setTimeout(() => this.runDnsCheck(v, ip), 600);
    } else {
      this.dnsResult.set(null);
      this.dnsChecking.set(false);
    }
  }

  private async runDnsCheck(hostname: string, expectedIp: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.dnsZonesApi.dnsZoneControllerVerifyDns(hostname, expectedIp),
      );
      this.dnsResult.set({ ok: res.matches, resolvedAddresses: res.resolvedAddresses });
    } catch {
      this.dnsResult.set({ ok: false, resolvedAddresses: [] });
    } finally {
      this.dnsChecking.set(false);
    }
  }

  protected onAppChange(appId: string): void {
    this.selectedAppId.set(appId);
    const zone = this.effectiveAssignment();
    const slug = this.applications().find((a) => a.id === appId)?.slug ?? '';
    if (zone) {
      if (!this.form.subdomainPrefix && slug) this.form.subdomainPrefix = slug;
    } else if (!this.form.fqdn && slug) {
      this.form.fqdn = `${slug}.example.com`;
    }
  }

  protected onSubdomainChange(): void {
    const v = this.form.subdomainPrefix.trim();
    this.subdomainError.set(v ? validateSubdomain(v) : null);
  }

  protected onIpSlugChange(): void {
    const v = this.form.ipSlugOverride.trim();
    this.ipSlugError.set(v ? validateSubdomain(v) : null);
  }

  protected isValid(): boolean {
    return isEndpointFormValid({
      form: this.form,
      hasApp: !!this.fixedApplicationId() || !!this.form.applicationId,
      internal: this.endpointType() === 'internal',
      primaryZone: this.assignment(),
      zone: this.effectiveAssignment(),
      masterIp: this.masterIp(),
      gatesOk: this.isEditMode() || this.internalAvailable(),
      canUseDns01: this.canUseDns01(),
      issuersReady: this.issuersReady(),
      errors: {
        fqdn: this.fqdnError(),
        subdomain: this.subdomainError(),
        ipSlug: this.ipSlugError(),
      },
    });
  }

  protected submit(): void {
    if (!this.isValid()) return;
    const ep = this.endpoint();

    if (ep) {
      this.save.emit({ id: ep.id, dto: buildUpdateDto(this.submitContext(), ep) });
    } else if (this.endpointType() === 'internal') {
      const dto: CreateAppEndpointDto = {
        applicationId: this.fixedApplicationId() || this.form.applicationId,
        endpointType: 'internal' as CreateAppEndpointDto.EndpointTypeEnum,
      };
      this.save.emit({ clusterId: this.clusterId(), dto });
    } else {
      this.save.emit({ clusterId: this.clusterId(), dto: buildCreateDto(this.submitContext()) });
    }
  }

  private submitContext(): SubmitContext {
    return {
      form: this.form,
      applicationId: this.fixedApplicationId() || this.form.applicationId,
      masterIp: this.masterIp(),
      zone: this.effectiveAssignment(),
      zoneSuffix: this.zoneSuffix(),
      promoteToProd: this.promoteToProd(),
    };
  }

  private emptyForm(): EndpointFormState {
    return emptyEndpointForm(
      this.effectiveAssignment(),
      this.wildcardIssuersReady(),
      this.startsInStaging,
    );
  }
}
