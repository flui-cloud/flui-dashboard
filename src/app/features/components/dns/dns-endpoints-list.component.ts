import { Component, input, output, signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideExternalLink, lucideLock, lucideLockOpen,
  lucideAlertTriangle, lucideCopy, lucideCheck, lucideShieldCheck, lucideShieldAlert,
  lucideFileText, lucideX, lucideDownload, lucidePencil, lucideTrash2, lucideRefreshCw
} from '@ng-icons/lucide';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import {
  buildEndpointUrl,
  getReconciliationBadgeColor, getReconciliationBadgeLabel,
  getCertificateBadgeColor, getCertificateBadgeLabel,
  isEndpointManaged
} from '../../model/dns.models';

interface ErrorCause {
  reason: string;
  message: string;
  field?: string;
}

interface ParsedError {
  title: string;
  httpCode: string | null;
  certMessage: string | null;
  k8sMessage: string | null;
  causes: ErrorCause[];
  rawJson: string;
}

@Component({
  selector: 'app-dns-endpoints-list',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({
    lucideExternalLink, lucideLock, lucideLockOpen,
    lucideAlertTriangle, lucideCopy, lucideCheck, lucideShieldCheck, lucideShieldAlert,
    lucideFileText, lucideX, lucideDownload, lucidePencil, lucideTrash2, lucideRefreshCw
  })],
  template: `
    @if (endpoints().length > 0) {
      <div class="space-y-2">
        @for (ep of endpoints(); track ep.id) {
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <!-- Main row -->
            <div class="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
              <div class="flex items-center gap-3 min-w-0">
                <ng-icon
                  [name]="ep.tlsEnabled ? 'lucideLock' : 'lucideLockOpen'"
                  class="h-4 w-4 flex-shrink-0"
                  [class]="ep.tlsEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'"
                />
                <div class="min-w-0">
                  <a
                    [href]="getUrl(ep.fqdn, ep.tlsEnabled)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
                  >
                    {{ ep.fqdn }}
                  </a>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ ep.serviceName }} &middot; {{ ep.k8sNamespace }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Hostname mode + cert challenge -->
                <span
                  class="text-xs px-2 py-0.5 rounded font-medium inline-flex items-center gap-1"
                  [class]="getModeBadgeClass(ep.hostnameMode)"
                  [title]="getModeBadgeTitle(ep.hostnameMode, ep.certChallenge)"
                >
                  {{ getModeBadgeLabel(ep.hostnameMode, ep.certChallenge) }}
                </span>
                <!-- Internal endpoint marker — everything else below follows the standard flow. -->
                @if (ep.endpointType === 'internal') {
                  <span
                    class="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 inline-flex items-center gap-1"
                    title="Internal app — reachable only from the Flui dashboard via ForwardAuth"
                  >
                    <ng-icon name="lucideLock" class="h-3 w-3" />
                    Internal
                  </span>
                }
                <!-- Certificate status badge -->
                @if (ep.certificateRequired) {
                  <span
                    class="text-xs px-2 py-0.5 rounded font-medium inline-flex items-center gap-1"
                    [class]="getCertClass(ep.certificateStatus ?? null)"
                  >
                    @if (certPollingId() === ep.id) {
                      <ng-icon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                    } @else {
                      <ng-icon
                        [name]="isCertOk(ep.certificateStatus) ? 'lucideShieldCheck' : 'lucideShieldAlert'"
                        class="h-3 w-3"
                      />
                    }
                    {{ getCertLabel(ep.certificateStatus ?? null) }}
                  </span>
                  @if (ep.certificateProvider === 'lets_encrypt_staging') {
                    <span class="text-xs px-2 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      Staging
                    </span>
                  }
                }
                <!-- Reconciliation status badge (shown only when not in sync) -->
                @if (ep.reconciliationStatus !== 'IN_SYNC') {
                  <span
                    class="text-xs px-2 py-0.5 rounded font-medium"
                    [class]="getStatusClass(ep.reconciliationStatus)"
                  >
                    {{ getStatusLabel(ep.reconciliationStatus) }}
                  </span>
                }
                <!-- Error/cert detail button: only when there's an error or cert is not valid -->
                @if (ep.errorMessage || (ep.certificateMessage && ep.certificateStatus !== 'valid')) {
                  <button
                    type="button"
                    (click)="openError(ep)"
                    title="View error details"
                    class="p-1 rounded text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                  >
                    <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
                  </button>
                }
                <span class="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-mono">
                  {{ ep.dnsRecordType }}
                </span>
                <a
                  [href]="getUrl(ep.fqdn, ep.tlsEnabled)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
                </a>
                <!-- Divider + inline action buttons -->
                <span class="w-px h-3.5 bg-gray-300 dark:bg-gray-600"></span>
                <button
                  type="button"
                  (click)="editAction.emit(ep)"
                  class="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Edit endpoint"
                >
                  <ng-icon name="lucidePencil" class="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  (click)="reconcileAction.emit(ep)"
                  [disabled]="reconcilingId() === ep.id"
                  class="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                  title="Reconcile endpoint"
                >
                  <ng-icon name="lucideRefreshCw" class="h-3 w-3" [class.animate-spin]="reconcilingId() === ep.id" />
                  Sync
                </button>
                <button
                  type="button"
                  (click)="deleteAction.emit(ep)"
                  class="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete endpoint"
                >
                  <ng-icon name="lucideTrash2" class="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>

            <!-- BYOD DNS instruction row -->
            @if (!isManaged(ep) && ep.dnsRecordValue) {
              <div class="flex items-center justify-between gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/15 border-t border-amber-200 dark:border-amber-800">
                <div class="flex items-center gap-2 min-w-0">
                  <ng-icon name="lucideAlertTriangle" class="h-3.5 w-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                  <p class="text-xs text-amber-800 dark:text-amber-300">
                    Create an <strong>A record</strong> pointing
                    <span class="font-mono">{{ ep.fqdn }}</span>
                    →
                    <span class="font-mono">{{ ep.dnsRecordValue }}</span>
                    in your DNS provider
                  </p>
                </div>
                <button
                  type="button"
                  (click)="copyDnsValue(ep.id, ep.dnsRecordValue)"
                  [title]="isCopied(ep.id) ? 'Copied!' : 'Copy IP'"
                  class="flex-shrink-0 p-1 rounded text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
                >
                  <ng-icon [name]="isCopied(ep.id) ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                </button>
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No endpoints configured</p>
    }

    <!-- Error detail modal -->
    @if (activeError()) {
      <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        (click)="closeError()"
      >
        <div
          class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[70vh]"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideFileText" class="h-4 w-4 text-red-500" />
              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ activeError()!.title }}</span>
              @if (activeError()!.httpCode) {
                <span class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-mono">
                  HTTP {{ activeError()!.httpCode }}
                </span>
              }
            </div>
            <div class="flex items-center gap-1">
              @if (activeError()!.rawJson) {
                <button
                  type="button"
                  (click)="downloadError()"
                  title="Download full JSON"
                  class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                </button>
              }
              <button
                type="button"
                (click)="closeError()"
                class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="overflow-y-auto p-4 space-y-4 flex-1">
            <!-- Certificate error message -->
            @if (activeError()!.certMessage) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Certificate Error</p>
                  <button
                    type="button"
                    (click)="copyCertMessage(activeError()!.certMessage!)"
                    [title]="certMessageCopied() ? 'Copied!' : 'Copy message'"
                    class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <ng-icon [name]="certMessageCopied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                  </button>
                </div>
                <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/15 px-3 py-2">
                  <p class="text-xs text-red-700 dark:text-red-300 break-all font-mono leading-relaxed">{{ activeError()!.certMessage }}</p>
                </div>
              </div>
            }

            <!-- Reconciliation error: k8s message -->
            @if (activeError()!.k8sMessage) {
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Message</p>
                <p class="text-sm text-gray-800 dark:text-gray-200">{{ activeError()!.k8sMessage }}</p>
              </div>
            }

            <!-- Causes list -->
            @if (activeError()!.causes.length > 0) {
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Causes</p>
                <div class="space-y-2">
                  @for (cause of activeError()!.causes; track $index) {
                    <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/15 px-3 py-2 space-y-0.5">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-mono font-medium text-red-700 dark:text-red-400">{{ cause.reason }}</span>
                        @if (cause.field) {
                          <span class="text-xs font-mono text-gray-500 dark:text-gray-400">· {{ cause.field }}</span>
                        }
                      </div>
                      <p class="text-xs text-gray-700 dark:text-gray-300">{{ cause.message }}</p>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Fallback: raw -->
            @if (!activeError()!.certMessage && !activeError()!.k8sMessage && activeError()!.causes.length === 0) {
              <pre class="text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">{{ activeError()!.rawJson }}</pre>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DnsEndpointsListComponent {
  endpoints = input.required<AppEndpointResponseDto[]>();
  reconcilingId = input<string | null>(null);
  certPollingId = input<string | null>(null);

  editAction = output<AppEndpointResponseDto>();
  reconcileAction = output<AppEndpointResponseDto>();
  deleteAction = output<AppEndpointResponseDto>();

  private readonly copiedIds = signal<Set<string>>(new Set());
  protected activeError = signal<ParsedError | null>(null);
  private readonly activeEndpointId = signal<string | null>(null);
  protected certMessageCopied = signal(false);

  getUrl(fqdn: string, tlsEnabled: boolean): string {
    return buildEndpointUrl(fqdn, tlsEnabled);
  }

  isManaged(ep: AppEndpointResponseDto): boolean {
    return isEndpointManaged(ep.clusterDnsZoneId);
  }

  isCopied(id: string): boolean {
    return this.copiedIds().has(id);
  }

  copyDnsValue(id: string, value: string): void {
    navigator.clipboard.writeText(value).then(() => {
      this.copiedIds.update(s => new Set([...s, id]));
      setTimeout(() => {
        this.copiedIds.update(s => { const n = new Set(s); n.delete(id); return n; });
      }, 2000);
    });
  }

  openError(ep: AppEndpointResponseDto): void {
    this.activeEndpointId.set(ep.id);
    this.activeError.set(this.buildError(ep));
  }

  closeError(): void {
    this.activeError.set(null);
    this.activeEndpointId.set(null);
    this.certMessageCopied.set(false);
  }

  copyCertMessage(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.certMessageCopied.set(true);
      setTimeout(() => this.certMessageCopied.set(false), 2000);
    });
  }

  downloadError(): void {
    const err = this.activeError();
    if (!err?.rawJson) return;
    const blob = new Blob([err.rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endpoint-error-${this.activeEndpointId() ?? 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private buildError(ep: AppEndpointResponseDto): ParsedError {
    const hasCert = !!ep.certificateMessage;
    const hasReconcile = !!ep.errorMessage;

    let title = 'Error Details';
    if (hasCert && !hasReconcile) title = 'Certificate Error';
    else if (hasReconcile && !hasCert) title = 'Reconciliation Error';

    const reconcilePart = hasReconcile ? this.parseReconcileError(ep.errorMessage!) : null;

    return {
      title,
      httpCode: reconcilePart?.httpCode ?? null,
      certMessage: ep.certificateMessage ?? null,
      k8sMessage: reconcilePart?.k8sMessage ?? null,
      causes: reconcilePart?.causes ?? [],
      rawJson: reconcilePart?.rawJson ?? '',
    };
  }

  private parseReconcileError(raw: string): Omit<ParsedError, 'title' | 'certMessage'> {
    const bodyMatch = raw.match(/Body:\s*"([\s\S]+?)"(?:\s*\nHeaders:|$)/);
    const httpCodeMatch = raw.match(/HTTP-Code:\s*(\d+)/);

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
          causes = parsed.details.causes.map((c: any) => ({
            reason: c.reason ?? '',
            message: c.message ?? '',
            field: c.field ?? undefined,
          }));
        }
      } catch {
        // keep rawJson = raw
      }
    }

    return { httpCode: httpCodeMatch ? httpCodeMatch[1] : null, k8sMessage, causes, rawJson };
  }

  getStatusLabel(status: string): string {
    return getReconciliationBadgeLabel(status);
  }

  getStatusClass(status: string): string {
    return this.colorToClass(getReconciliationBadgeColor(status));
  }

  getCertLabel(status: string | null): string {
    return getCertificateBadgeLabel(status);
  }

  getCertClass(status: string | null): string {
    return this.colorToClass(getCertificateBadgeColor(status));
  }

  isCertOk(status: string | undefined): boolean {
    return status === 'valid';
  }

  getModeBadgeLabel(hostnameMode: string | undefined | null, certChallenge: string | undefined | null): string {
    if (hostnameMode === 'ip') return 'Test address';
    if (certChallenge === 'dns-01') return 'Domain · Wildcard';
    return 'Domain';
  }

  getModeBadgeClass(hostnameMode: string | undefined | null): string {
    return hostnameMode === 'ip'
      ? this.colorToClass('gray')
      : this.colorToClass('blue');
  }

  getModeBadgeTitle(hostnameMode: string | undefined | null, certChallenge: string | undefined | null): string {
    if (hostnameMode === 'ip') return 'Auto-generated test address — works without DNS setup';
    if (certChallenge === 'dns-01') return 'Custom domain with a wildcard certificate covering the cluster zone';
    return 'Custom domain with a single-domain certificate';
  }

  private colorToClass(color: string): string {
    const map: Record<string, string> = {
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[color] ?? map['gray'];
  }
}
