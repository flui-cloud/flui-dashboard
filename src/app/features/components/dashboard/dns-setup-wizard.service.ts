import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DnsZonesService } from '../../service/dns-zones.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { AssignDnsZoneDto } from '../../../core/api/model/assignDnsZoneDto';
import { ConfigureIssuerDto } from '../../../core/api/model/configureIssuerDto';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { CreateDnsZoneDto } from '../../../core/api/model/createDnsZoneDto';
import { SyncApiDomainDto } from '../../../core/api/model/syncApiDomainDto';
import { SyncAuthDomainDto } from '../../../core/api/model/syncAuthDomainDto';
import { SyncWebDomainDto } from '../../../core/api/model/syncWebDomainDto';
import { ClusterDNSZoneService as ClusterDNSZoneApiService } from '../../../core/api/api/clusterDNSZone.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { SANCertificatesService } from '../../../core/api/api/sANCertificates.service';
import { CreateSanCertificateDto } from '../../../core/api/model/createSanCertificateDto';
import { ApplicationResponseDto } from '../../../core/api/model/applicationResponseDto';
import { SystemDnsStatusResponseDto } from '../../../core/api/model/systemDnsStatusResponseDto';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';
import { AppConfigService } from '../../../core/services/app-config.service';

export type WizardStep = 'mode' | 'zone' | 'issuer' | 'endpoints-config' | 'endpoints' | 'done';
export type CertMode = 'wildcard' | 'direct';
export type EndpointPhase = 'idle' | 'configuring' | 'polling' | 'done' | 'error';

export type AppEndpointPhase =
  | 'idle'
  | 'creating-endpoint'
  | 'checking-dns'
  | 'reconciling'
  | 'issuing-cert'
  | 'upgrading-to-prod'
  | 'issuing-prod-cert'
  | 'syncing-auth'
  | 'rollout-auth'
  | 'syncing-api'
  | 'rollout-api'
  | 'syncing-web'
  | 'rollout-web'
  | 'done'
  | 'error';

export interface AppEndpointStatus {
  key: string;
  label: string;
  fqdn: string;
  applicationId: string | null;
  endpointId: string | null;
  status: 'pending' | 'running' | 'done' | 'error';
  phase: AppEndpointPhase;
  rolloutProgress: number | null;
  dnsCheckStatus: 'pending' | 'checking' | 'ok' | 'failed';
  dnsResolvedAddresses: string[];
  certStatus: 'pending' | 'issuing' | 'valid' | 'expired' | 'failed' | null;
  certMessage: string | null;
  ingressConfigured: boolean;
  errorMessage: string | null;
}

export interface DirectEndpointRow {
  key: string;
  label: string;
  slug: string;
  applicationId: string | null;
  endpoint: AppEndpointResponseDto | null;
  /** Draft state — FQDN/mode set by the user in the inline form, applied in batch
   *  by `runEndpointSetup` (one SAN cert + N endpoints). */
  draftFqdn: string;
  draftHostnameMode: 'ip' | 'domain';
  /** For nip.io: the editable subdomain prefix that prepends `.<masterIp>.nip.io`. */
  draftPrefix: string;
  /** True once the user has committed the draft (clicked Save in the inline form). */
  configured: boolean;
  saving: boolean;
  error: string | null;
}

const WILDCARD_STEPS: WizardStep[] = ['mode', 'zone', 'issuer', 'endpoints', 'done'];
const DIRECT_STEPS: WizardStep[] = ['mode', 'issuer', 'endpoints-config', 'endpoints', 'done'];

@Injectable()
export class DnsSetupWizardService {
  readonly dnsZonesService = inject(DnsZonesService);
  readonly clusterDnsZoneService = inject(ClusterDnsZoneService);
  readonly appEndpointsService = inject(AppEndpointsService);
  private readonly dnsZonesApi = inject(DNSZonesService);
  private readonly clusterDNSZoneApi = inject(ClusterDNSZoneApiService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly appRuntimeWs = inject(AppRuntimeWebSocketService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly sanCertsApi = inject(SANCertificatesService);
  private readonly appConfig = inject(AppConfigService);

  /** SAN certificate created at the start of the direct-mode batch. Reused for
   *  every endpoint in the same wizard run so all system services share one cert. */
  private readonly batchSanCertificateId = signal<string | null>(null);

  /** When true, the initial cert is Let's Encrypt staging (modes: staging, preflight). */
  private get startsInStaging(): boolean {
    const mode = this.appConfig.certificateMode;
    return mode === 'staging' || mode === 'preflight';
  }
  /** When true, auto-upgrade to production once staging certs are valid (mode: preflight). */
  private get autoUpgradeAfterStaging(): boolean {
    return this.appConfig.certificateMode === 'preflight';
  }

  // ── Navigation ──────────────────────────────────────────────────────
  readonly steps = computed<WizardStep[]>(() =>
    this.certMode() === 'direct' ? DIRECT_STEPS : WILDCARD_STEPS
  );
  readonly totalSteps = computed(() => this.steps().length);
  private readonly stepIndexData = signal(0);
  readonly stepIndex = this.stepIndexData.asReadonly();
  readonly currentStep = computed(() => this.steps()[this.stepIndexData()]);

  // ── Step 1: Mode ────────────────────────────────────────────────────
  readonly certMode = signal<CertMode>('wildcard');

  // ── Step 2: Zone ────────────────────────────────────────────────────
  selectedZoneId = '';
  acmeEmail = '';
  readonly existingZone = signal<ClusterDnsZoneResponseDto | null>(null);
  readonly loadingExisting = signal(true);
  readonly zoneRegPhase = signal<'idle' | 'loading' | 'select' | 'registering' | 'done' | 'error'>('idle');
  readonly zoneRegProviders = signal<string[]>([]);
  readonly zoneRegSelectedProvider = signal('');
  readonly zoneRegProviderZones = signal<{ zoneId: string; name: string }[]>([]);
  readonly zoneRegSelectedZoneId = signal('');
  readonly zoneRegEmail = signal('');
  readonly zoneRegError = signal<string | null>(null);
  readonly zoneRegLoadingZones = signal(false);

  // ── Step 3: Issuer ──────────────────────────────────────────────────
  readonly issuerPhase = signal<'idle' | 'zone' | 'staging' | 'prod' | 'verifying' | 'done' | 'error'>('idle');
  private readonly issuerStatuses = signal<{ name?: string; ready?: boolean; message?: string | null }[]>([]);
  private readonly existingIssuers = signal<{ name?: string; ready?: boolean }[]>([]);
  readonly setupError = signal<string | null>(null);
  readonly saving = signal(false);
  // Direct mode: email input before issuer config; existingHttpIssuerEmail = already configured
  readonly directAcmeEmail = signal('');
  readonly existingHttpIssuerEmail = signal<string | null>(null);
  readonly loadingHttpIssuer = signal(false);

  // ── Step 4 (direct only): Endpoint configuration ─────────────────────
  readonly directEndpoints = signal<DirectEndpointRow[]>([]);
  readonly loadingDirectConfig = signal(false);
  readonly masterIp = signal<string>('');

  // ── Step 4/5: Run progress ───────────────────────────────────────────
  readonly endpointPhase = signal<EndpointPhase>('idle');
  readonly endpointError = signal<string | null>(null);
  private readonly appEndpointsDataSignal = signal<AppEndpointStatus[]>([]);
  readonly appEndpoints = this.appEndpointsDataSignal.asReadonly();
  readonly activeAppError = signal<{ label: string; certMessage: string | null; errorMessage: string | null } | null>(null);
  readonly appErrorCopied = signal(false);
  /** True when the wizard has switched the OIDC issuer and the user needs to re-login. */
  readonly requiresRelogin = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────
  readonly hasFailedEndpoint = computed(() =>
    this.appEndpointsDataSignal().some(a => a.status === 'error')
  );

  readonly setupPhases = computed(() => {
    const phase = this.issuerPhase();
    const direct = this.certMode() === 'direct';
    const statuses = this.issuerStatuses();
    const phaseOrder = ['zone', 'staging', 'prod', 'verifying'] as const;

    const statusOf = (key: 'zone' | 'staging' | 'prod' | 'verifying'): 'pending' | 'running' | 'done' | 'error' | 'skipped' => {
      if (direct && (key === 'staging' || key === 'prod')) return 'skipped';
      const keyIdx = phaseOrder.indexOf(key);
      const activeIdx = phaseOrder.indexOf(phase as typeof phaseOrder[number]);
      if (phase === 'done') return 'done';
      if (phase === 'error') {
        if (keyIdx < activeIdx) return 'done';
        if (keyIdx === activeIdx) return 'error';
        return 'pending';
      }
      if (activeIdx === -1) return 'pending';
      if (keyIdx < activeIdx) return 'done';
      if (keyIdx === activeIdx) return 'running';
      return 'pending';
    };

    const verifyingStatus = direct ? 'skipped' as const : statusOf('verifying');
    const notReadyIssuer = statuses.find(i => !i.ready && i.message);

    return [
      { key: 'zone',      label: 'Assign DNS zone',                status: statusOf('zone'),    active: phase === 'zone',      issuerMessage: undefined as string | undefined },
      { key: 'staging',   label: 'Configure test issuer (staging)', status: statusOf('staging'), active: phase === 'staging',   issuerMessage: undefined as string | undefined },
      { key: 'prod',      label: 'Configure production issuer',     status: statusOf('prod'),    active: phase === 'prod',      issuerMessage: undefined as string | undefined },
{ key: 'verifying', label: 'Verify issuers are ready',        status: verifyingStatus,     active: phase === 'verifying', issuerMessage: phase === 'verifying' && notReadyIssuer ? (notReadyIssuer.message ?? undefined) : undefined },
    ];
  });

  readonly isAutoRunning = computed(() => {
    const ip = this.issuerPhase();
    const ep = this.endpointPhase();
    return (ip !== 'idle' && ip !== 'done' && ip !== 'error') ||
           (ep === 'configuring' || ep === 'polling');
  });

  readonly canProceed = computed(() => {
    switch (this.currentStep()) {
      case 'mode': return true;
      case 'zone': {
        if (this.dnsZonesService.zones().length === 0) {
          const phase = this.zoneRegPhase();
          if (phase === 'done') return true;
          return !!this.zoneRegSelectedZoneId() && !!this.zoneRegEmail()
            && phase !== 'registering' && phase !== 'loading';
        }
        return !!this.selectedZoneId && !!this.acmeEmail;
      }
      case 'issuer': {
        if (this.certMode() === 'direct') {
          const phase = this.issuerPhase();
          if (phase === 'done') return true;
          // Allow clicking Next to trigger setup when email is ready but not yet submitted
          if (phase === 'idle' || phase === 'error') {
            return !!this.existingHttpIssuerEmail() || !!this.directAcmeEmail().trim();
          }
          return false; // configuring in progress
        }
        return this.issuerPhase() === 'done';
      }
      case 'endpoints-config': {
        const rows = this.directEndpoints();
        if (rows.length === 0) return false;
        return rows.every(r => {
          if (!r.configured) return false;
          if (r.draftHostnameMode === 'ip') return !!r.draftPrefix.trim() && !!this.masterIp();
          return !!r.draftFqdn.trim();
        });
      }
      case 'endpoints':        return this.endpointPhase() === 'done' && !this.hasFailedEndpoint();
      case 'done':             return true;
    }
  });

  // ── Navigation helpers ───────────────────────────────────────────────
  advance(): void {
    if (this.stepIndexData() < this.steps().length - 1) {
      this.stepIndexData.update(i => i + 1);
    }
  }

  back(): void {
    if (this.stepIndexData() > 0) {
      this.stepIndexData.update(i => i - 1);
    }
  }

  selectedZoneName(): string {
    const zone = this.dnsZonesService.zones().find(z => z.id === this.selectedZoneId);
    return zone?.zoneName ?? '';
  }

  // ── Init ─────────────────────────────────────────────────────────────
  async init(clusterId: string | null): Promise<void> {
    await Promise.all([
      this.dnsZonesService.zones().length === 0 ? this.dnsZonesService.loadZones() : Promise.resolve(),
      clusterId ? this.loadExistingConfig(clusterId) : Promise.resolve(),
    ]);
    this.loadingExisting.set(false);

    if (this.dnsZonesService.zones().length === 0) {
      await this.initZoneRegistration();
    }
  }

  private async loadExistingConfig(clusterId: string): Promise<void> {
    try {
      await this.clusterDnsZoneService.loadAssignment(clusterId);
      const assignment = this.clusterDnsZoneService.assignment();
      if (assignment) {
        this.existingZone.set(assignment);
        this.selectedZoneId = assignment.dnsZoneId;
        this.acmeEmail = assignment.acmeEmail ?? '';
        this.certMode.set(assignment.wildcardCertificate ? 'wildcard' : 'direct');
      }
    } catch { /* no assignment */ }

    try {
      const issuers = await this.clusterDnsZoneService.getIssuers(clusterId);
      this.existingIssuers.set(issuers);
      this.issuerStatuses.set(issuers);
    } catch { /* no issuers */ }
  }

  // ── Step 2: Inline zone registration ────────────────────────────────
  private async initZoneRegistration(): Promise<void> {
    this.zoneRegPhase.set('loading');
    this.zoneRegError.set(null);
    try {
      await Promise.all([
        this.dnsZonesService.loadProviders(),
        this.dnsZonesService.loadDnsCapableProviders(),
      ]);
      const providers = this.dnsZonesService.providers();
      this.zoneRegProviders.set(providers);
      if (providers.length === 0) {
        this.zoneRegPhase.set('error');
        this.zoneRegError.set('No DNS provider configured. Set one up first in the DNS section.');
        return;
      }
      const first = providers[0];
      this.zoneRegSelectedProvider.set(first);
      await this.loadZoneRegProviderZones(first);
    } catch {
      this.zoneRegPhase.set('error');
      this.zoneRegError.set('Could not load DNS providers.');
    }
  }

  private async loadZoneRegProviderZones(provider: string): Promise<void> {
    this.zoneRegLoadingZones.set(true);
    this.zoneRegError.set(null);
    try {
      await this.dnsZonesService.loadProviderZones(provider);
      this.zoneRegProviderZones.set(this.dnsZonesService.providerZones());
      this.zoneRegPhase.set('select');
    } catch {
      this.zoneRegPhase.set('error');
      this.zoneRegError.set(`Could not load zones from ${provider}.`);
    } finally {
      this.zoneRegLoadingZones.set(false);
    }
  }

  async onZoneRegProviderChange(provider: string): Promise<void> {
    this.zoneRegSelectedProvider.set(provider);
    this.zoneRegSelectedZoneId.set('');
    await this.loadZoneRegProviderZones(provider);
  }

  async registerZoneInline(): Promise<void> {
    const zoneId = this.zoneRegSelectedZoneId();
    const provider = this.zoneRegSelectedProvider();
    const email = this.zoneRegEmail();
    if (!zoneId || !provider || !email) return;

    const zone = this.zoneRegProviderZones().find(z => z.zoneId === zoneId);
    if (!zone) return;

    this.zoneRegPhase.set('registering');
    this.zoneRegError.set(null);

    const dto: CreateDnsZoneDto = {
      providerZoneId: zoneId,
      zoneName: zone.name,
      dnsProvider: provider as CreateDnsZoneDto.DnsProviderEnum,
    };

    const result = await this.dnsZonesService.registerZone(dto);
    if (result) {
      this.selectedZoneId = result.id;
      this.acmeEmail = email;
      this.zoneRegPhase.set('done');
    } else {
      this.zoneRegPhase.set('error');
      this.zoneRegError.set(this.dnsZonesService.error() ?? 'Failed to register zone.');
    }
  }

  // ── Step 3: Issuer setup ─────────────────────────────────────────────

  /** Load existing HTTP-01 issuer email for direct mode (called on entering issuer step) */
  async loadHttpIssuer(clusterId: string): Promise<void> {
    this.loadingHttpIssuer.set(true);
    try {
      const issuers = await this.clusterDnsZoneService.getIssuers(clusterId);
      const { SolverTypeEnum } = ClusterDnsZoneControllerGetIssuers200ResponseInner;
      const http = issuers.find(i =>
        i.solverType === SolverTypeEnum.Http01 || i.solverType === SolverTypeEnum.Combined
      );
      if (http?.email) {
        this.existingHttpIssuerEmail.set(http.email);
        this.issuerPhase.set('done');
      }
    } catch { /* no issuer yet, user must enter email */ }
    finally { this.loadingHttpIssuer.set(false); }
  }

  async runSetup(clusterId: string): Promise<void> {
    this.setupError.set(null);
    const isDirect = this.certMode() === 'direct';

    if (isDirect) {
      const email = this.existingHttpIssuerEmail() ?? this.directAcmeEmail().trim();
      this.issuerPhase.set('prod');
      const issuerDto: ConfigureIssuerDto = { acmeEmail: email };
      const ok = await this.clusterDnsZoneService.configureIssuerByType(clusterId, 'http', issuerDto);
      if (!ok) {
        this.issuerPhase.set('error');
        this.setupError.set(this.clusterDnsZoneService.error() ?? 'Failed to configure HTTP-01 issuer');
        return;
      }
      this.issuerPhase.set('done');
      return;
    }

    this.issuerPhase.set('zone');

    const hasZone = !!this.existingZone() && this.existingZone()!.dnsZoneId === this.selectedZoneId;
    if (!hasZone) {
      const dto: AssignDnsZoneDto = {
        dnsZoneId: this.selectedZoneId,
        acmeEmail: this.acmeEmail,
        wildcardCertificate: true,
      };
      const zoneOk = await this.clusterDnsZoneService.assignZone(clusterId, dto);
      if (!zoneOk) {
        this.issuerPhase.set('error');
        this.setupError.set(this.clusterDnsZoneService.error() ?? 'Failed to assign DNS zone');
        return;
      }
    }

    // Always (re)apply secret and issuers — both calls are idempotent
    this.issuerPhase.set('staging');
    const issuerDto: ConfigureIssuerDto = { acmeEmail: this.acmeEmail };

    const secretOk = await this.clusterDnsZoneService.configureDnsSecret(clusterId);
    if (!secretOk) {
      this.issuerPhase.set('error');
      this.setupError.set(this.clusterDnsZoneService.error() ?? 'Failed to configure DNS secret');
      return;
    }

    this.issuerPhase.set('prod');
    const issuersOk = await this.clusterDnsZoneService.configureDnsIssuers(clusterId, issuerDto);
    if (!issuersOk) {
      this.issuerPhase.set('error');
      this.setupError.set(this.clusterDnsZoneService.error() ?? 'Failed to configure wildcard issuers');
      return;
    }

    this.issuerPhase.set('verifying');
    await this.pollUntilReady(clusterId);
  }

  private async pollUntilReady(clusterId: string): Promise<void> {
    const INTERVAL_MS = 4000;
    const TIMEOUT_MS = 120_000;
    const start = Date.now();

    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));
      try {
        const issuers = await this.clusterDnsZoneService.getIssuers(clusterId);
        this.issuerStatuses.set(issuers);
        if (issuers.length > 0 && issuers.every(i => i.ready === true)) {
          this.issuerPhase.set('done');
          return;
        }
      } catch { /* transient */ }
    }

    this.issuerPhase.set('done');
    this.setupError.set('Issuers are taking longer than expected to become ready. You can continue — they will activate in the background.');
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Maps system-status keys to slugs used by the applications API */
  private readonly STATUS_KEY_TO_SLUG: Record<keyof SystemDnsStatusResponseDto, string> = {
    fluiApi: 'flui-api',
    fluiWeb: 'flui-web',
    zitadel: 'zitadel',
  };

  /**
   * Builds a canonical list of system apps from the two API responses.
   * system-status is the source of truth for which apps exist (zitadel=null → excluded).
   * clusterApps provides the display name.
   */
  private buildSystemAppDefs(
    systemStatus: SystemDnsStatusResponseDto,
    clusterApps: ApplicationResponseDto[],
  ): Array<{ key: string; label: string; slug: string; applicationId: string }> {
    const result: Array<{ key: string; label: string; slug: string; applicationId: string }> = [];
    for (const [statusKey, slug] of Object.entries(this.STATUS_KEY_TO_SLUG) as Array<[keyof SystemDnsStatusResponseDto, string]>) {
      const entry = systemStatus[statusKey];
      if (!entry?.applicationId) continue; // null or missing → app not present
      const app = clusterApps.find(a => a.id === entry.applicationId);
      result.push({
        key: slug,
        label: app?.name ?? slug,
        slug,
        applicationId: entry.applicationId,
      });
    }
    return result;
  }

  // ── Step 4 (direct only): Endpoint configuration ─────────────────────
  async loadDirectConfig(clusterId: string): Promise<void> {
    this.loadingDirectConfig.set(true);
    try {
      const [systemStatus, clusterApps, cluster] = await Promise.all([
        firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerGetSystemDnsStatus(clusterId)),
        firstValueFrom(this.applicationsApi.applicationsControllerListByCluster(clusterId, undefined, undefined, undefined, 'system')),
        firstValueFrom(this.clustersApi.clustersControllerGetCluster(clusterId)),
      ]);
      await this.appEndpointsService.loadEndpoints(clusterId);

      this.masterIp.set(cluster.masterIpAddress ?? '');
      const endpoints = this.appEndpointsService.endpoints();
      const appDefs = this.buildSystemAppDefs(systemStatus, clusterApps);

      this.directEndpoints.set(
        appDefs.map(d => {
          const endpoint = endpoints.find(e => e.applicationId === d.applicationId) ?? null;
          // Pre-populate the draft from the existing endpoint when available so the
          // user sees what's currently configured. nip.io detection is heuristic
          // (suffix match against the cluster master IP).
          const fqdn = endpoint?.fqdn ?? '';
          const ip = cluster.masterIpAddress ?? '';
          const ipDashed = ip.replaceAll('.',  '-');
          const nipSuffix = ipDashed ? `.${ipDashed}.nip.io` : '';
          const isNip = (endpoint?.hostnameMode === 'ip')
            || (!!nipSuffix && fqdn.endsWith(nipSuffix));
          const prefix = isNip && nipSuffix
            ? fqdn.slice(0, fqdn.length - nipSuffix.length)
            : '';
          return {
            key: d.key,
            label: d.label,
            slug: d.slug,
            applicationId: d.applicationId,
            endpoint,
            draftFqdn: isNip ? '' : fqdn,
            draftHostnameMode: isNip ? 'ip' : 'domain',
            draftPrefix: prefix,
            configured: !!endpoint,
            saving: false,
            error: null,
          } satisfies DirectEndpointRow;
        })
      );
    } catch { /* show empty rows */ } finally {
      this.loadingDirectConfig.set(false);
    }
  }

  /** Build the nip.io FQDN for a given subdomain prefix using the cluster master IP. */
  buildNipFqdn(prefix: string): string {
    const ip = this.masterIp().trim();
    if (!ip || !prefix.trim()) return '';
    return `${prefix.trim()}.${ip.replaceAll('.',  '-')}.nip.io`;
  }

  /** Resolve the FQDN that the row will be created with, based on its draft state. */
  resolveDraftFqdn(row: DirectEndpointRow): string {
    if (row.draftHostnameMode === 'ip') return this.buildNipFqdn(row.draftPrefix);
    return row.draftFqdn.trim();
  }

  /**
   * Commit the inline form draft into the row state. Does NOT hit the backend —
   * the actual endpoint + SAN-cert creation happens in batch in `runEndpointSetup`.
   */
  commitDirectRow(
    key: DirectEndpointRow['key'],
    draft: { hostnameMode: 'ip' | 'domain'; fqdn?: string; prefix?: string },
  ): void {
    this.updateDirectRow(key, {
      draftHostnameMode: draft.hostnameMode,
      draftFqdn: draft.fqdn ?? '',
      draftPrefix: draft.prefix ?? '',
      configured: true,
      error: null,
    });
  }

  updateDirectRow(key: DirectEndpointRow['key'], patch: Partial<DirectEndpointRow>): void {
    this.directEndpoints.update(rows =>
      rows.map(r => r.key === key ? { ...r, ...patch } : r)
    );
  }

  // ── Step 4/5: Endpoint run setup ─────────────────────────────────────
  async runEndpointSetup(clusterId: string, isRetry = false): Promise<void> {
    // In direct mode, FQDNs come from directEndpoints; in wildcard mode, auto-generated from zone
    const isDirect = this.certMode() === 'direct';

    let zoneName = '';
    if (!isDirect) {
      zoneName = this.selectedZoneName();
      if (!zoneName) {
        this.endpointError.set('Could not determine zone name');
        this.endpointPhase.set('error');
        return;
      }
    }

    this.endpointError.set(null);
    this.endpointPhase.set('configuring');

    const zoneId = this.clusterDnsZoneService.assignment()?.id ?? '';

    // Subdomain prefix per slug for wildcard mode (convention: api.*, dashboard.*, auth.*)
    const SLUG_SUBDOMAIN: Record<string, string> = {
      'flui-api': 'api',
      'flui-web': 'dashboard',
      'zitadel':  'auth',
    };

    let systemAppDefs: Array<{ key: string; label: string; slug: string; applicationId: string }> = [];
    try {
      const [systemStatus, clusterApps] = await Promise.all([
        firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerGetSystemDnsStatus(clusterId)),
        firstValueFrom(this.applicationsApi.applicationsControllerListByCluster(clusterId, undefined, undefined, undefined, 'system')),
      ]);
      systemAppDefs = this.buildSystemAppDefs(systemStatus, clusterApps);
    } catch {
      if (!isDirect) {
        this.endpointError.set('Failed to load system app configuration');
        this.endpointPhase.set('error');
        return;
      }
      // Direct mode: proceed without — app list comes from directEndpoints
    }

    await this.appEndpointsService.loadEndpoints(clusterId);
    const existingEndpoints = this.appEndpointsService.endpoints();

    // In direct mode, use FQDNs already configured by the user in step endpoints-config
    // In wildcard mode, build from system-status (source of truth for which apps exist)
    const appDefs: Array<{ key: string; label: string; fqdn: string; slug: string; hostnameMode: 'ip' | 'domain' }> = isDirect
      ? this.directEndpoints().map(r => ({
          key: r.key,
          label: r.label,
          fqdn: r.endpoint?.fqdn ?? this.resolveDraftFqdn(r),
          slug: r.slug,
          hostnameMode: r.draftHostnameMode,
        }))
      : systemAppDefs.map(d => ({
          key: d.key,
          label: d.label,
          fqdn: `${SLUG_SUBDOMAIN[d.slug] ?? d.slug}.${zoneName}`,
          slug: d.slug,
          hostnameMode: 'domain' as const,
        }));

    // Direct mode batch optimisation: one SAN certificate covering all FQDNs
    // (HTTP-01 in this wizard) → 1 ACME challenge instead of N. The id is reused
    // when each endpoint is created below.
    let sanCertificateId: string | null = null;
    if (isDirect && !isRetry) {
      const fqdnsForSan = appDefs
        .map(d => d.fqdn)
        .filter((f): f is string => !!f && f.length > 0);
      if (fqdnsForSan.length > 0) {
        try {
          const sanDto: CreateSanCertificateDto = {
            name: `system-services-${Date.now().toString(36)}`,
            fqdns: fqdnsForSan,
            certChallenge: CreateSanCertificateDto.CertChallengeEnum.Http01,
            certificateProvider: this.startsInStaging
              ? CreateSanCertificateDto.CertificateProviderEnum.LetsEncryptStaging
              : CreateSanCertificateDto.CertificateProviderEnum.LetsEncrypt,
          };
          const san = await firstValueFrom(
            this.sanCertsApi.sanCertificateControllerCreate(clusterId, sanDto),
          );
          sanCertificateId = san?.id ?? null;
          this.batchSanCertificateId.set(sanCertificateId);
        } catch (err) {
          // Fall back to per-host certs if SAN creation fails (non-fatal — the
          // wizard still works, just slower). Surface as a warning, not an error.
          console.warn('[dns-wizard] SAN certificate creation failed, falling back to per-host:', err);
          this.batchSanCertificateId.set(null);
        }
      }
    } else if (isRetry) {
      sanCertificateId = this.batchSanCertificateId();
    }

    const appIdByKey = new Map(systemAppDefs.map(d => [d.key, d.applicationId]));

    if (isRetry) {
      this.appEndpointsDataSignal.update(apps => apps.map(a => {
        if (a.status === 'done') return a;
        const ep = existingEndpoints.find(e => e.fqdn === a.fqdn);
        const slugForKey = appDefs.find(d => d.key === a.key)?.slug;
        return {
          ...a,
          applicationId: ep?.applicationId ?? (slugForKey ? (appIdByKey.get(slugForKey) ?? null) : null) ?? a.applicationId,
          endpointId: ep?.id ?? a.endpointId,
          phase: 'idle' as const,
          rolloutProgress: null,
          dnsCheckStatus: 'pending' as const,
          dnsResolvedAddresses: [], errorMessage: null,
        };
      }));
    } else {
      this.appEndpointsDataSignal.set(appDefs.map(d => {
        const ep = existingEndpoints.find(e => e.fqdn === d.fqdn);
        const applicationId = ep?.applicationId ?? appIdByKey.get(d.key) ?? null;
        return {
          key: d.key, label: d.label, fqdn: d.fqdn,
          applicationId, endpointId: ep?.id ?? null,
          status: 'pending' as const,
          phase: 'idle' as const,
          rolloutProgress: null,
          dnsCheckStatus: 'pending' as const,
          dnsResolvedAddresses: [],
          certStatus: (ep?.certificateStatus as AppEndpointStatus['certStatus']) ?? null,
          certMessage: ep?.certificateMessage ?? null,
          ingressConfigured: ep?.reconciliationStatus === 'IN_SYNC',
          errorMessage: null,
        };
      }));
    }

    for (const def of appDefs) {
      const current = this.appEndpointsDataSignal().find(a => a.key === def.key)!;
      if (current.status === 'done') continue;

      this.updateAppStatus(def.key, { status: 'running', phase: 'creating-endpoint' });

      let endpointId = current.endpointId;

      if (!endpointId) {
        if (!current.applicationId) {
          this.updateAppStatus(def.key, { status: 'error', phase: 'error', errorMessage: 'Application not found — cannot create endpoint' });
          continue;
        }
        const dto: CreateAppEndpointDto = {
          applicationId: current.applicationId,
          fqdn: def.fqdn || undefined,
          clusterDnsZoneId: zoneId || undefined,
          certificateRequired: true,
          certificateProvider: this.startsInStaging
            ? CreateAppEndpointDto.CertificateProviderEnum.LetsEncryptStaging
            : CreateAppEndpointDto.CertificateProviderEnum.LetsEncrypt,
          hostnameMode: (def.hostnameMode === 'ip'
            ? CreateAppEndpointDto.HostnameModeEnum.Ip
            : CreateAppEndpointDto.HostnameModeEnum.Domain),
          certChallenge: isDirect
            ? CreateAppEndpointDto.CertChallengeEnum.Http01
            : CreateAppEndpointDto.CertChallengeEnum.Dns01,
          // Bind to the shared SAN cert when we created one — reuses the master
          // TLS Secret and skips per-host emission.
          ...(sanCertificateId ? { sanCertificateId } : {}),
        };
        const ep = await this.appEndpointsService.createEndpoint(clusterId, dto);
        if (!ep) {
          this.updateAppStatus(def.key, { status: 'error', phase: 'error', errorMessage: this.appEndpointsService.error() ?? 'Failed to create endpoint' });
          continue;
        }
        endpointId = ep.id;
        this.updateAppStatus(def.key, { endpointId, applicationId: ep.applicationId ?? null });
        await this.appEndpointsService.loadEndpoints(clusterId);
      }

      const epForCheck = this.appEndpointsService.endpoints().find(e => e.id === endpointId);
      const expectedIp = epForCheck?.dnsRecordValue ?? null;
      if (expectedIp) {
        this.updateAppStatus(def.key, { phase: 'checking-dns', dnsCheckStatus: 'checking' });
        const dnsOk = await this.waitForDnsResolution(def.key, def.fqdn, expectedIp);
        if (!dnsOk) this.updateAppStatus(def.key, { dnsCheckStatus: 'failed' });
      } else {
        this.updateAppStatus(def.key, { phase: 'checking-dns', dnsCheckStatus: 'pending' });
      }

      this.updateAppStatus(def.key, { phase: 'reconciling' });
      const reconciled = await this.appEndpointsService.reconcileEndpoint(endpointId);
      if (!reconciled) {
        this.updateAppStatus(def.key, { status: 'error', phase: 'error', errorMessage: this.appEndpointsService.error() ?? 'Failed to reconcile endpoint' });
        continue;
      }

      // Domain sync runs after production certs are valid (see pollEndpointStatuses).
    }

    this.endpointPhase.set('polling');
    await this.pollEndpointStatuses(clusterId, this.startsInStaging ? 'staging' : 'prod');
  }

  // ── Rollout monitoring ───────────────────────────────────────────────
  private waitForRollout(
    appId: string,
    key: AppEndpointStatus['key'],
    rolloutPhase: AppEndpointPhase,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const TIMEOUT_MS = 5 * 60_000;

      const timer = setTimeout(() => {
        this.appRuntimeWs.unsubscribeFromApp(appId);
        this.updateAppStatus(key, { status: 'error', phase: 'error', errorMessage: 'Rollout timed out after 5 minutes' });
        resolve(false);
      }, TIMEOUT_MS);

      this.updateAppStatus(key, { phase: rolloutPhase, rolloutProgress: 0 });

      this.appRuntimeWs.subscribeToApp(appId, {
        onProgress: (e) => {
          this.updateAppStatus(key, { rolloutProgress: e.percentage });
        },
        onCompleted: () => {
          clearTimeout(timer);
          this.appRuntimeWs.unsubscribeFromApp(appId);
          this.updateAppStatus(key, { rolloutProgress: 100 });
          resolve(true);
        },
        onFailed: (e) => {
          clearTimeout(timer);
          this.appRuntimeWs.unsubscribeFromApp(appId);
          this.updateAppStatus(key, { status: 'error', phase: 'error', errorMessage: e.error || 'Rollout failed' });
          resolve(false);
        },
      });
    });
  }

  private async finalizeEndpointFlow(clusterId: string): Promise<void> {
    await this.syncSystemDomains(clusterId);
    // Both local and OIDC: the user's session lives on the old origin,
    // localStorage is per-origin → they must re-login on the new domain.
    this.requiresRelogin.set(true);
    this.endpointPhase.set('done');
  }

  private async syncSystemDomains(clusterId: string): Promise<void> {
    const apps = this.appEndpointsDataSignal();
    const zitadelAppId = apps.find(a => a.key === 'zitadel')?.applicationId;
    const fluiApiAppId = apps.find(a => a.key === 'flui-api')?.applicationId;
    const fluiWebAppId = apps.find(a => a.key === 'flui-web')?.applicationId;

    if (!fluiApiAppId || !fluiWebAppId) return;

    // Sync runs sequentially per app, but Next is still disabled until the
    // whole flow finishes. Spin all three loaders together so the UI doesn't
    // look frozen with checkmarks while work is still happening.
    const initialSyncPhase: Record<string, AppEndpointPhase> = {
      'zitadel': 'syncing-auth',
      'flui-web': 'syncing-web',
      'flui-api': 'syncing-api',
    };
    for (const app of apps) {
      if (app.status !== 'error' && initialSyncPhase[app.key]) {
        this.updateAppStatus(app.key, { status: 'running', phase: initialSyncPhase[app.key] });
      }
    }

    // OIDC-only: sync Zitadel ExternalDomain + register new redirect URIs.
    if (zitadelAppId) {
      this.updateAppStatus('zitadel', { phase: 'syncing-auth' });
      try {
        const authDto: SyncAuthDomainDto = { fluiWebApplicationId: fluiWebAppId };
        await firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerSyncAuthDomain(clusterId, authDto));
      } catch {
        this.updateAppStatus('zitadel', { status: 'error', phase: 'error', errorMessage: 'Auth domain sync failed' });
        return;
      }
      const authRolloutOk = await this.waitForRollout(zitadelAppId, 'zitadel', 'rollout-auth');
      if (!authRolloutOk) return;
      this.updateAppStatus('zitadel', { status: 'done', phase: 'done' });
    }

    // Web before api: in OIDC mode, sync-api-domain restarts flui-api and invalidates the token,
    // so it must be last. In local mode order doesn't matter but we keep it consistent.
    this.updateAppStatus('flui-web', { phase: 'syncing-web' });
    try {
      const webDto: SyncWebDomainDto = {
        fluiApiApplicationId: fluiApiAppId,
        fluiWebApplicationId: fluiWebAppId,
        ...(zitadelAppId ? { zitadelApplicationId: zitadelAppId } : {}),
      };
      await firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerSyncWebDomain(clusterId, webDto));
    } catch {
      this.updateAppStatus('flui-web', { status: 'error', phase: 'error', errorMessage: 'Web domain sync failed' });
      return;
    }

    const webRolloutOk = await this.waitForRollout(fluiWebAppId, 'flui-web', 'rollout-web');
    if (!webRolloutOk) return;
    this.updateAppStatus('flui-web', { status: 'done', phase: 'done' });

    this.updateAppStatus('flui-api', { phase: 'syncing-api' });
    try {
      const syncDto: SyncApiDomainDto = {
        fluiApiApplicationId: fluiApiAppId,
        fluiWebApplicationId: fluiWebAppId,
        ...(zitadelAppId ? { zitadelApplicationId: zitadelAppId } : {}),
      };
      await firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerSyncApiDomain(clusterId, syncDto));
    } catch {
      this.updateAppStatus('flui-api', { status: 'error', phase: 'error', errorMessage: 'API domain sync failed' });
      return;
    }

    const apiRolloutOk = await this.waitForRollout(fluiApiAppId, 'flui-api', 'rollout-api');
    if (!apiRolloutOk) return;
    this.updateAppStatus('flui-api', { status: 'done', phase: 'done' });
  }

  private async waitForDnsResolution(key: AppEndpointStatus['key'], fqdn: string, expectedIp: string): Promise<boolean> {
    const INTERVAL_MS = 10_000;
    const TIMEOUT_MS = 180_000;
    const start = Date.now();

    while (Date.now() - start < TIMEOUT_MS) {
      try {
        const res = await firstValueFrom(this.dnsZonesApi.dnsZoneControllerVerifyDns(fqdn, expectedIp));
        this.updateAppStatus(key, { dnsResolvedAddresses: res.resolvedAddresses ?? [] });
        if (res.matches) {
          this.updateAppStatus(key, { dnsCheckStatus: 'ok' });
          return true;
        }
      } catch { /* transient */ }
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    return false;
  }

  private async pollEndpointStatuses(clusterId: string, phase: 'staging' | 'prod' = 'staging'): Promise<void> {
    const INTERVAL_MS = 4000;
    const TIMEOUT_MS = 120_000;
    const start = Date.now();
    const activePhase: AppEndpointPhase = phase === 'staging' ? 'issuing-cert' : 'issuing-prod-cert';

    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));
      try {
        await this.appEndpointsService.loadEndpoints(clusterId);
        const allEndpoints = this.appEndpointsService.endpoints();

        for (const app of this.appEndpointsDataSignal()) {
          if (app.status === 'error' && !app.endpointId) continue;
          if (!app.endpointId) continue;
          const ep = allEndpoints.find(e => e.id === app.endpointId);
          if (!ep) continue;

          const ingressConfigured = ep.reconciliationStatus === 'IN_SYNC';
          const certStatus = (ep.certificateStatus as AppEndpointStatus['certStatus']) ?? null;
          const certMessage = ep.certificateMessage ?? null;
          // cert-manager may set "failed" during transient challenge propagation — treat as still issuing
          const challengeInProgress = (certStatus === 'failed') &&
            !!certMessage && /waiting for (dns-01|http-01|tls-alpn-01) challenge/i.test(certMessage);
          const certPermanentlyFailed = (certStatus === 'failed' || certStatus === 'expired') && !challengeInProgress;
          // If challenge is still in progress, treat as "issuing" for display purposes
          const effectiveStatus: AppEndpointStatus['certStatus'] = challengeInProgress ? 'issuing' : certStatus;
          const certSettled = effectiveStatus !== null && effectiveStatus !== 'pending' && effectiveStatus !== 'issuing';
          const isReady = ingressConfigured && certSettled;

          // In staging phase: a settled cert means staging is done (valid or failed)
          // In prod phase: done means final success
          let newPhase: AppEndpointPhase;
          if (!isReady) newPhase = activePhase;
          else if (certPermanentlyFailed) newPhase = 'error';
          else if (phase === 'staging') newPhase = 'issuing-cert';
          else newPhase = 'done';

          let endpointStatus: AppEndpointStatus['status'];
          if (isReady && certPermanentlyFailed) endpointStatus = 'error';
          else if (isReady && phase === 'prod') endpointStatus = 'done';
          else endpointStatus = 'running';

          this.updateAppStatus(app.key, {
            certStatus: effectiveStatus, certMessage, ingressConfigured,
            phase: newPhase,
            status: endpointStatus,
            errorMessage: certPermanentlyFailed ? (certMessage ?? 'Certificate issuance failed') : null,
          });
        }

        const apps = this.appEndpointsDataSignal();
        const appsWithEndpoint = apps.filter(a => !!a.endpointId);
        const allEndpointsLoaded = this.appEndpointsService.endpoints();

        // Classify each active endpoint by its current cert status from the API
        const certEntries = appsWithEndpoint.map(a => {
          const ep = allEndpointsLoaded.find(e => e.id === a.endpointId);
          return { status: ep?.certificateStatus as AppEndpointStatus['certStatus'] | undefined, message: ep?.certificateMessage ?? null };
        });

        // cert-manager sets "failed" even during transient challenge propagation waits.
        // Only treat as permanently failed if message does NOT indicate an in-progress challenge.
        const isChallengeInProgress = (msg: string | null) =>
          !!msg && /waiting for (dns-01|http-01|tls-alpn-01) challenge/i.test(msg);

        const anyPermanentlyFailed = certEntries.some(
          e => (e.status === 'failed' || e.status === 'expired') && !isChallengeInProgress(e.message)
        );
        const allValid = certEntries.length > 0 && certEntries.every(e => e.status === 'valid');

        // Stop immediately if any cert has permanently failed
        if (anyPermanentlyFailed) {
          this.endpointPhase.set('done');
          return;
        }

        if (allValid) {
          if (phase === 'staging' && this.autoUpgradeAfterStaging) {
            const upgraded = await this.upgradeToProdCerts();
            if (upgraded) {
              await this.pollEndpointStatuses(clusterId, 'prod');
            }
            return;
          }
          await this.finalizeEndpointFlow(clusterId);
          return;
        }
      } catch { /* transient */ }
    }

    this.appEndpointsDataSignal.update(apps =>
      apps.map(a => a.status === 'running' ? { ...a, status: 'done', phase: 'done' } : a)
    );
    this.endpointPhase.set('done');
    this.endpointError.set('Endpoints are configured. Certificate issuance is running in the background.');
  }

  /** Upgrades all active endpoints from staging to production Let's Encrypt. Returns false if any upgrade failed. */
  private async upgradeToProdCerts(): Promise<boolean> {
    const apps = this.appEndpointsDataSignal().filter(a => a.status !== 'error' && !!a.endpointId);
    const allEndpoints = this.appEndpointsService.endpoints();
    let allOk = true;

    for (const app of apps) {
      this.updateAppStatus(app.key, { phase: 'upgrading-to-prod', status: 'running' });
      try {
        // Preserve clusterDnsZoneId so the backend uses the DNS-01 issuer (wildcard mode)
        const existing = allEndpoints.find(e => e.id === app.endpointId);
        const updateDto: UpdateAppEndpointDto = {
          certificateRequired: true,
          certificateProvider: UpdateAppEndpointDto.CertificateProviderEnum.LetsEncrypt,
          ...(existing?.clusterDnsZoneId ? { clusterDnsZoneId: existing.clusterDnsZoneId } : {}),
        };
        await this.appEndpointsService.updateEndpoint(app.endpointId!, updateDto);
        const reconciled = await this.appEndpointsService.reconcileEndpoint(app.endpointId!);
        if (!reconciled) {
          this.updateAppStatus(app.key, { status: 'error', phase: 'error', errorMessage: 'Failed to reconcile after prod cert upgrade' });
          allOk = false;
          continue;
        }
        this.updateAppStatus(app.key, { phase: 'issuing-prod-cert' });
      } catch {
        this.updateAppStatus(app.key, { status: 'error', phase: 'error', errorMessage: 'Failed to upgrade to production certificate' });
        allOk = false;
      }
    }

    return allOk;
  }

  updateAppStatus(key: AppEndpointStatus['key'], patch: Partial<AppEndpointStatus>): void {
    this.appEndpointsDataSignal.update(apps =>
      apps.map(a => a.key === key ? { ...a, ...patch } : a)
    );
  }

  openAppError(app: AppEndpointStatus): void {
    this.activeAppError.set({ label: app.label, certMessage: app.certMessage, errorMessage: app.errorMessage });
    this.appErrorCopied.set(false);
  }

  closeAppError(): void {
    this.activeAppError.set(null);
  }

  copyAppErrorMessage(): void {
    const err = this.activeAppError();
    if (!err) return;
    const text = [err.certMessage, err.errorMessage].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.appErrorCopied.set(true);
      setTimeout(() => this.appErrorCopied.set(false), 2000);
    });
  }
}
