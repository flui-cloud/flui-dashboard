export type CpuUnit = 'm' | 'cores';
export type MemoryUnit = 'Mi' | 'Gi';

export interface CpuAmount {
  amount: number;
  unit: CpuUnit;
}

export interface MemoryAmount {
  amount: number;
  unit: MemoryUnit;
}

const BYTES_PER: Record<string, number> = {
  '': 1,
  m: 0.001,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
};

export function cpuMillicores(quantity: string | null | undefined): number | null {
  const match = /^(\d+(?:\.\d+)?)(m?)$/.exec((quantity ?? '').trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Math.ceil(match[2] === 'm' ? value : value * 1000);
}

export function memoryMi(quantity: string | null | undefined): number | null {
  const match = /^(\d+(?:\.\d+)?)(m|k|Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec((quantity ?? '').trim());
  if (!match) return null;
  return Math.ceil((Number(match[1]) * BYTES_PER[match[2] ?? '']) / 1024 ** 2 - 1e-9);
}

export function splitCpu(quantity: string | null | undefined): CpuAmount | null {
  const mc = cpuMillicores(quantity);
  if (mc === null) return null;
  return mc >= 1000 && mc % 100 === 0
    ? { amount: mc / 1000, unit: 'cores' }
    : { amount: mc, unit: 'm' };
}

export function splitMemory(quantity: string | null | undefined): MemoryAmount | null {
  const mi = memoryMi(quantity);
  if (mi === null) return null;
  return mi >= 1024 && mi % 256 === 0
    ? { amount: mi / 1024, unit: 'Gi' }
    : { amount: mi, unit: 'Mi' };
}

export function joinCpu(amount: number, unit: CpuUnit): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const mc = Math.ceil(unit === 'm' ? amount : amount * 1000 - 1e-9);
  if (mc < 1) return null;
  return mc % 1000 === 0 ? `${mc / 1000}` : `${mc}m`;
}

export function joinMemory(amount: number, unit: MemoryUnit): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const mi = Math.ceil(unit === 'Gi' ? amount * 1024 - 1e-9 : amount - 1e-9);
  if (mi < 1) return null;
  return mi % 1024 === 0 ? `${mi / 1024}Gi` : `${mi}Mi`;
}

export function readableCpu(quantity: string | null | undefined): string {
  const mc = cpuMillicores(quantity);
  if (mc === null) return '—';
  if (mc < 1000) return `${mc}m`;
  const cores = mc / 1000;
  return `${Number.parseFloat(cores.toFixed(2))} core${cores === 1 ? '' : 's'}`;
}

export function readableMemory(quantity: string | null | undefined): string {
  const mi = memoryMi(quantity);
  if (mi === null) return '—';
  if (mi < 1024) return `${mi} MiB`;
  return `${Number.parseFloat((mi / 1024).toFixed(2))} GiB`;
}
