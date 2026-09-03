import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { MailSuppression } from '../../model/mail-console.models';

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'mail-suppressions';
const LIST_ID = 'mail-suppressions:list';

export interface MailSuppressionsSurfaceInput {
  entries: MailSuppression[];
  shownCount: number;
  loading: boolean;
  hasLoadError: boolean;
}

export interface MailSuppressionsSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function valueObservation(key: string, value: number): Observation {
  return { key, presentedAs: { value }, source: 'derived' };
}

function reasonCounts(entries: MailSuppression[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.reason] = (counts[e.reason] ?? 0) + 1;
  return counts;
}

/**
 * Every entry here is a real end-user recipient email address the user's applications
 * have stopped writing to — not infrastructure identity like a mail connection's sending
 * domain (mail-domains-surface.ts) or a sender's own service address (mail-overview's
 * `from`). Per §8.2 ("unnecessary personal data" MUST NOT enter the snapshot) this
 * producer deliberately emits NO per-row entity and NO address text at all — only the
 * aggregate the page's own header line already states ("N of M"), and a reason
 * breakdown. This is a stricter redaction line than the rest of this wave draws, because
 * nothing about grounding an assistant's answer here requires naming a specific mailbox.
 */
function pageObservations(input: MailSuppressionsSurfaceInput): Observation[] {
  const counts = reasonCounts(input.entries);
  return [
    valueObservation('flui.mail.suppressions.total', input.entries.length),
    ...Object.entries(counts).map(([reason, count]) =>
      valueObservation(`flui.mail.suppressions.reason.${reason}`, count),
    ),
  ];
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: MailSuppressionsSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Suppressions',
    observations: pageObservations(input),
    ...(input.hasLoadError ? { state: { error: true } } : {}),
  };

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    completeness: {
      shown: input.shownCount,
      total: input.entries.length,
      ...(input.shownCount < input.entries.length ? { filtered: true } : {}),
    },
    state: { loading: input.loading, empty: input.entries.length === 0 },
  };

  return {
    scopes: [pageScope, listScope],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildMailSuppressionsSurface(
  input: MailSuppressionsSurfaceInput,
  context: MailSuppressionsSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/mail/suppressions',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class MailSuppressionsSurfaceRevision {
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
