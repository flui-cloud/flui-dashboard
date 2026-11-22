import type { StatusTone } from '../../../ui/primitives/status';
import { ProviderType } from '../../model/cluster.models';

export interface ToneLabel {
  readonly tone: StatusTone;
  readonly label: string;
}

const PROVIDER_LABEL: Partial<Record<ProviderType, string>> = {
  [ProviderType.HETZNER]: 'Hetzner',
  [ProviderType.CONTABO]: 'Contabo',
  [ProviderType.SCALEWAY]: 'Scaleway',
  [ProviderType.OVH]: 'OVH',
};

export function providerLabel(provider?: ProviderType): string {
  return (provider && PROVIDER_LABEL[provider]) || 'Unknown';
}

function sentence(value: string): string {
  const text = value.replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function healthState(status: string): ToneLabel {
  if (status === 'HEALTHY') return { tone: 'success', label: 'Healthy' };
  if (status === 'DEGRADED') return { tone: 'warning', label: 'Degraded' };
  if (status === 'UNKNOWN') return { tone: 'neutral', label: 'Unknown' };
  return { tone: 'error', label: sentence(status) };
}

export function syncState(status: string | null | undefined): ToneLabel {
  if (status === 'IN_SYNC') return { tone: 'success', label: 'In sync' };
  if (status === 'DRIFT') return { tone: 'warning', label: 'Drift' };
  if (status === 'ERROR') return { tone: 'error', label: 'Error' };
  if (!status || status === 'PENDING') return { tone: 'progress', label: 'Pending' };
  return { tone: 'neutral', label: sentence(status) };
}

export function dnsState(status: string | null | undefined): ToneLabel {
  const state = syncState(status);
  return state.tone === 'error' ? { tone: 'warning', label: state.label } : state;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatAge(date?: Date): string {
  if (!date) return '—';
  const target = new Date(date);
  const diffDays = Math.floor((Date.now() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return target.toLocaleDateString();
}

export function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
