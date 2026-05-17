import { AppEndpointResponseDto } from '../../core/api/model/appEndpointResponseDto';

export type EndpointReadinessState =
  | 'loading'        // endpoint not yet fetched
  | 'dns-pending'    // reconciliation still running
  | 'cert-pending'   // DNS OK but certificate not yet valid
  | 'ready'          // DNS in sync + cert valid (or cert not required)
  | 'failed';        // reconciliation or cert in terminal error

export interface EndpointReadiness {
  state: EndpointReadinessState;
  /** Short status label suitable for a button / badge. */
  label: string;
  /** Longer explanation for users. */
  detail?: string;
  /** True when the state cannot progress further without user action. */
  isTerminal: boolean;
  /** True when it is safe to navigate to `https://${fqdn}`. */
  isReady: boolean;
}

const DNS_FAILED = new Set<string>(['ERROR']);
const DNS_OK = new Set<string>(['IN_SYNC']);

export function evaluateEndpointReadiness(
  endpoint: AppEndpointResponseDto | null | undefined,
): EndpointReadiness {
  if (!endpoint) {
    return {
      state: 'loading',
      label: 'Checking endpoint…',
      isTerminal: false,
      isReady: false,
    };
  }

  if (DNS_FAILED.has(endpoint.reconciliationStatus)) {
    return {
      state: 'failed',
      label: 'Endpoint failed',
      detail: endpoint.errorMessage ?? 'DNS reconciliation ended in error.',
      isTerminal: true,
      isReady: false,
    };
  }

  if (!DNS_OK.has(endpoint.reconciliationStatus)) {
    return {
      state: 'dns-pending',
      label: 'Setting up DNS…',
      detail: 'Flui is configuring the DNS record for this endpoint.',
      isTerminal: false,
      isReady: false,
    };
  }

  // DNS is IN_SYNC from here on.
  if (!endpoint.certificateRequired) {
    return {
      state: 'ready',
      label: 'Ready',
      isTerminal: true,
      isReady: true,
    };
  }

  const cert = endpoint.certificateStatus;
  if (cert === 'valid') {
    return {
      state: 'ready',
      label: 'Ready',
      isTerminal: true,
      isReady: true,
    };
  }
  if (cert === 'failed' || cert === 'expired') {
    return {
      state: 'failed',
      label: cert === 'expired' ? 'Certificate expired' : 'Certificate failed',
      detail: endpoint.certificateMessage ?? 'TLS certificate could not be issued.',
      isTerminal: true,
      isReady: false,
    };
  }

  return {
    state: 'cert-pending',
    label: 'Issuing certificate…',
    detail:
      'Flui is requesting a TLS certificate. This takes a few minutes — you can browse the app details in the meantime.',
    isTerminal: false,
    isReady: false,
  };
}
