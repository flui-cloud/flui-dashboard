import {
  MAIL_PROVIDERS,
  MailConnection,
  MailConnectionConfig,
  MailDomainProofs,
  MailProviderId,
  MailProviderProfile,
  MailScope,
} from '../../model/mail-console.models';

export interface MailScopeSlot {
  id: MailScope;
  title: string;
  blurb: string;
}

export const MAIL_SCOPE_SLOTS: MailScopeSlot[] = [
  {
    id: 'transactional',
    title: 'Transactional',
    blurb:
      'One message, to one person, because they did something. Password resets, invites, receipts.',
  },
  {
    id: 'bulk',
    title: 'Bulk',
    blurb:
      'One message to many. Newsletters, announcements — anything someone subscribed to, whether or not it sells something.',
  },
];

export function rowsFor(connections: MailConnection[], scope: MailScope): MailConnection[] {
  return connections
    .filter((c) => c.scope === scope)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

export function activeIn(
  connections: MailConnection[],
  scope: MailScope,
): MailConnection | undefined {
  return connections.find((c) => c.scope === scope && c.isActive);
}

export function holdsScope(
  connections: MailConnection[],
  scope: MailScope,
): MailConnection | undefined {
  const active = activeIn(connections, scope);
  return active && !active.implicit ? active : undefined;
}

export function connectLabel(connections: MailConnection[], scope: MailScope): string {
  const active = activeIn(connections, scope);
  if (!active) return 'Connect a provider';
  return active.implicit ? 'Set up a sending domain' : 'Add another provider';
}

export function providersFor(scope: MailScope): MailProviderProfile[] {
  return MAIL_PROVIDERS.filter((p) => p.scopes.includes(scope));
}

export function blindSpotOf(provider: MailProviderId): string {
  return MAIL_PROVIDERS.find((p) => p.id === provider)?.blindSpot ?? '';
}

export function providerLabel(provider: MailProviderId): string {
  return MAIL_PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
}

export function pushes(provider: MailProviderId): boolean {
  return provider === 'brevo' || provider === 'zeptomail';
}

export function suggestions(
  connections: MailConnection[],
  known: MailDomainProofs[],
  provider: MailProviderId,
): MailDomainProofs[] {
  const connected = connections.some((c) => c.provider === provider && c.isActive);
  return connected ? known : [];
}

export function configText(config: MailConnectionConfig, key: keyof MailConnectionConfig): string {
  const value = config[key];
  return value === undefined ? '' : String(value);
}

export function withConfig(
  config: MailConnectionConfig,
  key: keyof MailConnectionConfig,
  value: unknown,
): MailConnectionConfig {
  const next = { ...config } as Record<string, unknown>;
  if (value === '' || value === false || value === null || value === undefined) {
    delete next[key];
  } else {
    next[key] = key === 'port' ? Number(value) : value;
  }
  return next as MailConnectionConfig;
}
