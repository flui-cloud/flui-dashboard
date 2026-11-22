import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { StatusTone } from '../../../ui/primitives/status';
import {
  getCertificateBadgeColor,
  getCertificateBadgeLabel,
  getReconciliationBadgeColor,
  getReconciliationBadgeLabel,
} from '../../model/dns.models';

export interface ErrorCause {
  reason: string;
  message: string;
  field?: string;
}

export interface ParsedError {
  title: string;
  httpCode: string | null;
  certMessage: string | null;
  k8sMessage: string | null;
  causes: ErrorCause[];
  rawJson: string;
}

export interface CertificatePhase {
  step: 'none' | 'publishing' | 'issuing' | 'issued' | 'failed';
  label: string;
  detail: string | null;
  technical: string | null;
}

export interface StateView {
  tone: StatusTone;
  label: string;
  title: string | null;
}

interface RawCause {
  reason?: string;
  message?: string;
  field?: string;
}

const COLOR_TONES: Record<string, StatusTone> = {
  green: 'success',
  yellow: 'warning',
  blue: 'progress',
  red: 'error',
  gray: 'neutral',
};

const PHASE_LABELS: Record<CertificatePhase['step'], string> = {
  none: 'None',
  publishing: 'Publishing',
  issuing: 'Issuing',
  issued: 'Valid',
  failed: 'Failed',
};

export function toneOfColor(color: string): StatusTone {
  return COLOR_TONES[color] ?? 'neutral';
}

export function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export function phaseOf(ep: AppEndpointResponseDto): CertificatePhase | null {
  return (
    (ep as AppEndpointResponseDto & { certificatePhase?: CertificatePhase }).certificatePhase ??
    null
  );
}

export function technicalOf(ep: AppEndpointResponseDto): string | null {
  const phase = phaseOf(ep);
  return phase ? phase.technical : (ep.certificateMessage ?? null);
}

export function hasDetails(ep: AppEndpointResponseDto): boolean {
  return !!ep.errorMessage || (!!technicalOf(ep) && ep.certificateStatus !== 'valid');
}

export function certificateLabel(ep: AppEndpointResponseDto): string {
  const phase = phaseOf(ep);
  return phase && phase.step !== 'issued'
    ? phase.label
    : getCertificateBadgeLabel(ep.certificateStatus ?? null);
}

export function dnsState(ep: AppEndpointResponseDto): StateView {
  return {
    tone: toneOfColor(getReconciliationBadgeColor(ep.reconciliationStatus)),
    label: sentenceCase(getReconciliationBadgeLabel(ep.reconciliationStatus)),
    title: null,
  };
}

export function tlsState(ep: AppEndpointResponseDto, polling: boolean): StateView {
  if (!ep.certificateRequired) {
    return ep.tlsEnabled
      ? { tone: 'success', label: 'HTTPS', title: null }
      : { tone: 'neutral', label: 'HTTP only', title: null };
  }
  const phase = phaseOf(ep);
  const status = ep.certificateStatus ?? null;
  let view: StateView;
  if (phase && phase.step !== 'issued' && phase.step !== 'none') {
    const tone: StatusTone = phase.step === 'failed' ? 'error' : 'progress';
    view = { tone, label: PHASE_LABELS[phase.step], title: phase.label };
  } else {
    view = {
      tone: toneOfColor(getCertificateBadgeColor(status)),
      label: getCertificateBadgeLabel(status),
      title: phase?.label ?? null,
    };
  }
  return polling ? { ...view, tone: 'progress' } : view;
}

export function modeLabel(ep: AppEndpointResponseDto): string {
  if (ep.hostnameMode === 'ip') return 'Test address';
  if (ep.certChallenge === 'dns-01') return 'Domain, wildcard';
  return 'Domain';
}

export function modeTitle(ep: AppEndpointResponseDto): string {
  if (ep.hostnameMode === 'ip') return 'Auto-generated test address, works without DNS setup';
  if (ep.certChallenge === 'dns-01') {
    return 'Custom domain with a wildcard certificate covering the cluster zone';
  }
  return 'Custom domain with a single-domain certificate';
}

export function buildEndpointError(ep: AppEndpointResponseDto): ParsedError {
  const certMessage = technicalOf(ep);
  const hasCert = !!certMessage;
  const hasReconcile = !!ep.errorMessage;

  let title = 'Error details';
  if (hasCert && !hasReconcile) title = 'Certificate error';
  else if (hasReconcile && !hasCert) title = 'Reconciliation error';

  const reconcilePart = ep.errorMessage ? parseReconcileError(ep.errorMessage) : null;

  return {
    title,
    httpCode: reconcilePart?.httpCode ?? null,
    certMessage,
    k8sMessage: reconcilePart?.k8sMessage ?? null,
    causes: reconcilePart?.causes ?? [],
    rawJson: reconcilePart?.rawJson ?? '',
  };
}

export function parseReconcileError(raw: string): Omit<ParsedError, 'title' | 'certMessage'> {
  const bodyMatch = /Body:\s*"([\s\S]+?)"(?:\s*\nHeaders:|$)/.exec(raw);
  const httpCodeMatch = /HTTP-Code:\s*(\d+)/.exec(raw);

  let k8sMessage: string | null = null;
  let causes: ErrorCause[] = [];
  let rawJson = raw;

  if (bodyMatch) {
    try {
      const unescaped = bodyMatch[1]
        .replaceAll(String.raw`\"`, '"')
        .replaceAll(String.raw`\n`, '\n')
        .replaceAll(String.raw`\\`, '\\');
      const parsed = JSON.parse(unescaped);
      rawJson = JSON.stringify(parsed, null, 2);
      k8sMessage = parsed.message ?? null;
      if (Array.isArray(parsed.details?.causes)) {
        causes = (parsed.details.causes as RawCause[]).map((c) => ({
          reason: c.reason ?? '',
          message: c.message ?? '',
          field: c.field ?? undefined,
        }));
      }
    } catch {
      rawJson = raw;
    }
  }

  return { httpCode: httpCodeMatch ? httpCodeMatch[1] : null, k8sMessage, causes, rawJson };
}
