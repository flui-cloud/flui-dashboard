import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DnsZonesService } from '../../service/dns-zones.service';
import { ClusterDnsZoneService, SystemHostnameApp } from '../../service/cluster-dns-zone.service';
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

export type WizardStep = 'mode' | 'zone' | 'names' | 'issuer' | 'endpoints-config' | 'endpoints' | 'done';
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

export interface ZoneOption {
  key: string;
  zoneName: string;
  provider: string;
  registeredId: string | null;
  providerZoneId: string | null;
}

export interface SystemNameRow {
  app: SystemHostnameApp;
  label: string;
  defaultLabel: string;
  error: string | null;
}

export const SYSTEM_APP_TITLES: Record<SystemHostnameApp, string> = {
  'flui-web': 'Dashboard',
  'flui-api': 'API',
  'zitadel': 'Sign-in',
};

const SYSTEM_APPS = new Set<string>(Object.keys(SYSTEM_APP_TITLES));

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function wildcardLabelHint(label: string, zoneName: string): string | null {
  if (!label) return 'Enter a name.';
  if (label.includes('.')) {
    return `One name, no dots: the certificate for *.${zoneName || 'your domain'} covers a single level.`;
  }
  if (label.length > 63) return 'At most 63 characters.';
  if (!DNS_LABEL.test(label)) return 'Lowercase letters, digits and hyphens, not at the start or end.';
  return null;
}

const WILDCARD_STEPS: WizardStep[] = ['mode', 'zone', 'names', 'issuer', 'endpoints', 'done'];
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
  readonly selectedZoneId = signal('');
  readonly acmeEmail = signal('');
  readonly existingZone = signal<ClusterDnsZoneResponseDto | null>(null);
  readonly loadingExisting = signal(true);
  readonly zoneOptions = signal<ZoneOption[]>([]);
  readonly selectedZoneKey = signal('');
  readonly loadingZoneOptions = signal(false);
  readonly unreadableZoneProviders = signal<string[]>([]);
  readonly registeringZone = signal(false);
  readonly zoneError = signal<string | null>(null);
  readonly configuredDnsProviders = computed(() => {
    const supported = new Set(this.dnsZonesService.providers());
    return this.dnsZonesService.dnsCapableProviders()
      .map(p => p.id)
      .filter(id => supported.has(id));
  });

  // ── Step 2b (wildcard only): System app names ───────────────────────
  readonly systemNames = signal<SystemNameRow[]>([]);
  readonly namesZoneName = signal('');
  readonly loadingNames = signal(false);
  readonly checkingNames = signal(false);
  readonly namesError = signal<string | null>(null);
  private namesLoadedForZone: string | null = null;
  private readonly chosenFqdns = signal<Partial<Record<string, string>>>({});

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
  readonly checkingDirect = signal(false);
  readonly endpointsConfigError = signal<string | null>(null);
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
      case 'zone': return this.canProceedFromZone();
      case 'names': return this.canProceedFromNames();
      case 'issuer': return this.canProceedFromIssuer();
      case 'endpoints-config': return this.canProceedFromEndpointsConfig();
      case 'endpoints':        return this.endpointPhase() === 'done' && !this.hasFailedEndpoint();
      case 'done':             return true;
    }
  });

  private canProceedFromZone(): boolean {
    return !!this.selectedZoneKey() && !!this.acmeEmail().trim()
      && !this.registeringZone() && !this.loadingZoneOptions();
  }

  private canProceedFromNames(): boolean {
    const rows = this.systemNames();
    return rows.length > 0
      && rows.every(r => !!r.label && !r.error)
      && !this.loadingNames() && !this.checkingNames();
  }

  private canProceedFromIssuer(): boolean {
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

  private canProceedFromEndpointsConfig(): boolean {
    const rows = this.directEndpoints();
    if (rows.length === 0 || this.checkingDirect()) return false;
    return rows.every(r => {
      if (!r.configured) return false;
      if (r.draftHostnameMode === 'ip') return !!r.draftPrefix.trim() && !!this.masterIp();
      return !!r.draftFqdn.trim();
    });
  }

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
    const zone = this.dnsZonesService.zones().find(z => z.id === this.selectedZoneId());
    return zone?.zoneName ?? '';
  }

  // ── Init ─────────────────────────────────────────────────────────────
  async init(clusterId: string | null): Promise<void> {
    this.loadingExisting.set(true);
    await Promise.all([
      this.dnsZonesService.loadZones(),
      this.dnsZonesService.loadProviders(),
      this.dnsZonesService.loadDnsCapableProviders(),
      clusterId ? this.loadExistingConfig(clusterId) : Promise.resolve(),
    ]);
    this.loadingExisting.set(false);
    await this.loadZoneOptions();
  }

  private async loadExistingConfig(clusterId: string): Promise<void> {
    try {
      await this.clusterDnsZoneService.loadAssignment(clusterId);
      const assignment = this.clusterDnsZoneService.assignment();
      if (assignment) {
        this.existingZone.set(assignment);
        this.selectedZoneId.set(assignment.dnsZoneId);
        this.acmeEmail.set(assignment.acmeEmail ?? '');
        this.certMode.set(assignment.wildcardCertificate ? 'wildcard' : 'direct');
      }
    } catch { /* no assignment */ }

    try {
      const issuers = await this.clusterDnsZoneService.getIssuers(clusterId);
      this.existingIssuers.set(issuers);
      this.issuerStatuses.set(issuers);
    } catch { /* no issuers */ }
  }

  // ── Step 2: Zone choice (registered + provider zones) ──────────────
  /** Registered zones first, then the configured providers' zones not registered yet. */
  async loadZoneOptions(): Promise<void> {
    this.loadingZoneOptions.set(true);
    this.zoneError.set(null);
    const registered = this.dnsZonesService.zones();
    const options: ZoneOption[] = registered.map(z => ({
      key: `zone:${z.id}`,
      zoneName: z.zoneName,
      provider: z.dnsProvider,
      registeredId: z.id,
      providerZoneId: z.providerZoneId,
    }));
    const unreadable: string[] = [];
    const perProvider = await Promise.all(
      this.configuredDnsProviders().map(async provider => {
        try {
          return { provider, zones: await this.dnsZonesService.fetchProviderZones(provider) };
        } catch {
          unreadable.push(provider);
          return { provider, zones: [] };
        }
      })
    );
    for (const { provider, zones } of perProvider) {
      for (const zone of zones) {
        const known = registered.some(r =>
          r.dnsProvider === provider && (r.providerZoneId === zone.zoneId || r.zoneName === zone.name)
        );
        if (known || !zone.name) continue;
        options.push({
          key: `provider:${provider}:${zone.zoneId}`,
          zoneName: zone.name,
          provider,
          registeredId: null,
          providerZoneId: zone.zoneId,
        });
      }
    }
    this.zoneOptions.set(options);
    this.unreadableZoneProviders.set(unreadable);

    const current = options.find(o => o.key === this.selectedZoneKey())
      ?? options.find(o => !!o.registeredId && o.registeredId === this.selectedZoneId())
      ?? (options.length === 1 ? options[0] : undefined);
    this.selectZone(current?.key ?? '');
    this.loadingZoneOptions.set(false);
  }

  selectZone(key: string): void {
    this.selectedZoneKey.set(key);
    this.zoneError.set(null);
    const option = this.zoneOptions().find(o => o.key === key);
    this.selectedZoneId.set(option?.registeredId ?? '');
  }

  /** Registers the chosen provider zone when it is not registered yet. */
  async ensureSelectedZoneRegistered(): Promise<boolean> {
    const option = this.zoneOptions().find(o => o.key === this.selectedZoneKey());
    if (!option) return false;
    if (option.registeredId) {
      this.selectedZoneId.set(option.registeredId);
      return true;
    }

    this.registeringZone.set(true);
    this.zoneError.set(null);
    const dto: CreateDnsZoneDto = {
      providerZoneId: option.providerZoneId ?? undefined,
      zoneName: option.zoneName,
      dnsProvider: option.provider as CreateDnsZoneDto.DnsProviderEnum,
    };
    const result = await this.dnsZonesService.registerZone(dto);
    this.registeringZone.set(false);
    if (!result) {
      this.zoneError.set(this.dnsZonesService.error() ?? 'Could not add this domain.');
      return false;
    }

    const key = `zone:${result.id}`;
    this.zoneOptions.update(list =>
      list.map(o => (o.key === option.key ? { ...o, key, registeredId: result.id } : o))
    );
    this.selectedZoneKey.set(key);
    this.selectedZoneId.set(result.id);
    return true;
  }

  // ── Step 2b (wildcard only): System app names ───────────────────────
  async loadSystemNames(clusterId: string): Promise<void> {
    const zoneId = this.selectedZoneId();
    if (this.namesLoadedForZone === zoneId && this.systemNames().length > 0) return;
    this.loadingNames.set(true);
    this.namesError.set(null);
    try {
      const result = await this.clusterDnsZoneService.getSystemHostnames(clusterId, zoneId || undefined);
      const zoneName = result.zoneName ?? this.selectedZoneName();
      this.namesZoneName.set(zoneName);
      this.systemNames.set(result.hostnames.map(h => {
        const label = h.label ?? h.defaultLabel;
        return { app: h.app, label, defaultLabel: h.defaultLabel, error: wildcardLabelHint(label, zoneName) };
      }));
      this.namesLoadedForZone = zoneId;
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.namesError.set(message ?? 'Could not load the addresses.');
      this.systemNames.set([]);
    } finally {
      this.loadingNames.set(false);
    }
  }

  setSystemName(app: SystemHostnameApp, value: string): void {
    const label = value.trim().toLowerCase();
    this.namesError.set(null);
    this.systemNames.update(rows => rows.map(r =>
      r.app === app ? { ...r, label, error: wildcardLabelHint(label, this.namesZoneName()) } : r
    ));
  }

  /** Asks the API whether the chosen names are valid and free; keeps the resulting addresses. */
  async checkSystemNames(clusterId: string): Promise<boolean> {
    this.checkingNames.set(true);
    this.namesError.set(null);
    const check = await this.clusterDnsZoneService.checkSystemHostnames(clusterId, {
      dnsZoneId: this.selectedZoneId() || undefined,
      hostnames: this.systemNames().map(r => ({ app: r.app, label: r.label })),
    });
    this.checkingNames.set(false);
    if (!check.ok) {
      if (check.field && this.systemNames().some(r => r.app === check.field)) {
        this.systemNames.update(rows => rows.map(r => (r.app === check.field ? { ...r, error: check.message } : r)));
      } else {
        this.namesError.set(check.message);
      }
      return false;
    }
    this.chosenFqdns.set(Object.fromEntries(
      check.result.hostnames.filter(h => !!h.fqdn).map(h => [h.app, h.fqdn as string])
    ));
    return true;
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

    const hasZone = !!this.existingZone() && this.existingZone()!.dnsZoneId === this.selectedZoneId();
    if (!hasZone) {
      const dto: AssignDnsZoneDto = {
        dnsZoneId: this.selectedZoneId(),
        acmeEmail: this.acmeEmail().trim(),
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
    const issuerDto: ConfigureIssuerDto = { acmeEmail: this.acmeEmail().trim() };

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

  /** Asks the API whether the addresses of the direct-mode rows are valid and free. */
  async checkDirectEndpoints(clusterId: string): Promise<boolean> {
    const rows = this.directEndpoints().filter(r => SYSTEM_APPS.has(r.key));
    if (rows.length === 0) return true;
    rows.forEach(r => this.updateDirectRow(r.key, { error: null }));
    this.endpointsConfigError.set(null);
    this.checkingDirect.set(true);
    const check = await this.clusterDnsZoneService.checkSystemHostnames(clusterId, {
      hostnames: rows.map(r => ({
        app: r.key as SystemHostnameApp,
        fqdn: r.endpoint?.fqdn ?? this.resolveDraftFqdn(r),
      })),
    });
    this.checkingDirect.set(false);
    if (check.ok) return true;
    if (check.field && rows.some(r => r.key === check.field)) {
      this.updateDirectRow(check.field, { error: check.message });
    } else {
      this.endpointsConfigError.set(check.message);
    }
    return false;
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

    if (this.resolveEndpointSetupZoneName(isDirect) === null) return;

    this.endpointError.set(null);
    this.endpointPhase.set('configuring');

    const zoneId = this.clusterDnsZoneService.assignment()?.id ?? '';

    const systemAppDefs = await this.loadEndpointSetupSystemAppDefs(clusterId, isDirect);
    if (systemAppDefs === null) return; // error already set

    await this.appEndpointsService.loadEndpoints(clusterId);
    const existingEndpoints = this.appEndpointsService.endpoints();

    const appDefs = this.buildEndpointSetupAppDefs(isDirect, systemAppDefs);
    if (!isDirect && appDefs.some(d => !d.fqdn)) {
      this.endpointError.set('Choose the addresses first: go back to the names step.');
      this.endpointPhase.set('error');
      return;
    }

    // Direct mode batch optimisation: one SAN certificate covering all FQDNs
    // (HTTP-01 in this wizard) → 1 ACME challenge instead of N. The id is reused
    // when each endpoint is created below.
    const sanCertificateId = await this.resolveEndpointSetupSanCertificateId(clusterId, isDirect, isRetry, appDefs);

    this.seedEndpointStatuses(isRetry, appDefs, systemAppDefs, existingEndpoints);

    for (const def of appDefs) {
      await this.processEndpointSetupDef(def, clusterId, zoneId, isDirect, sanCertificateId);
    }

    this.endpointPhase.set('polling');
    await this.pollEndpointStatuses(clusterId, this.startsInStaging ? 'staging' : 'prod');
  }

  /** Returns null (and sets the error phase) when the zone name can't be determined in wildcard mode. */
  private resolveEndpointSetupZoneName(isDirect: boolean): string | null {
    if (isDirect) return '';
    const zoneName = this.selectedZoneName();
    if (!zoneName) {
      this.endpointError.set('Could not determine zone name');
      this.endpointPhase.set('error');
      return null;
    }
    return zoneName;
  }

  /** Returns null (and sets the error phase) when wildcard mode can't proceed without system app data. */
  private async loadEndpointSetupSystemAppDefs(
    clusterId: string,
    isDirect: boolean,
  ): Promise<Array<{ key: string; label: string; slug: string; applicationId: string }> | null> {
    try {
      const [systemStatus, clusterApps] = await Promise.all([
        firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerGetSystemDnsStatus(clusterId)),
        firstValueFrom(this.applicationsApi.applicationsControllerListByCluster(clusterId, undefined, undefined, undefined, 'system')),
      ]);
      return this.buildSystemAppDefs(systemStatus, clusterApps);
    } catch {
      if (!isDirect) {
        this.endpointError.set('Failed to load system app configuration');
        this.endpointPhase.set('error');
        return null;
      }
      // Direct mode: proceed without — app list comes from directEndpoints
      return [];
    }
  }

  // In direct mode, use FQDNs already configured by the user in step endpoints-config.
  // In wildcard mode, build from system-status (source of truth for which apps exist).
  private buildEndpointSetupAppDefs(
    isDirect: boolean,
    systemAppDefs: Array<{ key: string; label: string; slug: string; applicationId: string }>,
  ): Array<{ key: string; label: string; fqdn: string; slug: string; hostnameMode: 'ip' | 'domain' }> {
    if (isDirect) {
      return this.directEndpoints().map(r => ({
        key: r.key,
        label: r.label,
        fqdn: r.endpoint?.fqdn ?? this.resolveDraftFqdn(r),
        slug: r.slug,
        hostnameMode: r.draftHostnameMode,
      }));
    }
    const chosen = this.chosenFqdns();
    return systemAppDefs.map(d => ({
      key: d.key,
      label: d.label,
      fqdn: chosen[d.slug] ?? '',
      slug: d.slug,
      hostnameMode: 'domain' as const,
    }));
  }

  private async resolveEndpointSetupSanCertificateId(
    clusterId: string,
    isDirect: boolean,
    isRetry: boolean,
    appDefs: Array<{ fqdn: string }>,
  ): Promise<string | null> {
    if (isRetry) return this.batchSanCertificateId();
    if (!isDirect) return null;

    const fqdnsForSan = appDefs
      .map(d => d.fqdn)
      .filter((f): f is string => !!f && f.length > 0);
    if (fqdnsForSan.length === 0) return null;

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
      const sanCertificateId = san?.id ?? null;
      this.batchSanCertificateId.set(sanCertificateId);
      return sanCertificateId;
    } catch (err) {
      // Fall back to per-host certs if SAN creation fails (non-fatal — the
      // wizard still works, just slower). Surface as a warning, not an error.
      console.warn('[dns-wizard] SAN certificate creation failed, falling back to per-host:', err);
      this.batchSanCertificateId.set(null);
      return null;
    }
  }

  private seedEndpointStatuses(
    isRetry: boolean,
    appDefs: Array<{ key: string; label: string; fqdn: string; slug: string; hostnameMode: 'ip' | 'domain' }>,
    systemAppDefs: Array<{ key: string; label: string; slug: string; applicationId: string }>,
    existingEndpoints: AppEndpointResponseDto[],
  ): void {
    const appIdByKey = new Map(systemAppDefs.map(d => [d.key, d.applicationId]));

    if (isRetry) {
      this.appEndpointsDataSignal.update(apps => apps.map(a => {
        if (a.status === 'done') return a;
        const ep = existingEndpoints.find(e => e.fqdn === a.fqdn);
        const slugForKey = appDefs.find(d => d.key === a.key)?.slug;
        const applicationIdFromKey = slugForKey ? (appIdByKey.get(slugForKey) ?? null) : null;
        return {
          ...a,
          applicationId: ep?.applicationId ?? applicationIdFromKey ?? a.applicationId,
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
  }

  private async processEndpointSetupDef(
    def: { key: string; label: string; fqdn: string; slug: string; hostnameMode: 'ip' | 'domain' },
    clusterId: string,
    zoneId: string,
    isDirect: boolean,
    sanCertificateId: string | null,
  ): Promise<void> {
    const current = this.appEndpointsDataSignal().find(a => a.key === def.key)!;
    if (current.status === 'done') return;

    this.updateAppStatus(def.key, { status: 'running', phase: 'creating-endpoint' });

    let endpointId = current.endpointId;
    if (!endpointId) {
      endpointId = await this.ensureEndpointCreated(def, clusterId, zoneId, isDirect, sanCertificateId, current);
      if (!endpointId) return;
    }

    await this.checkEndpointDns(def, endpointId);

    this.updateAppStatus(def.key, { phase: 'reconciling' });
    const reconciled = await this.appEndpointsService.reconcileEndpoint(endpointId);
    if (!reconciled) {
      this.updateAppStatus(def.key, { status: 'error', phase: 'error', errorMessage: this.appEndpointsService.error() ?? 'Failed to reconcile endpoint' });
    }

    // Domain sync runs after production certs are valid (see pollEndpointStatuses).
  }

  /** Creates the endpoint for a def that doesn't have one yet. Returns null (and sets the error status) on failure. */
  private async ensureEndpointCreated(
    def: { key: string; fqdn: string; hostnameMode: 'ip' | 'domain' },
    clusterId: string,
    zoneId: string,
    isDirect: boolean,
    sanCertificateId: string | null,
    current: AppEndpointStatus,
  ): Promise<string | null> {
    if (!current.applicationId) {
      this.updateAppStatus(def.key, { status: 'error', phase: 'error', errorMessage: 'Application not found — cannot create endpoint' });
      return null;
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
      return null;
    }
    this.updateAppStatus(def.key, { endpointId: ep.id, applicationId: ep.applicationId ?? null });
    await this.appEndpointsService.loadEndpoints(clusterId);
    return ep.id;
  }

  private async checkEndpointDns(def: { key: string; fqdn: string }, endpointId: string): Promise<void> {
    const epForCheck = this.appEndpointsService.endpoints().find(e => e.id === endpointId);
    const expectedIp = epForCheck?.dnsRecordValue ?? null;
    if (expectedIp) {
      this.updateAppStatus(def.key, { phase: 'checking-dns', dnsCheckStatus: 'checking' });
      const dnsOk = await this.waitForDnsResolution(def.key, def.fqdn, expectedIp);
      if (!dnsOk) this.updateAppStatus(def.key, { dnsCheckStatus: 'failed' });
    } else {
      this.updateAppStatus(def.key, { phase: 'checking-dns', dnsCheckStatus: 'pending' });
    }
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

    this.startDomainSyncLoaders(apps);

    // OIDC-only: sync Zitadel ExternalDomain + register new redirect URIs.
    if (zitadelAppId) {
      const authOk = await this.syncZitadelAuthDomain(clusterId, zitadelAppId, fluiWebAppId);
      if (!authOk) return;
    }

    // Web before api: in OIDC mode, sync-api-domain restarts flui-api and invalidates the token,
    // so it must be last. In local mode order doesn't matter but we keep it consistent.
    const webOk = await this.syncFluiWebDomain(clusterId, fluiApiAppId, fluiWebAppId, zitadelAppId);
    if (!webOk) return;

    await this.syncFluiApiDomain(clusterId, fluiApiAppId, fluiWebAppId, zitadelAppId);
  }

  // Sync runs sequentially per app, but Next is still disabled until the
  // whole flow finishes. Spin all three loaders together so the UI doesn't
  // look frozen with checkmarks while work is still happening.
  private startDomainSyncLoaders(apps: AppEndpointStatus[]): void {
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
  }

  private async syncZitadelAuthDomain(clusterId: string, zitadelAppId: string, fluiWebAppId: string): Promise<boolean> {
    this.updateAppStatus('zitadel', { phase: 'syncing-auth' });
    try {
      const authDto: SyncAuthDomainDto = { fluiWebApplicationId: fluiWebAppId };
      await firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerSyncAuthDomain(clusterId, authDto));
    } catch {
      this.updateAppStatus('zitadel', { status: 'error', phase: 'error', errorMessage: 'Auth domain sync failed' });
      return false;
    }
    const authRolloutOk = await this.waitForRollout(zitadelAppId, 'zitadel', 'rollout-auth');
    if (!authRolloutOk) return false;
    this.updateAppStatus('zitadel', { status: 'done', phase: 'done' });
    return true;
  }

  private async syncFluiWebDomain(clusterId: string, fluiApiAppId: string, fluiWebAppId: string, zitadelAppId: string | null | undefined): Promise<boolean> {
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
      return false;
    }

    const webRolloutOk = await this.waitForRollout(fluiWebAppId, 'flui-web', 'rollout-web');
    if (!webRolloutOk) return false;
    this.updateAppStatus('flui-web', { status: 'done', phase: 'done' });
    return true;
  }

  private async syncFluiApiDomain(clusterId: string, fluiApiAppId: string, fluiWebAppId: string, zitadelAppId: string | null | undefined): Promise<boolean> {
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
      return false;
    }

    const apiRolloutOk = await this.waitForRollout(fluiApiAppId, 'flui-api', 'rollout-api');
    if (!apiRolloutOk) return false;
    this.updateAppStatus('flui-api', { status: 'done', phase: 'done' });
    return true;
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
          this.applyPolledEndpointStatus(app, allEndpoints, phase, activePhase);
        }

        const done = await this.evaluatePollCompletion(clusterId, phase);
        if (done) return;
      } catch { /* transient */ }
    }

    this.appEndpointsDataSignal.update(apps =>
      apps.map(a => a.status === 'running' ? { ...a, status: 'done', phase: 'done' } : a)
    );
    this.endpointPhase.set('done');
    this.endpointError.set('Endpoints are configured. Certificate issuance is running in the background.');
  }

  private applyPolledEndpointStatus(
    app: AppEndpointStatus,
    allEndpoints: AppEndpointResponseDto[],
    phase: 'staging' | 'prod',
    activePhase: AppEndpointPhase,
  ): void {
    if (app.status === 'error' && !app.endpointId) return;
    if (!app.endpointId) return;
    const ep = allEndpoints.find(e => e.id === app.endpointId);
    if (!ep) return;

    const { ingressConfigured, effectiveStatus, certMessage, certPermanentlyFailed, isReady } = this.classifyPolledCertStatus(ep);
    const { newPhase, endpointStatus } = this.derivePolledPhaseAndStatus(isReady, certPermanentlyFailed, phase, activePhase);

    this.updateAppStatus(app.key, {
      certStatus: effectiveStatus, certMessage, ingressConfigured,
      phase: newPhase,
      status: endpointStatus,
      errorMessage: certPermanentlyFailed ? (certMessage ?? 'Certificate issuance failed') : null,
    });
  }

  private classifyPolledCertStatus(ep: AppEndpointResponseDto): {
    ingressConfigured: boolean;
    effectiveStatus: AppEndpointStatus['certStatus'];
    certMessage: string | null;
    certPermanentlyFailed: boolean;
    isReady: boolean;
  } {
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
    return { ingressConfigured, effectiveStatus, certMessage, certPermanentlyFailed, isReady };
  }

  private derivePolledPhaseAndStatus(
    isReady: boolean,
    certPermanentlyFailed: boolean,
    phase: 'staging' | 'prod',
    activePhase: AppEndpointPhase,
  ): { newPhase: AppEndpointPhase; endpointStatus: AppEndpointStatus['status'] } {
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

    return { newPhase, endpointStatus };
  }

  /** Returns true once polling should stop — either a terminal failure, or the flow finished / handed off to prod polling. */
  private async evaluatePollCompletion(clusterId: string, phase: 'staging' | 'prod'): Promise<boolean> {
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
      return true;
    }

    if (allValid) {
      if (phase === 'staging' && this.autoUpgradeAfterStaging) {
        const upgraded = await this.upgradeToProdCerts();
        if (upgraded) {
          await this.pollEndpointStatuses(clusterId, 'prod');
        }
        return true;
      }
      await this.finalizeEndpointFlow(clusterId);
      return true;
    }

    return false;
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
