import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const PAGE_PREFIX = 'settings';

// The real section set (verified against settings.component.ts's own `sections`/
// `visibleSections`), not the 3 named in the original brief — `agent-keys` and
// `auth-proxy` also exist and are reachable. Anti-drift (§3.4) means the type here
// tracks what the page can actually be showing, not a narrower assumption.
export type SettingsTabId = 'profile' | 'security' | 'agent-keys' | 'auth-proxy' | 'inference-connections';

export interface InferenceConnectionSummary {
  id: string;
  label: string;
  baseUrl: string;
  modelsCount: number;
  isDefault: boolean;
}

export interface SettingsSurfaceInput {
  userId: string | null;
  displayName: string | null;
  email: string | null;
  isAdmin: boolean;
  authMode: string;
  activeTab: SettingsTabId;
  /** Only meaningful (and only read) when activeTab is 'inference-connections'. */
  inferenceConnections: InferenceConnectionSummary[];
}

export interface SettingsSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export function accountEntityRef(userId: string): string {
  return `${SURFACE_NAMESPACE}://identity-user/${userId}`;
}
export function inferenceConnectionEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://inference-connection/${id}`;
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
  value: number | boolean,
  source: ObservationSource,
): Observation {
  return { key, presentedAs: { value }, source };
}

function titleCase(tab: string): string {
  return tab.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Redaction for the page header (playbook §7): `email` here is the *viewer's own*
 * account email, on their own Settings page — not another user's, unlike the Access
 * People tab. Masking a viewer's own email from themselves would be meaningless, so it
 * is presented plainly (no TENANT_IDENTITY precedent needed to justify it — it was
 * never someone else's data). `isAdmin` mirrors the Access producer's own rule: emitted
 * only when true, the same condition that puts the "Admin" badge on screen at all.
 */
function pageObservations(input: SettingsSurfaceInput): Observation[] {
  return [
    textObservation('flui.settings.email', input.email, 'api'),
    textObservation('flui.settings.auth_mode', input.authMode, 'api'),
    input.isAdmin ? valueObservation('flui.settings.is_admin', true, 'api') : null,
  ].filter((o): o is Observation => o !== null);
}

/**
 * Redaction for `security` and `agent-keys`/`auth-proxy` (playbook §7): security-tab.ts
 * is a bare change-password form — current/new/confirm password fields are never
 * populated with a real value and nothing else is rendered, so there is nothing safe
 * *or* unsafe to present beyond the fact that the tab is open. `agent-keys` and
 * `auth-proxy` were verified to exist as real sections but their own content was not
 * read closely enough in this pass to classify field-by-field (agent-keys manages
 * per-agent API keys; auth-proxy configures an OIDC proxy) — per the redaction
 * checklist, an unverified field does not go in, so both get only the tab marker below,
 * nothing from their own state. This is a scoping gap to close in a follow-up, not a
 * silent guess.
 */
function tabObservations(input: SettingsSurfaceInput): Observation[] {
  const marker = textObservation('flui.settings.active_tab', input.activeTab, 'ui');
  return marker ? [marker] : [];
}

interface ConnectionRow {
  ref: string;
  label: string;
  observations: Observation[];
}

/** Redaction, verified against inference-connections.component.ts: the "Add connection"
 * form's API-key field is always blank (a new-secret input, `type="password"`), and
 * InferenceConnectionDto itself never carries a key value — only label/baseUrl/models/
 * isDefault, all already rendered as plain text on the list. Per-connection validation
 * result text is deliberately not carried (free text from a provider round-trip). */
function connectionRow(c: InferenceConnectionSummary): ConnectionRow {
  return {
    ref: inferenceConnectionEntityRef(c.id),
    label: c.label,
    observations: [
      textObservation('flui.settings.connection_base_url', c.baseUrl, 'api'),
      valueObservation('flui.settings.connection_models_count', c.modelsCount, 'api'),
      c.isDefault ? valueObservation('flui.settings.connection_is_default', true, 'api') : null,
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * A detail page for one real entity — the viewer's own account (§4 of the playbook,
 * same pattern as application-surface.ts): `attention` always names it, reason 'route'.
 * No snapshot at all when there is no signed-in user yet to describe (§8, "no scopes →
 * no snapshot").
 */
export function presentedContent(input: SettingsSurfaceInput): PresentedContent | null {
  if (!input.userId) return null;

  const pageId = `${PAGE_PREFIX}:${input.userId}`;
  const ref = accountEntityRef(input.userId);
  const label = input.displayName || input.email || 'Account';
  const entities: EntityReference[] = [{ ref, label, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label,
    entities,
    observations: pageObservations(input),
  };

  const tabId = `${pageId}:tab:${input.activeTab}`;
  const tabScope: SemanticScopeSnapshot = {
    id: tabId,
    parentId: pageId,
    kind: 'region',
    label: titleCase(input.activeTab),
    observations: tabObservations(input),
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, tabScope];

  if (input.activeTab === 'inference-connections') {
    const listId = `${tabId}:list`;
    const rows = input.inferenceConnections.map(connectionRow);
    scopes.push({
      id: listId,
      parentId: tabId,
      kind: 'list',
      completeness: { shown: rows.length, total: rows.length },
      state: { empty: rows.length === 0 },
    });
    scopes.push(
      ...rows.map((row, i) => ({
        id: `${listId}:${input.inferenceConnections[i].id}`,
        parentId: listId,
        kind: 'region' as const,
        entities: [{ ref: row.ref, label: row.label, role: 'related' as const }],
        ...(row.observations.length ? { observations: row.observations } : {}),
      })),
    );
  }

  return {
    scopes,
    attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
  };
}

export function buildSettingsSurface(
  input: SettingsSurfaceInput,
  context: SettingsSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content || !input.userId) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_PREFIX,
      route: 'settings',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as ApplicationSurfaceRevision — see application-surface.ts. */
export class SettingsSurfaceRevision {
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
