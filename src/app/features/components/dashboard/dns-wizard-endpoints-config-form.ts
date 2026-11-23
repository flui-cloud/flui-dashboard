import { DirectEndpointRow } from './dns-setup-wizard.service';

export type HostnameMode = 'ip' | 'domain';

export interface RowForm {
  readonly hostnameMode: HostnameMode;
  readonly prefix: string;
  readonly prefixError: string | null;
  readonly domain: string;
  readonly domainError: string | null;
  readonly dnsChecking: boolean;
  readonly dnsOk: boolean | null;
  readonly dnsResolved: readonly string[];
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateDomain(value: string): string | null {
  const labels = value.split('.');
  if (labels.length < 2) return 'Must contain at least one dot (e.g. example.com)';
  for (const label of labels) {
    if (!label) return 'Cannot have empty parts';
    if (!LABEL_RE.test(label)) {
      return `"${label}" is invalid: letters, numbers and hyphens only`;
    }
  }
  return null;
}

export function validatePrefix(value: string): string | null {
  for (const label of value.split('.')) {
    if (!label) return 'Cannot have empty parts';
    if (label.length > 63) return 'Each part must be 63 characters or fewer';
    if (!LABEL_RE.test(label)) return 'Letters, numbers, hyphens and dots only';
  }
  return null;
}

export function emptyRowForm(initial?: Partial<RowForm>): RowForm {
  return {
    hostnameMode: initial?.hostnameMode ?? 'ip',
    prefix: initial?.prefix ?? '',
    prefixError: null,
    domain: initial?.domain ?? '',
    domainError: null,
    dnsChecking: false,
    dnsOk: null,
    dnsResolved: [],
  };
}

export function initialRowForm(row: DirectEndpointRow, masterIp: string): RowForm {
  const hostnameMode: HostnameMode = row.draftHostnameMode || (masterIp ? 'ip' : 'domain');
  let prefix = row.draftPrefix;
  let domain = '';
  if (hostnameMode === 'domain' && row.draftFqdn) {
    const dot = row.draftFqdn.indexOf('.');
    if (dot > 0) {
      prefix = row.draftFqdn.slice(0, dot);
      domain = row.draftFqdn.slice(dot + 1);
    } else {
      prefix = row.draftFqdn;
    }
  }
  return emptyRowForm({ hostnameMode, prefix: prefix || row.slug, domain });
}

export function canSaveRowForm(f: RowForm, masterIp: string): boolean {
  if (f.hostnameMode === 'ip') return !!f.prefix.trim() && !f.prefixError && !!masterIp;
  return (
    !!f.prefix.trim() && !f.prefixError && !!f.domain.trim() && !f.domainError && !f.dnsChecking
  );
}
