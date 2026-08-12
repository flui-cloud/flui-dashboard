export type MailWindow = '24h' | '7d' | '14d' | '30d';

export const MAIL_WINDOWS: readonly { value: MailWindow; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
];

export type MailTone = 'neutral' | 'warn' | 'bad';
export type RecordVerdict = 'ok' | 'missing' | 'mismatch' | 'pending';
export type MailKpiId = 'sent' | 'delivered' | 'bounced' | 'complained';
export type MailSenderStatus = 'delivering' | 'degraded' | 'failing' | 'silent';
export type MailEventKind =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'deferred'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'canceled';

export interface MailKpi {
  id: MailKpiId;
  count: number;
  rate: number | null;
  previousCount: number;
  previousRate: number | null;
  delta: number | null;
  tone: MailTone;
}

export interface MailVolumePoint {
  at: string;
  delivered: number;
  failed: number;
  pending: number;
}

export interface MailDomainSummary {
  domain: string;
  spf?: RecordVerdict;
  dkim?: RecordVerdict;
  dmarc?: RecordVerdict;
  verified: boolean;
  sent: number;
}

export interface MailIdentity {
  applicationId: string;
  applicationName: string;
  address: string;
}

export interface MailSenderSummary {
  from: string;
  domain: string;
  application: MailIdentity | null;
  sent: number;
  delivered: number;
  failed: number;
  deliveredRate: number | null;
  lastError: string | null;
  lastErrorAt: string | null;
  lastSentAt: string | null;
  lastDeliveredAt: string | null;
  status: MailSenderStatus;
}

export interface MailIncident {
  kind: 'sender-down' | 'domain-broken' | 'complaint-rate';
  title: string;
  detail: string;
  subject: string;
  since: string | null;
}

export interface MailOverview {
  provider: string | null;
  window: { from: string; to: string; name: MailWindow };
  bucket: 'hour' | 'day';

  limitation?: string;

  incident: MailIncident | null;
  kpis: MailKpi[];
  volume: MailVolumePoint[];
  domains: MailDomainSummary[];
  senders: MailSenderSummary[];
  unregisteredDomains: string[];
}

export interface MailDeliveryEvent {
  kind: MailEventKind;
  provider: string;
  messageId: string;
  recipient: string;
  from?: string;
  at: string;
  reason?: string;
  code?: number;
  subject?: string;
}

export interface MailSuppression {
  address: string;
  reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
  scope: 'all' | 'bulk';
  at: string;
  source?: string;
  detail?: string;
}

export type MailReadinessStatus = 'satisfied' | 'automatable' | 'manual' | 'pending';

export interface MailReadinessStep {
  id: string;
  status: MailReadinessStatus;
  reason?: string;
  action?: string;
  consoleUrl?: string;
}

export interface MailReadiness {
  provider: string;
  ready: boolean;
  projectId?: string | null;
  steps: MailReadinessStep[];
}

export interface MailConnectionSetup {
  domain: string | null;
  readiness: MailReadiness | null;
  records: {
    name: string;
    kind: string;
    value: string;
    purpose: string;
    live?: boolean;
    accepted?: boolean;
  }[];
  verified: boolean;
  ownershipVerified?: boolean;
  published?: boolean;
  canWrite: boolean;
}

export interface MailDomainProofs {
  domain: string;
  spf?: RecordVerdict;
  dkim?: RecordVerdict;
  dmarc?: RecordVerdict;
  verified: boolean;
  provider: string;
  scope: 'transactional' | 'bulk';
  active: boolean;
  connectionId: string;
}

export interface MailRemoveResult {
  domain: string;
  revoked: boolean;
  dns: {
    removed: string[];
    kept: { name: string; kind: string; reason: string }[];
  } | null;
}

export interface MailTestMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface MailTestDraft {
  delivery: MailTestMessage;
  bounce: MailTestMessage;
}

export interface MailTestResult {
  kind: 'delivery' | 'bounce';
  from: string;
  to: string;
  provider: string;
  messageId: string | null;
  accepted: number;
  alreadySuppressed?: boolean;
}

export interface MailPublishResult {
  domain: string;
  verified: boolean;
  canWrite: boolean;
  published: string[];
  outstanding: { name: string; kind: string; value: string; purpose: string }[];
  error?: string;
  recheck?: { asked: boolean; accepted: boolean; detail?: string };
}

export const KPI_LABEL: Readonly<Record<MailKpiId, string>> = {
  sent: 'Sent',
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Complaints',
};

export const SENDER_STATUS_LABEL: Readonly<Record<MailSenderStatus, string>> = {
  delivering: 'Delivering',
  degraded: 'Degraded',
  failing: 'Failing',
  silent: 'Silent',
};

export const READINESS_STEP_LABEL: Readonly<Record<string, string>> = {
  credential: 'Provider credential',
  domain: 'Sending domain',
  dns: 'DNS records',
  verification: 'Provider verification',
};

export function proofTone(
  purpose: 'spf' | 'dkim' | 'dmarc',
  verdict: RecordVerdict | undefined,
): 'ok' | 'warn' | 'bad' | 'none' {
  if (verdict === undefined) return 'none';
  if (verdict === 'ok') return 'ok';
  if (verdict === 'pending') return 'warn';
  return purpose === 'dmarc' ? 'warn' : 'bad';
}

export function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(rate > 0 && rate < 0.01 ? 2 : 1)}%`;
}

export function formatCount(count: number): string {
  return count.toLocaleString();
}

export function formatDelta(kpi: MailKpi): string | null {
  if (kpi.delta === null || kpi.delta === 0) return null;
  const sign = kpi.delta > 0 ? '+' : '';
  return kpi.rate === null
    ? `${sign}${(kpi.delta * 100).toFixed(0)}%`
    : `${sign}${(kpi.delta * 100).toFixed(2)}pt`;
}

export type MailScope = 'transactional' | 'bulk';

export type MailProviderId = 'scaleway-tem' | 'brevo' | 'zeptomail' | 'smtp';

export interface MailConnection {
  id: string;
  provider: MailProviderId;
  scope: MailScope;
  label: string;
  sendingDomain: string | null;
  isActive: boolean;
  hasCredential: boolean;
  webhookRegistered: boolean;

  implicit: boolean;
  credentialNote?: string;
  webhookNote?: string;

  webhookUrl?: string;

  createdAt: string | null;
}

export interface MailObservability {
  channel: 'none' | 'poll' | 'webhook';
  reports: MailEventKind[];
  partial?: MailEventKind[];
  limitation?: string;
}

export interface MailConnectionConfig {
  region?: string;
  host?: string;
  port?: number;
  username?: string;
  secure?: boolean;
  allowsBulk?: boolean;
  spfInclude?: string;
  dkimSelector?: string;
  dkimValue?: string;
}

export interface ConnectProviderInput {
  provider: MailProviderId;
  scope: MailScope;
  label?: string;
  sendingDomain?: string;
  secret?: string;
  config?: MailConnectionConfig;
  activate?: boolean;
}

export interface MailConnectResult {
  connection: MailConnection;
  activated: boolean;
  observability: MailObservability;
  domain: {
    published: string[];
    outstanding: { name: string; kind: string; value: string; purpose: string }[];
    canWrite: boolean;
    verified: boolean;
    error?: string;
  } | null;
  webhook: { registered: boolean; url?: string; reason?: string };
  readiness: MailReadiness | null;
  manualSteps: string[];
}

export interface MailProviderProfile {
  id: MailProviderId;
  name: string;
  summary: string;
  scopes: MailScope[];
  needsSecret: boolean;
  secretLabel: string;
  automatesDomain: boolean;
  blindSpot: string;
  fields: MailProviderField[];
  unproven?: boolean;
  credentialHelp?: {
    where: string;
    href: string;
    linkText: string;
    caveat?: string;
  };
}

export interface MailProviderField {
  key: keyof MailConnectionConfig;
  label: string;
  hint?: string;
  type: 'text' | 'number' | 'checkbox';
  required?: boolean;
}

export const MAIL_PROVIDERS: MailProviderProfile[] = [
  {
    id: 'scaleway-tem',
    name: 'Scaleway Transactional Email',
    summary: 'Already connected. Reuses the Scaleway key Flui holds for compute.',
    scopes: ['transactional'],
    needsSecret: false,
    secretLabel: '',
    automatesDomain: true,
    blindSpot: '',
    fields: [],
  },
  {
    id: 'brevo',
    name: 'Brevo',
    summary: 'The only one here whose terms allow a mailing list. Sets itself up end to end.',
    scopes: ['transactional', 'bulk'],
    needsSecret: true,
    secretLabel: 'API key',
    automatesDomain: true,
    blindSpot: '',
    fields: [],
    credentialHelp: {
      where: 'Settings → SMTP & API → API Keys → Generate a new API key',
      href: 'https://app.brevo.com/settings/keys/api',
      linkText: 'Open Brevo API keys',
      caveat:
        'Shown once, so copy it before closing. Leave the expiry unset unless you plan to rotate it — sending stops the day it lapses.',
    },
  },
  {
    id: 'zeptomail',
    name: 'ZeptoMail',
    summary: 'Transactional only. Domains are verified in Zoho’s own console.',
    unproven: true,
    scopes: ['transactional'],
    needsSecret: true,
    secretLabel: 'Send-mail token',
    automatesDomain: false,
    blindSpot: 'Never confirms delivery — only failures are reported.',
    credentialHelp: {
      where: 'Agents → pick your agent → SMTP/API → API tab → Send Mail Token',
      href: 'https://www.zoho.com/zeptomail/help/agents.html',
      linkText: 'How to set up a ZeptoMail agent',
      caveat:
        'The token belongs to an agent, not to the account — a token from the wrong agent sends from the wrong domain.',
    },
    fields: [
      {
        key: 'region',
        label: 'Regional API host',
        hint: 'api.zeptomail.eu, .com, .in, .com.au or .ca. This is also where the account data lives, so it is never guessed.',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    id: 'smtp',
    name: 'SMTP relay',
    summary: 'Anything that speaks SMTP, including AWS SES. Nothing is set up for you.',
    unproven: true,
    scopes: ['transactional', 'bulk'],
    needsSecret: true,
    secretLabel: 'Password',
    automatesDomain: false,
    blindSpot:
      'Reports only the addresses the relay refuses at handover. Delivery is never confirmed.',
    credentialHelp: {
      where: 'From your relay\u2019s own setup page — host, port and credentials.',
      href: 'https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html',
      linkText: 'Using AWS SES over SMTP',
      caveat:
        'SES SMTP credentials are not your AWS access keys, and they are issued per region.',
    },
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', hint: '587 for STARTTLS, 465 for implicit TLS', type: 'number' },
      { key: 'username', label: 'Username', type: 'text' },
      {
        key: 'allowsBulk',
        label: 'This relay permits one-to-many mail',
        hint: 'Only you know which relay this points at, so only you can say. Left off, bulk sends are refused.',
        type: 'checkbox',
      },
      {
        key: 'spfInclude',
        label: 'SPF include',
        hint: 'The bare hostname from the relay’s setup page — spf.example.org, not the whole record.',
        type: 'text',
      },
      { key: 'dkimSelector', label: 'DKIM selector', hint: 'Verbatim from the relay. A guessed selector never verifies.', type: 'text' },
      { key: 'dkimValue', label: 'DKIM value', type: 'text' },
    ],
  },
];
