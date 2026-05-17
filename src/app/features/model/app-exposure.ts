import { ApplicationResponseDto } from '../../core/api';

export function hasPublicEndpoint(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  if (!app) return false;
  if (app.exposure === ApplicationResponseDto.ExposureEnum.Internal) return false;
  const labels = (app.labels ?? {}) as Record<string, string>;
  if (labels['flui.cloud/app-type'] === 'building-block') return false;
  return true;
}

export function isBuildingBlock(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  const labels = (app?.labels ?? {}) as Record<string, string>;
  return labels['flui.cloud/app-type'] === 'building-block';
}

type InternalHostingMissing = 'dns_zone' | 'wildcard_issuer' | 'internal_wildcard_dns';

interface InternalHostingErrorBody {
  code?: string;
  message?: string;
  missingRequirements?: InternalHostingMissing[];
  clusterId?: string;
}

/** Detects the backend's structured `INTERNAL_HOSTING_NOT_AVAILABLE` 400 error and
 *  returns a human message with the missing requirements. Returns null otherwise. */
export function internalHostingErrorMessage(err: unknown): string | null {
  const e = err as { error?: InternalHostingErrorBody; status?: number } | null;
  const body = e?.error;
  if (body?.code !== 'INTERNAL_HOSTING_NOT_AVAILABLE') return null;
  const missing = body.missingRequirements ?? [];
  const labels = missing.map(k => {
    switch (k) {
      case 'dns_zone': return 'DNS zone';
      case 'wildcard_issuer': return 'wildcard TLS issuer';
      case 'internal_wildcard_dns': return 'internal wildcard DNS';
      default: return k;
    }
  });
  const detail = labels.length ? ` Missing: ${labels.join(', ')}.` : '';
  return `This cluster does not support internal apps yet.${detail} Configure DNS on the cluster, then try again.`;
}
