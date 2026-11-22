import { StatusTone } from '../../../ui/primitives/status';

export interface MailDnsRecord {
  name: string;
  kind: string;
  value: string;
  purpose: string;
  live?: boolean;
  accepted?: boolean;
}

const PURPOSE_LABEL: Record<string, string> = {
  spf: 'SPF',
  dkim: 'DKIM',
  dmarc: 'DMARC',
  mx: 'MX',
};

export function recordPurpose(record: MailDnsRecord): string {
  return PURPOSE_LABEL[record.purpose?.toLowerCase()] ?? record.purpose;
}

export function mxParts(record: MailDnsRecord): { priority: string; host: string } | null {
  if (record.kind !== 'MX') return null;
  const value = record.value.trim();
  const gap = value.search(/\s/);
  if (gap <= 0) return null;
  const priority = value.slice(0, gap);
  const host = value.slice(gap).trim();
  return /^\d+$/.test(priority) && host ? { priority, host } : null;
}

export function recordCaution(record: MailDnsRecord): string | null {
  const value = record.value.toLowerCase();

  if (record.kind === 'MX') {
    return (
      'This MX discards inbound mail — it exists so the domain can send, not receive. ' +
      'Publishing it on a domain that currently receives email will silently stop delivery ' +
      'to those mailboxes. Only add it if nothing reads mail at this domain.'
    );
  }

  if (record.purpose?.toLowerCase() === 'dmarc' && /p=(quarantine|reject)/.test(value)) {
    const policy = /p=reject/.test(value) ? 'reject' : 'quarantine';
    return (
      `This DMARC policy is \`p=${policy}\`, not \`p=none\`: receivers will act on failures ` +
      'immediately rather than only reporting them. If anything else sends as this domain and ' +
      'is not covered by the SPF and DKIM above, its mail starts being filtered the moment ' +
      'this is published.'
    );
  }

  return null;
}

export function recordStatus(record: MailDnsRecord): { tone: StatusTone; label: string } {
  if (record.live === undefined) return { tone: 'neutral', label: 'To publish' };
  if (!record.live) return { tone: 'warning', label: 'Not in DNS yet' };
  if (record.accepted === true) return { tone: 'success', label: 'Accepted' };
  if (record.accepted === false) return { tone: 'progress', label: 'Waiting for the provider' };
  return { tone: 'success', label: 'Resolving' };
}
