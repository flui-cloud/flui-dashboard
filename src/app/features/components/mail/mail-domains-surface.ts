import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { MailDomainProofs } from '../../model/mail-console.models';
import { mailDomainEntityRef } from './mail-overview-surface';

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'mail-domains';
const LIST_ID = 'mail-domains:list';
const MAX_ROWS = 50;

export { mailDomainEntityRef };

export interface MailDomainsSurfaceInput {
  domains: MailDomainProofs[];
  loading: boolean;
  hasLoadError: boolean;
}

export interface MailDomainsSurfaceContext {
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

// This page's inline widgets (compose-a-test-message, connection setup DNS steps) carry
// recipient addresses and DNS record values mid-draft — intentionally left off this row:
// same exclusion as an in-progress wizard field (see github-setup-wizard-surface.ts).
function rowObservations(d: MailDomainProofs): Observation[] {
  return [
    textObservation('flui.mail.domain.provider', d.provider, 'api'),
    textObservation('flui.mail.domain.scope', d.scope, 'api'),
    valueObservation('flui.mail.domain.active', d.active, 'api'),
    valueObservation('flui.mail.domain.verified', d.verified, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(d: MailDomainProofs): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: mailDomainEntityRef(d.domain), label: d.domain, role: 'related' };
  return {
    id: `${LIST_ID}:${d.domain}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(d),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: MailDomainsSurfaceInput): PresentedContent {
  const all = input.domains;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Sending domains',
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

export function buildMailDomainsSurface(
  input: MailDomainsSurfaceInput,
  context: MailDomainsSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/mail/domains',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class MailDomainsSurfaceRevision {
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
