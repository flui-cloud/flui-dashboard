import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';

const PROFILE_META: Record<string, { label: string; description: string }> = {
  nano: {
    label: 'Nano',
    description: 'Lightweight proxies and static sites (nginx, caddy, haproxy)',
  },
  small: { label: 'Small', description: 'Simple apps, REST microservices, lightweight tools' },
  medium: { label: 'Medium', description: 'WordPress, Node.js, PHP apps, CMS' },
  large: { label: 'Large', description: 'Databases (Postgres, MySQL, Redis), Java apps' },
  xlarge: { label: 'XLarge', description: 'Elasticsearch, Kafka, MongoDB, heavy workloads' },
};

type QuantityShape = Record<string, string | undefined>;

function quantity(value: unknown, key: string): string {
  if (typeof value === 'string') return value;
  const v = (value ?? {}) as QuantityShape;
  return v[key] ?? v['requests'] ?? v['limit'] ?? v['value'] ?? '—';
}

export function profileLabel(name: string): string {
  return PROFILE_META[name]?.label ?? name;
}

export function profileDescription(name: string): string {
  return PROFILE_META[name]?.description ?? '';
}

export function profileCpu(profile: ResourceProfileDto): string {
  return quantity(profile.cpu, 'cpu');
}

export function profileMemory(profile: ResourceProfileDto): string {
  return quantity(profile.memory, 'memory');
}
