import { StatusTone as KitTone } from '../../../ui/primitives/status';
import { HopCheck } from './topology-drills';
import { StatusTone, toneOf } from './topology-format';
import { ClusterConnection, NetworkKind } from './topology-tiles';

const KIT: Record<StatusTone, KitTone> = {
  healthy: 'success',
  degraded: 'warning',
  error: 'error',
  pending: 'neutral',
};

const WORD: Record<StatusTone, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
  pending: 'Pending',
};

export function kitTone(tone: string | null | undefined): KitTone {
  return KIT[tone as StatusTone] ?? 'neutral';
}

export function kitToneOfStatus(status: string | null | undefined): KitTone {
  return KIT[toneOf(status)];
}

export function toneWord(tone: string | null | undefined): string {
  return WORD[tone as StatusTone] ?? 'Pending';
}

const NETWORK: Record<NetworkKind, KitTone> = {
  flui: 'success',
  'flui-waiting': 'warning',
  private: 'neutral',
  public: 'neutral',
};

export function networkTone(kind: NetworkKind): KitTone {
  return NETWORK[kind];
}

const CONNECTION: Record<ClusterConnection['kind'], KitTone> = {
  tunnel: 'success',
  'public-address': 'warning',
  off: 'neutral',
};

export function connectionTone(kind: ClusterConnection['kind']): KitTone {
  return CONNECTION[kind];
}

const CHECK: Record<HopCheck, KitTone> = {
  ok: 'success',
  warn: 'warning',
  fail: 'error',
};

export function checkTone(check: HopCheck): KitTone {
  return CHECK[check];
}
