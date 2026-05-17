import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DashboardService } from '../../service/dashboard.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { DashboardPulseComponent } from './dashboard-pulse.component';
import { DashboardOperationsComponent } from './dashboard-operations.component';
import { DashboardProvidersComponent } from './dashboard-providers.component';
import { DashboardAppsComponent } from './dashboard-apps.component';
import { DashboardClustersComponent } from './dashboard-clusters.component';
import { DashboardCertsComponent } from './dashboard-certs.component';
import { DashboardActivityComponent } from './dashboard-activity.component';
import { DashboardBackupsComponent } from './dashboard-backups.component';
import { DashboardCredentialsBannerComponent } from './dashboard-credentials-banner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardPulseComponent,
    DashboardOperationsComponent,
    DashboardProvidersComponent,
    DashboardAppsComponent,
    DashboardClustersComponent,
    DashboardCertsComponent,
    DashboardActivityComponent,
    DashboardBackupsComponent,
    DashboardCredentialsBannerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 p-4 md:p-6 min-h-full">

      <!-- Global Platform Pulse -->
      <app-dashboard-pulse />

      <!-- Credentials status banner (only shown when something needs attention) -->
      <app-dashboard-credentials-banner />

      @if (isInitializing()) {

        <!-- Skeleton: 4-card grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          @for (_ of [1,2,3,4]; track _) {
            <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
              <div class="flex items-center gap-2.5">
                <div class="h-8 w-8 rounded-lg bg-muted animate-pulse"></div>
                <div class="flex flex-col gap-1.5 flex-1">
                  <div class="h-3 w-24 rounded bg-muted animate-pulse"></div>
                  <div class="h-2.5 w-16 rounded bg-muted animate-pulse"></div>
                </div>
              </div>
              <div class="h-9 w-14 rounded bg-muted animate-pulse"></div>
              <div class="flex flex-col gap-2 flex-1">
                <div class="h-3 w-full rounded bg-muted animate-pulse"></div>
                <div class="h-3 w-4/5 rounded bg-muted animate-pulse"></div>
                <div class="h-3 w-3/5 rounded bg-muted animate-pulse"></div>
              </div>
            </div>
          }
        </div>

        <!-- Skeleton: activity timeline -->
        <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
          <div class="h-4 w-40 rounded bg-muted animate-pulse"></div>
          @for (_ of [1,2,3,4]; track _) {
            <div class="flex items-center gap-4 py-1">
              <div class="h-6 w-6 rounded-full bg-muted animate-pulse flex-shrink-0"></div>
              <div class="flex-1 flex justify-between gap-4">
                <div class="h-3 w-32 rounded bg-muted animate-pulse"></div>
                <div class="h-3 w-12 rounded bg-muted animate-pulse"></div>
              </div>
            </div>
          }
        </div>

      } @else {

        <!-- Active Operations (condizionale) -->
        <app-dashboard-operations />

        <!-- Main grid: Certs first when not complete, otherwise last -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          @if (certsFirst()) {
            <app-dashboard-certs />
          }
          <app-dashboard-providers />
          <app-dashboard-apps />
          <app-dashboard-clusters />
          @if (!certsFirst()) {
            <app-dashboard-certs />
          }
        </div>

        <!-- Backups status (full-width slim banner) -->
        <app-dashboard-backups />

        <!-- Recent Activity (full width) -->
        <app-dashboard-activity />
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly dnsService = inject(DashboardDnsService);

  isInitializing = signal(true);
  certsFirst = computed(() => !this.dnsService.isFullyConfigured());

  ngOnInit(): void {
    void (async () => {
      await this.dashboardService.initialize();
      this.isInitializing.set(false);
    })();
  }
}
