import type { StatusTone } from '../../../ui/primitives/status';
import type { CredentialFieldDefinition } from './provider-presentation';

export function fallbackCredentialFields(
  type: string | undefined,
  providerName: string,
): CredentialFieldDefinition[] {
  switch (type) {
    case 'api_key':
      return [
        {
          key: 'apiKey',
          label: 'API Token',
          providerLabel: 'API Token',
          hint: `Your ${providerName} API token`,
          secret: true,
          required: true,
        },
      ];
    case 'bearer_token':
      return [
        {
          key: 'bearerToken',
          label: 'Bearer Token',
          providerLabel: 'Bearer Token',
          hint: `Your ${providerName} bearer token`,
          secret: true,
          required: true,
        },
      ];
    case 'user_password':
      return [
        {
          key: 'clientId',
          label: 'Client ID',
          providerLabel: 'Client ID',
          secret: false,
          required: true,
        },
        {
          key: 'clientSecret',
          label: 'Client Secret',
          providerLabel: 'Client Secret',
          secret: true,
          required: true,
        },
        {
          key: 'username',
          label: 'Username',
          providerLabel: 'Username',
          secret: false,
          required: true,
        },
        {
          key: 'password',
          label: 'Password',
          providerLabel: 'Password',
          secret: true,
          required: true,
        },
      ];
    case 'access_key_secret':
      return [
        {
          key: 'accessKey',
          label: 'Access Key ID',
          providerLabel: 'Access Key ID',
          hint: `Your ${providerName} Access Key ID`,
          secret: false,
          required: true,
        },
        {
          key: 'secretKey',
          label: 'Secret Key',
          providerLabel: 'Secret Key',
          hint: `Your ${providerName} Secret Key`,
          secret: true,
          required: true,
        },
      ];
    default:
      return [];
  }
}

export function savedCredentialLabel(type: string | undefined): string {
  switch (type) {
    case 'api_key':
      return 'API key';
    case 'access_key_secret':
      return 'Access key and secret';
    case 'bearer_token':
      return 'Bearer token';
    case 'user_password':
      return 'Username and password';
    default:
      return type ?? 'Unknown';
  }
}

export function expiryDaysLeft(expiresAt: string | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  return Number.isNaN(diff) ? null : Math.ceil(diff / 86400000);
}

export function expiryRelativeLabel(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `expired ${-days} day${-days === 1 ? '' : 's'} ago`;
  if (days === 0) return 'expires today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function expiryTone(days: number | null): StatusTone {
  if (days === null) return 'neutral';
  if (days < 0) return 'error';
  if (days <= 14) return 'warning';
  return 'success';
}

export function dateInputValue(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

export function errorMessageOf(error: unknown, fallback: string): string {
  const e = error as { error?: { message?: string }; message?: string } | undefined;
  return e?.error?.message ?? e?.message ?? fallback;
}
