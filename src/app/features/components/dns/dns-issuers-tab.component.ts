import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideServer } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { DnsRefreshService } from '../../service/dns-refresh.service';
import { ClusterCertificateIssuersComponent } from '../cluster/cluster-certificate-issuers.component';
import { ClusterIssuerSetupComponent } from '../cluster/cluster-issuer-setup.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { DnsClusterPicker } from './dns-cluster-picker';

@Component({
  selector: 'app-dns-issuers-tab',
  imports: [
    ClusterCertificateIssuersComponent,
    ClusterIssuerSetupComponent,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    DnsClusterPicker,
  ],
  providers: [provideIcons({ lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    @if (loading()) {
      <fl-panel title="Certificate issuers" [flush]="true">
        <fl-loading-state [rows]="3" />
      </fl-panel>
    } @else if (clusters().length === 0) {
      <fl-panel title="Certificate issuers" [flush]="true">
        <fl-empty-state
          icon="lucideServer"
          title="No clusters yet"
          body="Create a cluster to configure certificate issuers."
        />
      </fl-panel>
    } @else {
      <app-dns-cluster-picker
        [clusters]="clusters()"
        [value]="selectedClusterId()"
        (valueChange)="selectedClusterId.set($event)"
        (refresh)="refresh()"
      />

      @if (selectedClusterId(); as clusterId) {
        <app-cluster-certificate-issuers
          [clusterId]="clusterId"
          [refreshTrigger]="issuersRefreshTrigger()"
        />
        <app-cluster-issuer-setup
          [clusterId]="clusterId"
          [refreshTrigger]="issuersRefreshTrigger()"
        />
      } @else {
        <fl-panel title="Certificate issuers" [flush]="true">
          <fl-empty-state
            icon="lucideServer"
            title="No cluster selected"
            body="Select a cluster to view and configure its certificate issuers."
          />
        </fl-panel>
      }
    }
  `,
})
export class DnsIssuersTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly refreshService = inject(DnsRefreshService);

  protected readonly clusters = this.clusterService.clusters;
  protected readonly loading = signal(false);
  protected readonly selectedClusterId = signal('');
  protected readonly issuersRefreshTrigger = signal(0);

  constructor() {
    effect(() => {
      const trigger = this.refreshService.trigger();
      if (trigger > 0) {
        this.issuersRefreshTrigger.update((n) => n + 1);
      }
    });
  }

  refresh(): void {
    this.issuersRefreshTrigger.update((n) => n + 1);
  }

  ngOnInit(): void {
    void (async () => {
      this.loading.set(true);
      await this.clusterService.loadClusters();
      this.loading.set(false);
      const list = this.clusters();
      if (list.length === 1 && list[0].id) {
        this.selectedClusterId.set(list[0].id);
      }
    })();
  }
}
