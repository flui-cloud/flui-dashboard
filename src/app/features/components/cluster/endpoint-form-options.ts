import { ChoiceOption } from './endpoint-choice-group';
import { CertChallenge, EndpointType, HostnameMode } from './endpoint-form-model';

const TYPE_LOCKED = 'Endpoint type cannot be changed after creation';

export function internalTypeTooltip(state: {
  locked: boolean;
  hostingAvailable: boolean;
  missingLabel: string;
  authzReady: boolean;
}): string {
  if (state.locked) return TYPE_LOCKED;
  if (!state.hostingAvailable) return `Cluster missing: ${state.missingLabel}`;
  if (!state.authzReady) return 'The auth proxy must be installed and running on the cluster';
  return '';
}

export function typeOptions(state: {
  editMode: boolean;
  internalSelected: boolean;
  internalAvailable: boolean;
  internalTooltip: string;
}): ChoiceOption<EndpointType>[] {
  return [
    {
      value: 'public',
      title: 'Public',
      description: 'Reachable from the internet through public DNS and a TLS certificate.',
      disabled: state.editMode,
      tooltip: state.editMode ? TYPE_LOCKED : '',
    },
    {
      value: 'internal',
      title: 'Internal',
      description:
        "Private URL on the cluster's .internal.<zone> wildcard, gated by the Flui auth proxy.",
      disabled: !state.internalAvailable || (state.editMode && !state.internalSelected),
      tooltip: state.internalTooltip,
    },
  ];
}

export function hostnameOptions(masterIp: string, zoned: boolean): ChoiceOption<HostnameMode>[] {
  return [
    {
      value: 'ip',
      title: 'Test address',
      description: 'Instant address derived from the cluster IP, no DNS setup needed.',
      disabled: !masterIp,
      tooltip: masterIp ? 'Auto-generated test address' : 'Cluster IP not available yet',
    },
    {
      value: 'domain',
      title: 'Your domain',
      description: zoned
        ? 'Pick a subdomain under your cluster zone or use a different one.'
        : 'Use a domain you own and point its DNS to the cluster.',
    },
  ];
}

export function challengeOptions(
  canUseDns01: boolean,
  wildcardTooltip: string,
): ChoiceOption<CertChallenge>[] {
  return [
    {
      value: 'http-01',
      title: 'Single domain',
      description: 'One certificate just for this address. Works with any DNS setup.',
    },
    {
      value: 'dns-01',
      title: 'Wildcard',
      description:
        'Covers every subdomain of your cluster zone in one certificate. Needs managed DNS.',
      disabled: !canUseDns01,
      tooltip: wildcardTooltip,
    },
  ];
}
