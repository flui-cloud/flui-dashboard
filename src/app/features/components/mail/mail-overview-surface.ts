import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { MailDomainSummary, MailKpi, MailOverview, MailWindow } from '../../model/mail-console.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'mail-overview';
const DOMAINS_LIST_ID = 'mail-overview:domains';
const MAX_ROWS = 50;

export function mailDomainEntityRef(domain: string): string {
  return `${SURFACE_NAMESPACE}://mail-domain/${encodeURIComponent(domain)}`;
}

export interface MailOverviewSurfaceInput {
  overview: MailOverview | null;
  window: MailWindow;
  loading: boolean;
  hasLoadError: boolean;
}

export interface MailOverviewSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number | boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function kpiObservations(kpis: MailKpi[]): Observation[] {
  // Only the count is a compact scalar worth carrying per KPI; `rate`/`delta`/`previous*`
  // are secondary presentation detail already derivable from the count series and would
  // bloat every snapshot for little grounding value (§9).
  return kpis.map((k) => valueObservation(`flui.mail.kpi.${k.id}`, k.count, 'api'));
}

function pageObservations(o: MailOverview, window: MailWindow): Observation[] {
  return [
    textObservation('flui.mail.window', window, 'ui'),
    textObservation('flui.mail.active_provider', o.provider, 'api'),
    ...kpiObservations(o.kpis),
    o.unregisteredDomains.length
      ? valueObservation('flui.mail.unregistered_domains_count', o.unregisteredDomains.length, 'derived')
      : null,
    // `incident.detail` is shown on screen but is provider-originated technical text
    // (font-mono in the template) — same exclusion as raw error text elsewhere in this
    // wave; the incident's kind/title/since are curated, product-owned copy and safe.
    o.incident ? textObservation('flui.mail.incident_kind', o.incident.kind, 'api') : null,
    o.incident ? textObservation('flui.mail.incident_title', o.incident.title, 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function domainRowScope(d: MailDomainSummary): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: mailDomainEntityRef(d.domain), label: d.domain, role: 'related' };
  return {
    id: `${DOMAINS_LIST_ID}:${d.domain}`,
    parentId: DOMAINS_LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: [
      valueObservation('flui.mail.domain.verified', d.verified, 'api'),
      valueObservation('flui.mail.domain.sent', d.sent, 'api'),
    ],
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: MailOverviewSurfaceInput): PresentedContent {
  const o = input.overview;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Mail',
    ...(o ? { observations: pageObservations(o, input.window) } : {}),
    state: { loading: input.loading, ...(input.hasLoadError ? { error: true } : {}), empty: !o },
  };

  if (!o) {
    return { scopes: [pageScope], attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
  }

  const allDomains = o.domains;
  const domainRows = allDomains.slice(0, MAX_ROWS);
  const domainsListScope: SemanticScopeSnapshot = {
    id: DOMAINS_LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Domains',
    completeness: {
      shown: domainRows.length,
      total: allDomains.length,
      ...(allDomains.length > domainRows.length ? { truncated: true } : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [
    pageScope,
    ...(allDomains.length ? [domainsListScope, ...domainRows.map(domainRowScope)] : []),
  ];

  return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
}

export function buildMailOverviewSurface(
  input: MailOverviewSurfaceInput,
  context: MailOverviewSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/mail/overview',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class MailOverviewSurfaceRevision {
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
