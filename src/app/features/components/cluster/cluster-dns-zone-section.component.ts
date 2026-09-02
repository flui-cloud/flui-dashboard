import { Component, effect, inject, input, output, signal, computed, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGlobe, lucideRefreshCw, lucideLoader,
  lucideCheckCircle, lucideAlertCircle, lucidePlusCircle,
  lucideArrowUpCircle, lucideExternalLink
} from '@ng-icons/lucide';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { AssignDnsZoneDto } from '../../../core/api/model/assignDnsZoneDto';
import {
  getReconciliationBadgeColor, getReconciliationBadgeLabel,
  formatTimeSince, needsReconciliation,
  CertificateProvider, DnsReconciliationStatus, getZoneDisplayName
} from '../../model/dns.models';
import { CanDirective } from '../../../core/directives/can.directive';
import { ClusterIssuerSetupComponent } from './cluster-issuer-setup.component';
import {
  ClusterDnsZoneService,
  ClusterWildcard,
} from '../../service/cluster-dns-zone.service';
import { SandboxService } from '../../../core/services/sandbox.service';

@Component({
  selector: 'app-cluster-dns-zone-section',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIconComponent, CanDirective, ClusterIssuerSetupComponent],
  providers: [provideIcons({
    lucideGlobe, lucideRefreshCw, lucideLoader,
    lucideCheckCircle, lucideAlertCircle, lucidePlusCircle,
    lucideArrowUpCircle, lucideExternalLink
  })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cluster-dns-zone-section.component.html',
})
export class ClusterDnsZoneSectionComponent {
  assignments = input.required<ClusterDnsZoneResponseDto[]>();
  availableZones = input.required<DnsZoneResponseDto[]>();
  clusterId = input<string | null>(null);
  /** Live cert-manager state: a DNS-01-capable issuer is Ready on the cluster. */
  wildcardIssuersReady = input<boolean>(false);
  /** A zone assignment is in flight — shows the pending card. */
  assigning = input<boolean>(false);
  /** Id of the assignment currently being reconciled, if any. */
  reconcilingId = input<string | null>(null);

  assignZone = output<AssignDnsZoneDto>();
  /** Emits the assignment id to remove */
  removeZone = output<string>();
  /** Emits the assignment id to reconcile */
  reconcile = output<string>();
  /** Emitted when issuer ready state changes (for parent to sync) */
  issuersReadyChange = output<boolean>();

  private readonly dnsZoneService = inject(ClusterDnsZoneService);
  private readonly sandbox = inject(SandboxService);

  private readonly wildcards = signal<Record<string, ClusterWildcard>>({});
  protected readonly publishingId = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.assignments();
      this.clusterId();
      void this.loadWildcards();
    });
  }

  protected showAssignForm = signal(false);
  protected removeConfirmId = signal<string | null>(null);
  protected submittedZoneId = signal<string | null>(null);
  protected localIssuersReady = signal(false);
  /** True immediately after the user assigns a new zone — forces configure-issuer form open */
  protected justAssigned = signal(false);
  protected certProviders = CertificateProvider;
  private readonly dnsIssuerSetup = viewChild<ClusterIssuerSetupComponent>('dnsIssuerSetup');

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

  /** ACME email the operator already gave on a zone — no reason to ask twice. */
  protected wildcardAcmeEmail = computed(() =>
    this.assignments().find(a => a.wildcardCertificate && a.acmeEmail)?.acmeEmail
      ?? this.assignments().find(a => a.acmeEmail)?.acmeEmail
      ?? ''
  );

  /** In flight locally, or reconciling server-side (issuer still registering with ACME). */
  protected isBusy(a: ClusterDnsZoneResponseDto): boolean {
    return this.reconcilingId() === a.id
      || a.reconciliationStatus === DnsReconciliationStatus.RECONCILING;
  }

  protected canReconcile(a: ClusterDnsZoneResponseDto): boolean {
    if (this.reconcilingId() === a.id) return false;
    return (
      needsReconciliation(a.reconciliationStatus ?? '') ||
      a.reconciliationStatus === DnsReconciliationStatus.RECONCILING
    );
  }

  protected cardClass(a: ClusterDnsZoneResponseDto): string {
    return this.isBusy(a)
      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
      : 'border-border';
  }

  protected badgeClass(a: ClusterDnsZoneResponseDto): string {
    if (this.isBusy(a)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return this.getStatusClass(a.reconciliationStatus);
  }

  protected assigningZoneName = computed(() =>
    this.availableZones().find(z => z.id === this.submittedZoneId())?.zoneName ?? 'DNS zone'
  );

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

  protected wildcardOf(
    a: ClusterDnsZoneResponseDto
  ): ClusterWildcard | undefined {
    return this.wildcards()[a.id];
  }

  private async loadWildcards(): Promise<void> {
    const clusterId = this.clusterId();
    if (!clusterId || this.sandbox.inSandbox()) return;
    for (const a of this.assignments()) {
      const state = await this.dnsZoneService.getClusterWildcard(clusterId, a.id);
      if (state) this.wildcards.update(m => ({ ...m, [a.id]: state }));
    }
  }

  protected async publishWildcard(a: ClusterDnsZoneResponseDto): Promise<void> {
    const clusterId = this.clusterId();
    if (!clusterId || this.publishingId()) return;
    this.publishingId.set(a.id);
    try {
      const state = await this.dnsZoneService.publishClusterWildcard(
        clusterId,
        a.id
      );
      if (state) this.wildcards.update(m => ({ ...m, [a.id]: state }));
    } finally {
      this.publishingId.set(null);
    }
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
    this.submittedZoneId.set(dto.dnsZoneId);
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
    this.dnsIssuerSetup()?.openForm();
  }
}
