import { Component, input, output, signal, computed, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGlobe, lucideRefreshCw,
  lucideCheckCircle, lucideAlertCircle, lucidePlusCircle,
  lucideArrowUpCircle, lucideExternalLink
} from '@ng-icons/lucide';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { AssignDnsZoneDto } from '../../../core/api/model/assignDnsZoneDto';
import {
  getReconciliationBadgeColor, getReconciliationBadgeLabel,
  formatTimeSince, needsReconciliation,
  CertificateProvider, getZoneDisplayName
} from '../../model/dns.models';
import { ClusterIssuerSetupComponent } from './cluster-issuer-setup.component';

@Component({
  selector: 'app-cluster-dns-zone-section',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIconComponent, ClusterIssuerSetupComponent],
  providers: [provideIcons({
    lucideGlobe, lucideRefreshCw,
    lucideCheckCircle, lucideAlertCircle, lucidePlusCircle,
    lucideArrowUpCircle, lucideExternalLink
  })],
  template: `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">DNS Zones</h3>
          <a
            routerLink="/infrastructure/domains"
            class="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Manage DNS zones"
          >
            <ng-icon name="lucideExternalLink" class="h-3 w-3" />
            Manage
          </a>
        </div>
      </div>

      @if (assignments().length === 0 && !showAssignForm()) {
        <div class="p-4 border border-dashed border-border rounded-lg text-center">
          <ng-icon name="lucideGlobe" class="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p class="text-sm text-sub">No DNS zone assigned</p>
          <button
            (click)="showAssignForm.set(true)"
            class="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ng-icon name="lucidePlusCircle" class="h-3.5 w-3.5" />
            Assign DNS Zone
          </button>
        </div>
      }

      @for (a of assignments(); track a.id) {
        <!-- Zone info card -->
        <div class="p-4 border border-border rounded-lg space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideGlobe" class="h-4 w-4 text-blue-500" />
              <span class="text-sm font-medium text-foreground font-mono">
                {{ a.dnsZone.zoneName }}
              </span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {{ a.dnsZone.dnsProvider }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs px-2 py-0.5 rounded font-medium" [class]="getStatusClass(a.reconciliationStatus)">
                {{ getStatusLabel(a.reconciliationStatus) }}
              </span>
              <button
                (click)="removeConfirmId.set(a.id)"
                [disabled]="removeConfirmId() === a.id"
                class="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>

          @if (a.certificateProvider) {
            <div class="flex items-center gap-1.5 text-xs text-sub">
              @if (wildcardPending(a)) {
                <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 text-amber-500" />
              } @else {
                <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5 text-green-500" />
              }
              TLS: {{ certLabel(a.certificateProvider) }}
              @if (a.wildcardCertificate) {
                <span class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs">wildcard</span>
              }
              @if (a.acmeEmail) { &bull; {{ a.acmeEmail }} }
              @if (wildcardPending(a)) {
                <span class="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">issuers not configured</span>
              }
            </div>
          }

          @if (a.lastReconciliationAt) {
            <div class="text-xs text-muted-foreground">
              Last reconciled: {{ timeSince(a.lastReconciliationAt!) }}
            </div>
          }

          @if (a.errorMessage) {
            <div class="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {{ a.errorMessage }}
            </div>
          }

          @if (needsRec(a)) {
            <button (click)="reconcile.emit(a.id)" class="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <ng-icon name="lucideRefreshCw" class="h-3 w-3" />
              Reconcile now
            </button>
          }

          <!-- Switch to production when staging is active and issuers are ready -->
          @if (a.certificateProvider === certProviders.LETS_ENCRYPT_STAGING && localIssuersReady()) {
            <div class="pt-1.5 border-t border-border mt-1">
              <button (click)="openDnsIssuerSetupForm()" class="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                <ng-icon name="lucideArrowUpCircle" class="h-3.5 w-3.5" />
                Switch to production Let's Encrypt
              </button>
            </div>
          }

          <!-- Inline remove confirmation -->
          @if (removeConfirmId() === a.id) {
            <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
              <span class="text-red-700 dark:text-red-400 flex-1">Remove DNS zone {{ a.dnsZone.zoneName }}? Endpoints on this zone will lose DNS management.</span>
              <button (click)="executeRemove(a.id)" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium">Remove</button>
              <button (click)="removeConfirmId.set(null)" class="px-2 py-1 text-muted-foreground hover:text-foreground text-xs">Cancel</button>
            </div>
          }
        </div>
      }

      @if (assignments().length > 0 && !showAssignForm() && unassignedZones().length > 0) {
        <button
          (click)="showAssignForm.set(true)"
          class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ng-icon name="lucidePlusCircle" class="h-3.5 w-3.5" />
          Assign another zone
        </button>
      }

      @if (showAssignForm()) {
        <div class="border border-border rounded-lg p-4 space-y-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">DNS Zone</label>
            @if (unassignedZones().length === 0) {
              <p class="text-sm text-sub">
                No registered zones available.
                <a routerLink="/infrastructure/domains/register" class="text-blue-600 dark:text-blue-400 hover:underline">Register one first.</a>
              </p>
            } @else {
              <select
                [(ngModel)]="assignForm.dnsZoneId"
                class="w-full px-3 py-2 border border-border rounded-md bg-background text-sm text-foreground"
              >
                <option value="">Select zone...</option>
                @for (zone of unassignedZones(); track zone.id) {
                  <option [value]="zone.id">{{ getZoneDisplay(zone) }}</option>
                }
              </select>
            }
          </div>

          <!-- TLS setup — wildcard first -->
          <div class="space-y-2">
            <label class="block text-xs font-medium text-muted-foreground">TLS Certificate</label>
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" [(ngModel)]="assignForm.enableTls" class="rounded" />
              Enable Let's Encrypt TLS
            </label>
            @if (assignForm.enableTls) {
              <div class="ml-6 space-y-3">
                <label class="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                  <input type="checkbox" [(ngModel)]="assignForm.wildcardCertificate" class="rounded mt-0.5" />
                  <div>
                    <span class="font-medium">Wildcard certificate (recommended)</span>
                    <p class="text-xs text-sub mt-0.5">
                      Uses DNS-01 challenge to cover all subdomains (*.zone). Requires Hetzner DNS.
                    </p>
                  </div>
                </label>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                  <select
                    [(ngModel)]="assignForm.certificateProvider"
                    class="w-full px-3 py-2 border border-border rounded-md bg-background text-sm text-foreground"
                  >
                    <option [value]="certProviders.LETS_ENCRYPT_STAGING">Let's Encrypt Staging (start here)</option>
                    <option [value]="certProviders.LETS_ENCRYPT">Let's Encrypt Production</option>
                  </select>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Use staging first — no rate limits. Switch to production when verified.
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1">ACME Email</label>
                  <input
                    type="email"
                    [(ngModel)]="assignForm.acmeEmail"
                    placeholder="admin@example.com"
                    class="w-full px-3 py-2 border border-border rounded-md bg-background text-sm text-foreground"
                  />
                </div>
              </div>
            }
          </div>

          <div class="flex gap-2 justify-end">
            <button
              (click)="showAssignForm.set(false)"
              class="px-3 py-1.5 text-xs border border-border rounded-md text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="submitAssign()"
              [disabled]="!assignForm.dnsZoneId"
              class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Assign
            </button>
          </div>
        </div>
      }

      <!-- STEP 3+4: Issuer setup inline — shown whenever a wildcard zone is assigned -->
      @if (hasWildcardAssignment() && clusterId()) {
        <div class="border border-border rounded-lg p-4 card-inner">
          <app-cluster-issuer-setup
            #dnsIssuerSetup
            [clusterId]="clusterId()!"
            [openFormOnInit]="justAssigned()"
            (issuersReadyChange)="onIssuersReadyChange($event)"
          />
        </div>
      }
    </div>
  `,
})
export class ClusterDnsZoneSectionComponent {
  assignments = input.required<ClusterDnsZoneResponseDto[]>();
  availableZones = input.required<DnsZoneResponseDto[]>();
  clusterId = input<string | null>(null);
  /** Live cert-manager state: a DNS-01-capable issuer is Ready on the cluster. */
  wildcardIssuersReady = input<boolean>(false);

  assignZone = output<AssignDnsZoneDto>();
  /** Emits the assignment id to remove */
  removeZone = output<string>();
  /** Emits the assignment id to reconcile */
  reconcile = output<string>();
  /** Emitted when issuer ready state changes (for parent to sync) */
  issuersReadyChange = output<boolean>();

  protected showAssignForm = signal(false);
  protected removeConfirmId = signal<string | null>(null);
  protected localIssuersReady = signal(false);
  /** True immediately after the user assigns a new zone — forces configure-issuer form open */
  protected justAssigned = signal(false);
  protected certProviders = CertificateProvider;
  @ViewChild('dnsIssuerSetup') private readonly dnsIssuerSetup?: ClusterIssuerSetupComponent;

  protected assignForm = {
    dnsZoneId: '',
    enableTls: false,
    certificateProvider: CertificateProvider.LETS_ENCRYPT_STAGING as CertificateProvider,
    acmeEmail: '',
    wildcardCertificate: true,
  };

  protected unassignedZones = computed(() => {
    const assignedIds = new Set(this.assignments().map(a => a.dnsZoneId));
    return this.availableZones().filter(z => !assignedIds.has(z.id));
  });

  protected hasWildcardAssignment = computed(() =>
    this.assignments().some(a => a.wildcardCertificate)
  );

  protected needsRec(a: ClusterDnsZoneResponseDto): boolean {
    return a.reconciliationStatus ? needsReconciliation(a.reconciliationStatus) : false;
  }

  /** Wildcard TLS is intended on the assignment but no DNS-01 issuer is Ready yet. */
  protected wildcardPending(a: ClusterDnsZoneResponseDto): boolean {
    return !!a.wildcardCertificate && !this.wildcardIssuersReady() && !this.localIssuersReady();
  }

  protected onIssuersReadyChange(ready: boolean): void {
    this.localIssuersReady.set(ready);
    this.issuersReadyChange.emit(ready);
  }

  protected getZoneDisplay(zone: DnsZoneResponseDto): string {
    return getZoneDisplayName(zone.zoneName, zone.dnsProvider);
  }

  protected getStatusLabel(status: string): string {
    return getReconciliationBadgeLabel(status);
  }

  protected getStatusClass(status: string): string {
    const color = getReconciliationBadgeColor(status);
    const map: Record<string, string> = {
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      gray: 'bg-muted text-muted-foreground',
    };
    return map[color] ?? map['gray'];
  }

  protected certLabel(provider: string | undefined | null): string {
    if (provider === CertificateProvider.LETS_ENCRYPT) return "Let's Encrypt";
    if (provider === CertificateProvider.LETS_ENCRYPT_STAGING) return "Let's Encrypt Staging";
    return provider ?? '';
  }

  protected timeSince(ts: string): string {
    return formatTimeSince(ts);
  }

  protected submitAssign(): void {
    if (!this.assignForm.dnsZoneId) return;
    const dto: AssignDnsZoneDto = {
      dnsZoneId: this.assignForm.dnsZoneId,
      wildcardCertificate: this.assignForm.enableTls ? this.assignForm.wildcardCertificate : false,
      ...(this.assignForm.enableTls
        ? {
            certificateProvider: this.assignForm.certificateProvider as AssignDnsZoneDto.CertificateProviderEnum,
            ...(this.assignForm.acmeEmail ? { acmeEmail: this.assignForm.acmeEmail } : {}),
          }
        : {}),
    };
    this.assignZone.emit(dto);
    this.showAssignForm.set(false);
    if (dto.wildcardCertificate) this.justAssigned.set(true);
    this.assignForm = { dnsZoneId: '', enableTls: false, certificateProvider: CertificateProvider.LETS_ENCRYPT_STAGING, acmeEmail: '', wildcardCertificate: true };
  }

  protected executeRemove(assignmentId: string): void {
    this.removeConfirmId.set(null);
    this.justAssigned.set(false);
    this.removeZone.emit(assignmentId);
  }

  openDnsIssuerSetupForm(): void {
    this.dnsIssuerSetup?.openForm();
  }
}
