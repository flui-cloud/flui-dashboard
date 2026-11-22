const CIDR = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;

export interface PrefixRange {
  readonly minPrefix: number;
  readonly maxPrefix: number;
}

export function cidrAddressLabel(value: string): string | null {
  if (!value || !CIDR.test(value)) return null;
  const [ipPart, prefixStr] = value.split('/');
  const prefix = Number.parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 32) return null;
  const count = Math.pow(2, 32 - prefix);
  const parts = ipPart.split('.').map(Number);
  const base = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const first = (base & mask) >>> 0;
  const last = (first | (~mask >>> 0)) >>> 0;
  const toIp = (n: number) =>
    `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
  const countLabel =
    count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count.toLocaleString();
  return `${countLabel} addresses · ${toIp(first)}–${toIp(last)}`;
}

export function cidrPrefixError(
  value: string,
  constraints: PrefixRange | null,
  example: string,
): string {
  if (!value) return '';
  if (!CIDR.test(value)) return `Enter a valid CIDR (e.g., ${example})`;
  const prefix = Number.parseInt(value.split('/')[1], 10);
  if (constraints && (prefix < constraints.minPrefix || prefix > constraints.maxPrefix)) {
    return `Prefix must be /${constraints.minPrefix}–/${constraints.maxPrefix} for this provider`;
  }
  return '';
}
