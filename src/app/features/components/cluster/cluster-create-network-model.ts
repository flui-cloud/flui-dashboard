import { SubnetInfo, subnetServesRegion } from '../../model/vnet.models';

export interface SubnetPrefixRange {
  readonly minPrefix: number;
  readonly maxPrefix: number;
}

/** Nodes get their private address from an IPv4 subnet; an IPv6-only one cannot carry them. */
export function isIpv4Subnet(ipRange: string | null | undefined): boolean {
  return !!ipRange && !ipRange.includes(':');
}

export function isSubnetUsable(subnet: SubnetInfo, region: string): boolean {
  return isIpv4Subnet(subnet.ipRange) && subnetServesRegion(subnet, region);
}

/** IPv4 first, then by range: the same order on every visit. */
export function orderSubnets(subnets: readonly SubnetInfo[]): SubnetInfo[] {
  return [...subnets].sort(
    (a, b) =>
      Number(isIpv4Subnet(b.ipRange)) - Number(isIpv4Subnet(a.ipRange)) ||
      a.ipRange.localeCompare(b.ipRange),
  );
}

export function deriveSubnetCidr(
  vnetIpRange: string,
  constraints: SubnetPrefixRange | null,
  existingSubnets: number,
): string | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(vnetIpRange);
  if (!m) return undefined;
  const vnetPrefix = Number.parseInt(m[5], 10);
  let prefix = Math.max(24, vnetPrefix);
  if (constraints)
    prefix = Math.min(Math.max(prefix, constraints.minPrefix), constraints.maxPrefix);
  const idx = prefix >= 24 ? existingSubnets : 0;
  return `${m[1]}.${m[2]}.${idx}.0/${prefix}`;
}

export function isValidSubnetCidr(value: string, constraints: SubnetPrefixRange | null): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
  if (!cidrRegex.test(value)) return false;
  const prefix = Number.parseInt(value.split('/')[1], 10);
  if (prefix < 0 || prefix > 32) return false;
  if (constraints && (prefix < constraints.minPrefix || prefix > constraints.maxPrefix))
    return false;
  return true;
}
