import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import type { HealthStatus } from '../../model/provider.models';
import { providerEntityRef } from './providers-list-surface';

const SURFACE_APP_ID = 'flui-dashboard';
const PAGE_PREFIX = 'provider-detail';

export interface ProviderSurfaceInput {
  provider: ProviderDefinitionDto | undefined;
  configuration: ProviderConfigurationDto | undefined;
  health: HealthStatus | null;
}

export interface ProviderSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(
  key: string,
  value: number | boolean | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value === undefined || value === null ? null : { key, presentedAs: { value }, source };
}

/**
 * Redaction (playbook §7, checked explicitly against provider-credentials-panel.component.ts,
 * provider-manage.component.ts and ProviderConfigurationDto):
 *  - The credentials panel NEVER renders a stored secret value — its "rotate" form is a
 *    blank input for a NEW value, and ProviderConfigurationDto itself carries only
 *    `credentialsType`/`credentialsExpiresAt`, never a key/token/password. There is
 *    nothing secret this function could present even by accident: it is not in the input.
 *  - `health.errors` (raw text from a health probe) and the page's own transient
 *    `errorMessage` (API failure text) are deliberately NOT read here — free text from a
 *    backend probe/error is exactly the "raw error text" the checklist excludes. Only the
 *    health `status` label and numeric `responseTime` — both already rendered as-is — are
 *    presented.
 */
function pageObservations(input: ProviderSurfaceInput): Observation[] {
  const provider = input.provider!;
  const config = input.configuration;
  const health = input.health;
  return [
    textObservation('flui.provider.description', provider.description, 'api'),
    textObservation('flui.provider.status', config?.status ?? 'not_configured', 'api'),
    config ? valueObservation('flui.provider.active', config.isActive, 'api') : null,
    textObservation('flui.provider.credentials_type', config?.credentialsType, 'api'),
    textObservation('flui.provider.credentials_configured_at', config?.createdAt, 'api'),
    textObservation('flui.provider.credentials_expires_at', config?.credentialsExpiresAt, 'api'),
    textObservation('flui.provider.updated_at', config?.updatedAt, 'api'),
    textObservation('flui.provider.last_health_check', config?.lastHealthCheck, 'api'),
    config ? valueObservation('flui.provider.enabled_regions_count', config.enabledRegions.length, 'derived') : null,
    textObservation('flui.provider.health_status', health?.status, 'api'),
    health ? valueObservation('flui.provider.health_response_time_ms', health.responseTime, 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * A detail page for one real entity (the pattern in §4 of the playbook, same as
 * application-surface.ts): attention always names the provider being managed, reason
 * 'route'. No snapshot at all — not an empty one — when the route's provider id does not
 * resolve to a known provider definition (§8 "no scopes → no snapshot").
 */
export function presentedContent(input: ProviderSurfaceInput): PresentedContent | null {
  const provider = input.provider;
  if (!provider) return null;

  const pageId = `${PAGE_PREFIX}:${provider.id}`;
  const ref = providerEntityRef(provider.id);
  const entities: EntityReference[] = [{ ref, label: provider.displayName, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: provider.displayName,
    entities,
    observations: pageObservations(input),
  };

  return {
    scopes: [pageScope],
    attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
  };
}

export function buildProviderSurface(
  input: ProviderSurfaceInput,
  context: ProviderSurfaceContext,
): SurfaceSnapshot | null {
  const provider = input.provider;
  const content = presentedContent(input);
  if (!provider || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_PREFIX,
      route: `management/providers/${provider.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as ApplicationSurfaceRevision — see application-surface.ts. */
export class ProviderSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
