import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * CIDR Validation Utilities
 *
 * Provides validation for IPv4 and IPv6 CIDR notation.
 * Supports both single CIDR and comma-separated CIDR lists.
 */

// IPv4 CIDR regex: matches 0-255.0-255.0-255.0-255/0-32
const IPV4_CIDR_REGEX =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\/(\d|[12]\d|3[0-2])$/;

// IPv6 CIDR regex (simplified, accepts standard notation)
const IPV6_CIDR_REGEX =
  /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/(\d|[1-9]\d|1[01]\d|12[0-8])$/;

/**
 * Validate a single CIDR string.
 *
 * @param cidr - CIDR string to validate (e.g., "192.168.1.0/24")
 * @returns true if valid IPv4 or IPv6 CIDR, false otherwise
 *
 * @example
 * validateCIDR("192.168.1.0/24")  // true
 * validateCIDR("10.0.0.5/32")     // true
 * validateCIDR("192.168.1.0")     // false (missing /prefix)
 * validateCIDR("192.168.1.0/33")  // false (invalid prefix)
 */
export function validateCIDR(cidr: string): boolean {
  if (!cidr?.trim()) {
    return false;
  }

  const trimmed = cidr.trim();
  return IPV4_CIDR_REGEX.test(trimmed) || IPV6_CIDR_REGEX.test(trimmed);
}

/**
 * Validate a comma-separated list of CIDRs.
 *
 * @param cidrs - Comma-separated CIDR list (e.g., "192.168.1.0/24, 10.0.0.5/32")
 * @returns Object with validation result and list of invalid CIDRs
 *
 * @example
 * validateCIDRList("192.168.1.0/24, 10.0.0.5/32")
 * // { valid: true, invalidCidrs: [] }
 *
 * validateCIDRList("192.168.1.0/24, invalid, 10.0.0.5/32")
 * // { valid: false, invalidCidrs: ["invalid"] }
 */
export function validateCIDRList(cidrs: string): {
  valid: boolean;
  invalidCidrs: string[];
} {
  if (!cidrs?.trim()) {
    return { valid: true, invalidCidrs: [] };
  }

  const cidrArray = cidrs
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const invalidCidrs = cidrArray.filter((cidr) => !validateCIDR(cidr));

  return {
    valid: invalidCidrs.length === 0,
    invalidCidrs,
  };
}

/**
 * Angular custom validator for CIDR lists.
 * Use with reactive forms to validate comma-separated CIDR inputs.
 *
 * @returns ValidatorFn that returns validation errors or null
 *
 * @example
 * this.form = this.fb.group({
 *   sourceCidrs: ['', [Validators.required, cidrListValidator()]]
 * });
 *
 * // In template:
 * @if (form.get('sourceCidrs')?.errors?.['invalidCidrs']) {
 *   <p class="error">
 *     Invalid CIDRs: {{ form.get('sourceCidrs')?.errors?.['invalidCidrs'].join(', ') }}
 *   </p>
 * }
 */
export function cidrListValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Don't validate empty values (use Validators.required for that)
    }

    const result = validateCIDRList(control.value);
    return result.valid ? null : { invalidCidrs: result.invalidCidrs };
  };
}

const IPV4_OCTET = String.raw`(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const IPV4_ADDRESS_REGEX = new RegExp(String.raw`^${IPV4_OCTET}(\.${IPV4_OCTET}){3}$`);

function isIpv6Address(value: string): boolean {
  if (!value.includes(':') || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/**
 * A single IPv4/IPv6 address or CIDR range, the same rule the API applies to a
 * route's IP filter: one invalid entry makes the proxy drop the whole route.
 */
export function isAddressOrCidr(value: string): boolean {
  const parts = value.trim().split('/');
  if (parts.length > 2) return false;
  const v4 = IPV4_ADDRESS_REGEX.test(parts[0]);
  const v6 = !v4 && isIpv6Address(parts[0]);
  if (!v4 && !v6) return false;
  if (parts.length === 1) return true;
  if (!/^\d{1,3}$/.test(parts[1])) return false;
  return Number(parts[1]) <= (v4 ? 32 : 128);
}
