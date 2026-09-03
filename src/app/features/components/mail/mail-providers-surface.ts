import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { MailConnection } from '../../model/mail-console.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'mail-providers';
const LIST_ID = 'mail-providers:list';
const MAX_ROWS = 50;

export function mailConnectionEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://mail-connection/${id}`;
}

export interface MailProvidersSurfaceInput {
  connections: MailConnection[];
  loading: boolean;
  hasLoadError: boolean;
}

export interface MailProvidersSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

/**
 * `MailConnection` never carries the secret itself — only `hasCredential` (a boolean the
 * template's dot/badge already renders) — so there is nothing to redact here, unlike the
 * "connect a new provider" panel on this same page, which asks for the secret/API key/SMTP
 * config as in-progress form fields and is deliberately not read by this producer at all
 * (same exclusion as an in-progress wizard step, see github-setup-wizard-surface.ts).
 */
function rowObservations(c: MailConnection): Observation[] {
  return [
    textObservation('flui.mail.connection.provider', c.provider, 'api'),
    textObservation('flui.mail.connection.scope', c.scope, 'api'),
    textObservation('flui.mail.connection.sending_domain', c.sendingDomain, 'api'),
    valueObservation('flui.mail.connection.active', c.isActive, 'api'),
    valueObservation('flui.mail.connection.has_credential', c.hasCredential, 'api'),
    valueObservation('flui.mail.connection.webhook_registered', c.webhookRegistered, 'api'),
    valueObservation('flui.mail.connection.implicit', c.implicit, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(c: MailConnection): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: mailConnectionEntityRef(c.id), label: c.label, role: 'related' };
  return {
    id: `${LIST_ID}:${c.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(c),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: MailProvidersSurfaceInput): PresentedContent {
  const all = input.connections;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Mail providers',
    ...(input.hasLoadError ? { state: { error: true } } : {}),
  };

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    completeness: {
      shown: rows.length,
      total: all.length,
      ...(all.length > rows.length ? { truncated: true } : {}),
    },
    state: { loading: input.loading, empty: rows.length === 0 },
  };

  return {
    scopes: [pageScope, listScope, ...rows.map(rowScope)],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildMailProvidersSurface(
  input: MailProvidersSurfaceInput,
  context: MailProvidersSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/mail/providers',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class MailProvidersSurfaceRevision {
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
