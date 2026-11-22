import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CatalogClusterCapabilitiesDto } from '../../../core/api/model/catalogClusterCapabilitiesDto';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';

export type InternalHostingMissing = CatalogClusterCapabilitiesDto.InternalHostingMissingEnum;
export type EndpointType = CreateAppEndpointDto.EndpointTypeEnum;
export type HostnameMode = 'ip' | 'domain';
export type CertChallenge = 'http-01' | 'dns-01';

export interface DnsCheckResult {
  ok: boolean;
  resolvedAddresses: string[];
}

export interface EndpointFormState {
  applicationId: string;
  fqdn: string;
  subdomainPrefix: string;
  ipSlugOverride: string;
  certificateRequired: boolean;
  certificateProvider: string;
  hostnameMode: HostnameMode;
  certChallenge: CertChallenge;
}

export interface SubmitContext {
  form: EndpointFormState;
  applicationId: string;
  masterIp: string;
  zone: ClusterDnsZoneResponseDto | null;
  zoneSuffix: string;
  promoteToProd: boolean;
}

export interface ValidityContext {
  form: EndpointFormState;
  hasApp: boolean;
  internal: boolean;
  primaryZone: ClusterDnsZoneResponseDto | null;
  zone: ClusterDnsZoneResponseDto | null;
  masterIp: string;
  gatesOk: boolean;
  canUseDns01: boolean;
  issuersReady: boolean;
  errors: { fqdn: string | null; subdomain: string | null; ipSlug: string | null };
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

const MISSING_LABELS: Partial<Record<string, string>> = {
  dns_zone: 'DNS zone',
  wildcard_issuer: 'wildcard TLS issuer',
  internal_wildcard_dns: 'internal wildcard DNS',
};

export function emptyEndpointForm(
  zone: ClusterDnsZoneResponseDto | null,
  wildcardIssuersReady: boolean,
  startsInStaging: boolean,
): EndpointFormState {
  return {
    applicationId: '',
    fqdn: '',
    subdomainPrefix: '',
    ipSlugOverride: '',
    certificateRequired: false,
    certificateProvider: startsInStaging ? 'lets_encrypt_staging' : 'lets_encrypt',
    hostnameMode: zone ? 'domain' : 'ip',
    certChallenge: zone?.wildcardCertificate && wildcardIssuersReady ? 'dns-01' : 'http-01',
  };
}

export function internalHostingMissingLabel(missing: readonly InternalHostingMissing[]): string {
  const labels = missing.map((m) => MISSING_LABELS[m] ?? m);
  return labels.length ? labels.join(', ') : 'cluster prerequisites';
}

export function validateSubdomain(value: string): string | null {
  if (value.length > 63) return 'Subdomain prefix must be 63 characters or fewer';
  if (!LABEL_RE.test(value)) {
    return 'Use lowercase letters, numbers and hyphens only; cannot start or end with a hyphen';
  }
  return null;
}

export function validateFqdn(value: string): string | null {
  const labels = value.split('.');
  if (labels.length < 2) return 'Must contain at least one dot (e.g. app.example.com)';
  for (const label of labels) {
    if (!label) return 'Labels cannot be empty (no consecutive dots)';
    if (!LABEL_RE.test(label)) {
      return `"${label}" is invalid: use lowercase letters, numbers and hyphens only, not starting or ending with a hyphen`;
    }
  }
  return null;
}

export function ipFqdn(slug: string, ip: string): string {
  return `${slug}.${ip.replaceAll('.', '-')}.nip.io`;
}

export function deriveIpSlugOverride(ep: AppEndpointResponseDto, masterIp: string): string {
  if ((ep.hostnameMode as HostnameMode) !== 'ip' || !ep.fqdn) return '';
  const ipDashed = masterIp.replaceAll('.', '-');
  const suffix = `.${ipDashed}.nip.io`;
  if (ipDashed && ep.fqdn.endsWith(suffix)) {
    return ep.fqdn.slice(0, ep.fqdn.length - suffix.length);
  }
  return '';
}

export function zoneMatchingFqdn(
  fqdn: string,
  assignments: readonly ClusterDnsZoneResponseDto[],
): ClusterDnsZoneResponseDto | null {
  return (
    assignments
      .filter((a) => fqdn === a.dnsZone.zoneName || fqdn.endsWith('.' + a.dnsZone.zoneName))
      .sort((x, y) => y.dnsZone.zoneName.length - x.dnsZone.zoneName.length)[0] ?? null
  );
}

export function dnsMismatchLabel(result: DnsCheckResult, masterIp: string): string {
  const found = result.resolvedAddresses.length
    ? `found ${result.resolvedAddresses.join(', ')}`
    : 'no A record found';
  return `Does not point to ${masterIp}, ${found}`;
}

function resolveFqdn(ctx: SubmitContext): string | undefined {
  const { form, masterIp, zone, zoneSuffix } = ctx;
  if (form.hostnameMode === 'ip') {
    const slugOverride = form.ipSlugOverride.trim();
    return slugOverride && masterIp ? ipFqdn(slugOverride, masterIp) : undefined;
  }
  if (zone) {
    const prefix = form.subdomainPrefix.trim();
    return prefix ? `${prefix}.${zoneSuffix}` : undefined;
  }
  return form.fqdn.trim() || undefined;
}

function zoneForSubmit(ctx: SubmitContext): ClusterDnsZoneResponseDto | null {
  return ctx.form.hostnameMode === 'domain' ? ctx.zone : null;
}

export function buildCreateDto(ctx: SubmitContext): CreateAppEndpointDto {
  const { form } = ctx;
  const resolvedFqdn = resolveFqdn(ctx);
  const zone = zoneForSubmit(ctx);
  return {
    applicationId: ctx.applicationId,
    endpointType: 'public' as CreateAppEndpointDto.EndpointTypeEnum,
    ...(resolvedFqdn ? { fqdn: resolvedFqdn } : {}),
    ...(zone ? { clusterDnsZoneId: zone.id } : {}),
    certificateRequired: form.certificateRequired,
    ...(form.certificateRequired
      ? {
          certificateProvider:
            form.certificateProvider as CreateAppEndpointDto.CertificateProviderEnum,
        }
      : {}),
    hostnameMode: form.hostnameMode as CreateAppEndpointDto.HostnameModeEnum,
    certChallenge: form.certChallenge as CreateAppEndpointDto.CertChallengeEnum,
  };
}

export function buildUpdateDto(
  ctx: SubmitContext,
  ep: AppEndpointResponseDto,
): UpdateAppEndpointDto {
  const { form } = ctx;
  const resolvedFqdn = resolveFqdn(ctx);
  const zone = zoneForSubmit(ctx);
  const providerForSubmit =
    form.certificateRequired && ctx.promoteToProd ? 'lets_encrypt' : form.certificateProvider;
  let zoneIdUpdate: Partial<UpdateAppEndpointDto> = {};
  if (zone) {
    zoneIdUpdate = { clusterDnsZoneId: zone.id };
  } else if (ep.clusterDnsZoneId) {
    zoneIdUpdate = { clusterDnsZoneId: null as unknown as string };
  }
  return {
    ...(resolvedFqdn ? { fqdn: resolvedFqdn } : {}),
    ...zoneIdUpdate,
    certificateRequired: form.certificateRequired,
    ...(form.certificateRequired
      ? { certificateProvider: providerForSubmit as UpdateAppEndpointDto.CertificateProviderEnum }
      : {}),
    hostnameMode: form.hostnameMode as UpdateAppEndpointDto.HostnameModeEnum,
    certChallenge: form.certChallenge as UpdateAppEndpointDto.CertChallengeEnum,
  };
}

export function isEndpointFormValid(ctx: ValidityContext): boolean {
  const { form, errors } = ctx;
  if (!ctx.hasApp) return false;

  if (ctx.internal) {
    const subdomainOk = !!ctx.primaryZone && !!form.subdomainPrefix.trim() && !errors.subdomain;
    return subdomainOk && ctx.gatesOk;
  }

  let fqdnOk: boolean;
  let fqdnFormatOk: boolean;
  if (form.hostnameMode === 'ip') {
    fqdnOk = !!ctx.masterIp;
    fqdnFormatOk = !errors.ipSlug;
  } else {
    fqdnOk = ctx.zone ? !!form.subdomainPrefix.trim() : !!form.fqdn.trim();
    fqdnFormatOk = ctx.zone ? !errors.subdomain : !errors.fqdn;
  }
  const challengeOk = form.certChallenge !== 'dns-01' || ctx.canUseDns01;
  const certOk = !form.certificateRequired || !!form.certificateProvider;
  const issuersOk = !form.certificateRequired || ctx.issuersReady;
  return fqdnOk && fqdnFormatOk && challengeOk && certOk && issuersOk;
}

export function formFromEndpoint(
  ep: AppEndpointResponseDto,
  ctx: {
    zone: ClusterDnsZoneResponseDto | null;
    zoneSuffix: string;
    fallbackApplicationId: string;
    masterIp: string;
  },
): EndpointFormState {
  let prefix = '';
  let fqdn = ep.fqdn;
  if (ctx.zone) {
    const suffix = '.' + ctx.zoneSuffix;
    prefix = ep.fqdn.endsWith(suffix) ? ep.fqdn.slice(0, ep.fqdn.length - suffix.length) : ep.fqdn;
    fqdn = '';
  }
  return {
    applicationId: ep.applicationId ?? ctx.fallbackApplicationId,
    fqdn,
    subdomainPrefix: prefix,
    ipSlugOverride: deriveIpSlugOverride(ep, ctx.masterIp),
    certificateRequired: ep.certificateRequired,
    certificateProvider: ep.certificateProvider ?? 'lets_encrypt',
    hostnameMode: (ep.hostnameMode as HostnameMode) ?? (ctx.zone ? 'domain' : 'ip'),
    certChallenge: (ep.certChallenge as CertChallenge) ?? 'http-01',
  };
}
