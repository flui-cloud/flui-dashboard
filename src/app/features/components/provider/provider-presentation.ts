import type { ProviderDefinitionDto } from '../../../core/api';

export type ProviderTone = 'ok' | 'warn' | 'danger' | 'muted';

export const PROVIDER_DOT: Record<ProviderTone, string> = {
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
};

export const PROVIDER_TEXT: Record<ProviderTone, string> = {
  ok: 'text-green-700 dark:text-green-400',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

export interface ProviderState {
  label: string;
  tone: ProviderTone;
}

export function providerState(status: string | undefined): ProviderState {
  switch (status) {
    case 'active':
      return { label: 'Connected', tone: 'ok' };
    case 'error':
      return { label: 'Needs attention', tone: 'danger' };
    case 'configuring':
      return { label: 'Connecting', tone: 'warn' };
    case 'validating':
      return { label: 'Checking', tone: 'warn' };
    case 'disabled':
      return { label: 'Disabled', tone: 'muted' };
    default:
      return { label: 'Not connected', tone: 'muted' };
  }
}

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  providerLabel: string;
  hint?: string;
  secret: boolean;
  required: boolean;
}

export interface CredentialSchema {
  type?: string;
  supportsExpiry?: boolean;
  fields?: CredentialFieldDefinition[];
}

export function credentialSchema(provider: ProviderDefinitionDto): CredentialSchema | undefined {
  return (provider as unknown as { credentialFields?: CredentialSchema }).credentialFields;
}

/** What the provider asks for, as its own form declares it before the older capability flag. */
export function credentialKind(provider: ProviderDefinitionDto): string | undefined {
  return credentialSchema(provider)?.type ?? (provider.capabilities?.credentialType as string | undefined);
}

export function credentialKindLabel(kind: string | undefined): string {
  switch (kind) {
    case 'api_key':
      return 'API token';
    case 'access_key_secret':
      return 'Key and secret';
    case 'bearer_token':
      return 'Bearer token';
    case 'user_password':
      return 'User and password';
    case 'ssh':
      return 'SSH';
    default:
      return kind ?? '';
  }
}

export interface ProviderCapabilityItem {
  key: string;
  label: string;
  hint: string;
  on: boolean;
}

export function providerCapabilities(provider: ProviderDefinitionDto): ProviderCapabilityItem[] {
  const features = provider.capabilities?.features;
  if (!features) return [];
  const edge = !!provider.capabilities?.firewall?.managedEdge;
  return [
    {
      key: 'machines',
      label: 'Machines on demand',
      hint: 'Flui creates and removes machines on this provider for you.',
      on: !!features.nodeProvisioning,
    },
    {
      key: 'network',
      label: 'Private network',
      hint: 'Machines talk to each other over the provider’s private network.',
      on: !!features.privateNetworking,
    },
    {
      key: 'firewall',
      label: 'Edge firewall',
      hint: edge
        ? 'Firewall rules are applied at the provider, in front of the machines.'
        : 'Firewall rules are applied on each machine instead.',
      on: edge,
    },
    {
      key: 'dns',
      label: 'DNS zones',
      hint: 'Domains can be delegated to the provider’s DNS.',
      on: !!features.dnsZones,
    },
    {
      key: 'loadBalancers',
      label: 'Load balancers',
      hint: 'The provider offers managed load balancers.',
      on: !!features.loadBalancers,
    },
    {
      key: 'snapshots',
      label: 'Snapshots',
      hint: 'Machine snapshots at the provider.',
      on: !!features.snapshots,
    },
    {
      key: 'backups',
      label: 'Backups',
      hint: 'Backups of what runs on this provider.',
      on: !!features.backups,
    },
  ];
}

/** Where a guest who has walked the whole connection goes to do it for real. */
export const GET_FLUI_RUNNING_URL = 'https://docs.flui.cloud/tasks/get-flui-running/';
