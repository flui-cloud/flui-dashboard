import { MAIL_PROVIDERS, MailIdentityStatus } from '../../model/mail-console.models';

export type MailIdentityTone = 'ok' | 'warn' | 'error' | 'idle';

export interface MailIdentityView {
  tone: MailIdentityTone;
  badge: string;
  provider: string | null;
  note: string | null;
}

const REASONS: Record<string, string> = {
  identity_provider_unreachable: 'Flui has no access to the identity provider.',
  endpoint_unknown: 'The identity provider cannot reach this API.',
  no_transactional_connection: 'Connect a transactional provider first.',
  no_sender: 'Set a sending domain on the transactional provider.',
  sender_not_ready: 'The transactional provider is not ready to send yet.',
  sync_failed: 'The last sync with the identity provider failed.',
};

export function providerName(id: string | null): string | null {
  if (!id) return null;
  return MAIL_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

function latestFailure(status: MailIdentityStatus): string | null {
  if (!status.lastError || !status.lastErrorAt) return null;
  if (!status.lastDeliveryAt) return status.lastError;
  return status.lastErrorAt > status.lastDeliveryAt ? status.lastError : null;
}

export function mailIdentityView(status: MailIdentityStatus): MailIdentityView {
  const provider = providerName(status.mailProvider);
  const reason = status.reason ? (REASONS[status.reason] ?? status.reason) : null;
  switch (status.state) {
    case 'active':
      return {
        tone: 'ok',
        badge: 'Sending',
        provider,
        note: latestFailure(status),
      };
    case 'attention':
      return { tone: 'warn', badge: 'Needs attention', provider, note: reason };
    case 'error':
      return {
        tone: 'error',
        badge: 'Sync failed',
        provider,
        note: status.lastSyncError ?? reason,
      };
    default:
      return { tone: 'idle', badge: 'Not set up', provider, note: reason };
  }
}
