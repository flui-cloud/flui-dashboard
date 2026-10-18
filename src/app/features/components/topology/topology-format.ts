export type StatusTone = 'healthy' | 'degraded' | 'error' | 'pending';

const TONE: Record<string, StatusTone> = {
  running: 'healthy',
  healthy: 'healthy',
  warning: 'degraded',
  degraded: 'degraded',
  error: 'error',
  down: 'error',
  stopped: 'pending',
};

export function toneOf(status: string | null | undefined): StatusTone {
  return TONE[status ?? ''] ?? 'pending';
}

const LABEL: Record<string, string> = {
  running: 'Running',
  healthy: 'Healthy',
  warning: 'Warning',
  degraded: 'Degraded',
  error: 'Error',
  down: 'Down',
  stopped: 'Stopped',
};

export function statusLabel(status: string | null | undefined): string {
  return LABEL[status ?? ''] ?? 'Unknown';
}

export function memory(mi: number): string {
  if (mi < 1024) return `${Math.round(mi)} MB`;
  const digits = mi >= 10_240 ? 0 : 1;
  return `${(mi / 1024).toFixed(digits)} GB`;
}

export function cpu(millicores: number): string {
  return millicores >= 1000 ? `${(millicores / 1000).toFixed(1)} vCPU` : `${millicores}m`;
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
}

export function rps(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value >= 10 ? `${Math.round(value)} req/s` : `${value.toFixed(1)} req/s`;
}

export function overlayLabel(overlay: string): string {
  if (overlay === 'tunnel') return 'Flui network';
  if (overlay === 'public-address') return 'Public address';
  return 'Flui network off';
}

const CATEGORY: Record<string, string> = {
  database: 'Database',
  cache: 'Cache',
  storage: 'Storage',
  automation: 'Automation',
  media: 'Media',
  monitoring: 'Monitoring',
  web: 'Web app',
  business: 'Business app',
  infra: 'Infrastructure',
};

export function categoryLabel(category: string | null | undefined): string {
  return CATEGORY[category ?? ''] ?? 'App';
}
