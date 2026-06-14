import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

const ComputeComponent = () =>
  import('./shared/components/grid/grid.component').then(
    (m) => m.GridComponent
  );

export const routes: Routes = [
  // Auth Routes (public — no shell)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/components/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
    title: 'Login - flui.cloud',
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/components/auth/callback/callback.component').then(
        (m) => m.CallbackComponent
      ),
    title: 'Auth - flui.cloud',
  },

  // OAuth Callback Redirect (GitHub redirects to /repositories but actual route is /apps/repositories)
  {
    path: 'repositories',
    redirectTo: '/apps/repositories',
    pathMatch: 'prefix',
  },

  // GitHub App install result landing (public — no shell, no guard).
  // Target of the backend redirect after POST /api/v1/repositories/github-app/user-callback.
  {
    path: 'github/installed',
    loadComponent: () =>
      import(
        './features/components/application/github-installed.component'
      ).then((m) => m.GithubInstalledComponent),
    title: 'GitHub — flui.cloud',
  },

  // Protected Routes — wrapped in ShellLayoutComponent (sidebar + header)
  {
    path: '',
    loadComponent: () =>
      import('./layout/components/shell/shell-layout.component').then(
        (m) => m.ShellLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      // Redirect root to dashboard
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },

      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/components/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        title: 'Dashboard - flui.cloud',
      },

      // SQL console — stable, dedicated URL; DB target is a path param.
      {
        path: 'db-console/:applicationId',
        loadComponent: () =>
          import(
            './features/components/database-console/db-console-page.component'
          ).then((m) => m.DbConsolePageComponent),
        title: 'SQL Console - flui.cloud',
      },

      // Key-value console (Redis/Valkey) — separate console, routed by engine family.
      {
        path: 'kv-console/:applicationId',
        loadComponent: () =>
          import(
            './features/components/database-console/kv-console-page.component'
          ).then((m) => m.KvConsolePageComponent),
        title: 'Key Browser - flui.cloud',
      },

      // Infrastructure Routes
      {
        path: 'infrastructure',
        children: [
          {
            path: '',
            redirectTo: 'compute',
            pathMatch: 'full',
          },
          {
            path: 'compute',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import(
                    './features/components/compute/compute-instances.component'
                  ).then((m) => m.ComputeInstancesComponent),
                title: 'Compute - flui.cloud',
              },
              {
                path: ':provider/:providerId',
                loadComponent: () =>
                  import(
                    './features/components/compute/instance-detail.component'
                  ).then((m) => m.InstanceDetailComponent),
                title: 'Instance Details - flui.cloud',
              },
            ],
          },
          {
            path: 'firewall',
            children: [
              {
                path: '',
                redirectTo: 'clusters',
                pathMatch: 'full',
              },
              {
                path: 'clusters',
                loadComponent: () =>
                  import(
                    './features/components/firewall/firewall-cluster-management.component'
                  ).then((m) => m.FirewallClusterManagementComponent),
                title: 'Cluster Firewalls - flui.cloud',
              },
              {
                path: 'provider-firewalls',
                loadComponent: () =>
                  import(
                    './features/components/firewall/firewall-provider-instances.component'
                  ).then((m) => m.FirewallProviderInstancesComponent),
                title: 'Provider Firewalls - flui.cloud',
              },
              {
                path: ':id',
                loadComponent: () =>
                  import(
                    './features/components/firewall/firewall-detail.component'
                  ).then((m) => m.FirewallDetailComponent),
                title: 'Firewall Details - flui.cloud',
              },
            ],
          },
          {
            path: 'keys',
            loadComponent: () =>
              import('./features/components/ssh-keys.component').then(
                (m) => m.SshKeysComponent
              ),
            title: 'SSH Keys - flui.cloud',
          },
          {
            path: 'domains',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/components/dns/dns-shell.component').then(
                    (m) => m.DnsShellComponent
                  ),
                title: 'DNS Zones - flui.cloud',
                children: [
                  { path: '', redirectTo: 'zones', pathMatch: 'full' },
                  {
                    path: 'zones',
                    loadComponent: () =>
                      import('./features/components/dns/dns-zones-list.component').then(
                        (m) => m.DnsZonesListComponent
                      ),
                    title: 'Registered Zones - flui.cloud',
                  },
                  {
                    path: 'issuers',
                    loadComponent: () =>
                      import('./features/components/dns/dns-issuers-tab.component').then(
                        (m) => m.DnsIssuersTabComponent
                      ),
                    title: 'Certificate Issuers - flui.cloud',
                  },
                  {
                    path: 'internal-hosting',
                    loadComponent: () =>
                      import('./features/components/dns/dns-internal-hosting-tab.component').then(
                        (m) => m.DnsInternalHostingTabComponent
                      ),
                    title: 'Internal Hosting - flui.cloud',
                  },
                ],
              },
              {
                path: 'register',
                loadComponent: () =>
                  import('./features/components/dns/dns-zone-register.component').then(
                    (m) => m.DnsZoneRegisterComponent
                  ),
                title: 'Register DNS Zone - flui.cloud',
              },
            ],
          },
          {
            path: 'platform-components',
            loadComponent: () =>
              import(
                './features/components/platform-components/platform-components-list.component'
              ).then((m) => m.PlatformComponentsListComponent),
            title: 'Platform Components - flui.cloud',
          },
          {
            path: 'app-proxy',
            redirectTo: '/settings',
            pathMatch: 'full',
          },
          {
            path: 'vnet',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/components/vnet/vnet-list.component').then(
                    (m) => m.VNetListComponent
                  ),
                title: 'Virtual Networks - flui.cloud',
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./features/components/vnet/vnet-create.component').then(
                    (m) => m.VNetCreateComponent
                  ),
                title: 'Create VNet - flui.cloud',
              },
              {
                path: ':id',
                loadComponent: () =>
                  import('./features/components/vnet/vnet-details.component').then(
                    (m) => m.VNetDetailsComponent
                  ),
                title: 'VNet Details - flui.cloud',
              },
            ],
          },
        ],
      },

      // Applications Routes
      {
        path: 'apps',
        children: [
          {
            path: '',
            redirectTo: 'applications',
            pathMatch: 'full',
          },
          {
            path: 'databases',
            loadComponent: () =>
              import(
                './features/components/application/applications-list.component'
              ).then((m) => m.ApplicationsListComponent),
            data: { kind: 'DATABASE' },
            title: 'Databases - flui.cloud',
          },
          {
            path: 'tools',
            loadComponent: () =>
              import(
                './features/components/application/applications-list.component'
              ).then((m) => m.ApplicationsListComponent),
            data: { kind: 'TOOL' },
            title: 'Tools - flui.cloud',
          },
          {
            path: 'system',
            loadComponent: () =>
              import(
                './features/components/application/applications-list.component'
              ).then((m) => m.ApplicationsListComponent),
            data: { kind: 'SYSTEM' },
            title: 'System Apps - flui.cloud',
          },
          {
            path: 'applications',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import(
                    './features/components/application/applications-list.component'
                  ).then((m) => m.ApplicationsListComponent),
                data: { kind: 'APPLICATION' },
                title: 'Applications - flui.cloud',
              },
              {
                path: ':id',
                loadComponent: () =>
                  import(
                    './features/components/application/application-detail.component'
                  ).then((m) => m.ApplicationDetailComponent),
                title: 'Application Details - flui.cloud',
                children: [
                  { path: '', redirectTo: 'overview', pathMatch: 'full' },
                  {
                    path: 'overview',
                    loadComponent: () =>
                      import('./features/components/application/app-overview-tab.component').then(
                        (m) => m.AppOverviewTabComponent
                      ),
                  },
                  {
                    path: 'clients',
                    loadComponent: () =>
                      import('./features/components/application/app-clients-tab.component').then(
                        (m) => m.AppClientsTabComponent
                      ),
                  },
                  {
                    path: 'monitoring',
                    loadComponent: () =>
                      import('./features/components/application/app-monitoring-tab.component').then(
                        (m) => m.AppMonitoringTabComponent
                      ),
                  },
                  {
                    path: 'logs',
                    loadComponent: () =>
                      import('./features/components/application/app-logs-tab.component').then(
                        (m) => m.AppLogsTabComponent
                      ),
                  },
                  {
                    path: 'revisions',
                    loadComponent: () =>
                      import('./features/components/application/app-revisions-tab.component').then(
                        (m) => m.AppRevisionsTabComponent
                      ),
                  },
                  {
                    path: 'configuration',
                    loadComponent: () =>
                      import('./features/components/application/app-configuration-tab.component').then(
                        (m) => m.AppConfigurationTabComponent
                      ),
                  },
                  {
                    path: 'resources',
                    loadComponent: () =>
                      import('./features/components/application/app-resources-tab.component').then(
                        (m) => m.AppResourcesTabComponent
                      ),
                  },
                  {
                    path: 'dns',
                    loadComponent: () =>
                      import('./features/components/application/app-dns-tab.component').then(
                        (m) => m.AppDnsTabComponent
                      ),
                  },
                  {
                    path: 'builds',
                    loadComponent: () =>
                      import('./features/components/application/builds/app-builds-list.component').then(
                        (m) => m.AppBuildsListComponent
                      ),
                  },
                  {
                    path: 'releases',
                    loadComponent: () =>
                      import('./features/components/application/app-images-tab.component').then(
                        (m) => m.AppImagesTabComponent
                      ),
                  },
                  { path: 'images', redirectTo: 'releases', pathMatch: 'full' },
                  {
                    path: 'snapshots',
                    loadComponent: () =>
                      import('./features/components/application/app-snapshots-tab.component').then(
                        (m) => m.AppSnapshotsTabComponent
                      ),
                  },
                  {
                    path: 'diagnoses',
                    loadComponent: () =>
                      import(
                        './features/components/application/crash-diagnoses/app-diagnoses-tab.component'
                      ).then((m) => m.AppDiagnosesTabComponent),
                  },
                  {
                    path: 'debug-pods',
                    loadComponent: () =>
                      import(
                        './features/components/application/pod-debug/app-pod-debug-tab.component'
                      ).then((m) => m.AppPodDebugTabComponent),
                  },
                ],
              },
            ],
          },
          {
            path: 'recap/:id',
            loadComponent: () =>
              import(
                './features/components/application/app-recap.component'
              ).then((m) => m.AppRecapComponent),
            title: 'App Recap - flui.cloud',
          },
          {
            path: 'repositories',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import(
                    './features/components/application/repositories-list.component'
                  ).then((m) => m.RepositoriesListComponent),
                title: 'Repositories - flui.cloud',
              },
              {
                path: 'github-setup',
                loadComponent: () =>
                  import(
                    './features/components/application/github-setup-wizard.component'
                  ).then((m) => m.GithubSetupWizardComponent),
                title: 'Setup GitHub Integration - flui.cloud',
              },
            ],
          },
          {
            path: 'templates',
            loadComponent: () =>
              import(
                './features/components/application/templates-catalog.component'
              ).then((m) => m.TemplatesCatalogComponent),
            title: 'Templates - flui.cloud',
          },
          {
            path: 'catalog',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import(
                    './features/components/catalog/catalog-list.component'
                  ).then((m) => m.CatalogListComponent),
                title: 'App Catalog - flui.cloud',
              },
              {
                path: 'installs/:id',
                loadComponent: () =>
                  import(
                    './features/components/catalog/catalog-install-detail.component'
                  ).then((m) => m.CatalogInstallDetailComponent),
                title: 'Install Details - flui.cloud',
              },
              {
                path: ':slug',
                loadComponent: () =>
                  import(
                    './features/components/catalog/catalog-detail.component'
                  ).then((m) => m.CatalogDetailComponent),
                title: 'App Details - flui.cloud',
              },
            ],
          },
          {
            path: 'image-registry',
            loadComponent: () =>
              import(
                './features/components/image-registry/image-registry-list.component'
              ).then((m) => m.ImageRegistryListComponent),
            title: 'Image Registry - flui.cloud',
          },
          {
            path: 'build-namespace',
            loadComponent: () =>
              import(
                './features/components/application/build-namespace.component'
              ).then((m) => m.BuildNamespaceComponent),
            title: 'Build Queue - flui.cloud',
          },
          {
            path: 'deploy',
            children: [
              {
                path: '',
                redirectTo: 'new',
                pathMatch: 'full',
              },
              {
                path: 'new',
                loadComponent: () =>
                  import(
                    './features/components/application/deploy-wizard.component'
                  ).then((m) => m.DeployWizardComponent),
                title: 'Deploy Application - flui.cloud',
              },
              {
                path: 'standalone/:buildId',
                loadComponent: () =>
                  import(
                    './features/components/application/standalone-build-progress.component'
                  ).then((m) => m.StandaloneBuildProgressComponent),
                title: 'Building Application - flui.cloud',
              },
              {
                path: 'build/:applicationId/:buildId',
                loadComponent: () =>
                  import(
                    './features/components/application/app-build-progress.component'
                  ).then((m) => m.AppBuildProgressComponent),
                title: 'Building Application - flui.cloud',
              },
              {
                path: 'gha-build/:applicationId',
                loadComponent: () =>
                  import(
                    './features/components/application/github-actions-monitor.component'
                  ).then((m) => m.GithubActionsMonitorComponent),
                title: 'GitHub Actions Build - flui.cloud',
              },
              {
                path: ':operationId',
                loadComponent: () =>
                  import(
                    './features/components/application/deploy-progress.component'
                  ).then((m) => m.DeployProgressComponent),
                title: 'Deploying Application - flui.cloud',
              },
            ],
          },
        ],
      },

      // Management Routes
      {
        path: 'management',
        children: [
          {
            path: '',
            redirectTo: 'providers',
            pathMatch: 'full',
          },
          {
            path: 'providers',
            loadComponent: () =>
              import(
                './features/components/provider/providers-management.component'
              ).then((m) => m.ProvidersManagementComponent),
            title: 'Providers - flui.cloud',
          },
          {
            path: 'providers/:id',
            loadComponent: () =>
              import(
                './features/components/provider/provider-manage.component'
              ).then((m) => m.ProviderManageComponent),
            title: 'Manage Provider - flui.cloud',
          },
          {
            path: 'backup',
            children: [
              { path: '', redirectTo: 'overview', pathMatch: 'full' },
              {
                path: 'overview',
                loadComponent: () =>
                  import(
                    './features/components/backup/backup-overview/backup-overview.component'
                  ).then((m) => m.BackupOverviewComponent),
                title: 'Backup - flui.cloud',
              },
              {
                path: 'destinations',
                loadComponent: () =>
                  import(
                    './features/components/backup/destinations/destinations-list.component'
                  ).then((m) => m.DestinationsListComponent),
                title: 'Backup destinations - flui.cloud',
              },
              {
                path: 'destinations/new',
                loadComponent: () =>
                  import(
                    './features/components/backup/destinations/destination-form.component'
                  ).then((m) => m.DestinationFormComponent),
                title: 'New destination - flui.cloud',
              },
              {
                path: 'destinations/:id',
                loadComponent: () =>
                  import(
                    './features/components/backup/destinations/destination-detail.component'
                  ).then((m) => m.DestinationDetailComponent),
                title: 'Destination - flui.cloud',
              },
              {
                path: 'policies',
                loadComponent: () =>
                  import(
                    './features/components/backup/policies/policies-list.component'
                  ).then((m) => m.PoliciesListComponent),
                title: 'Backup policies - flui.cloud',
              },
              {
                path: 'policies/new',
                loadComponent: () =>
                  import(
                    './features/components/backup/policies/policy-wizard.component'
                  ).then((m) => m.PolicyWizardComponent),
                title: 'New policy - flui.cloud',
              },
              {
                path: 'policies/:id',
                loadComponent: () =>
                  import(
                    './features/components/backup/policies/policy-detail.component'
                  ).then((m) => m.PolicyDetailComponent),
                title: 'Policy - flui.cloud',
              },
              {
                path: 'jobs',
                loadComponent: () =>
                  import(
                    './features/components/backup/jobs/jobs-list.component'
                  ).then((m) => m.JobsListComponent),
                title: 'Backup jobs - flui.cloud',
              },
              {
                path: 'jobs/:id',
                loadComponent: () =>
                  import(
                    './features/components/backup/jobs/job-detail.component'
                  ).then((m) => m.JobDetailComponent),
                title: 'Backup job - flui.cloud',
              },
              {
                path: 'restore',
                loadComponent: () =>
                  import(
                    './features/components/backup/restore/restore-list.component'
                  ).then((m) => m.RestoreListComponent),
                title: 'Restore jobs - flui.cloud',
              },
              {
                path: 'restore/new',
                loadComponent: () =>
                  import(
                    './features/components/backup/restore/restore-wizard.component'
                  ).then((m) => m.RestoreWizardComponent),
                title: 'New restore - flui.cloud',
              },
              {
                path: 'restore/:id',
                loadComponent: () =>
                  import(
                    './features/components/backup/restore/restore-detail.component'
                  ).then((m) => m.RestoreDetailComponent),
                title: 'Restore job - flui.cloud',
              },
            ],
          },
        ],
      },

      // Cluster Routes
      {
        path: 'cluster',
        children: [
          {
            path: '',
            loadComponent: () =>
              import(
                './features/components/cluster/cluster-list.component'
              ).then((m) => m.ClusterListComponent),
            title: 'Clusters - flui.cloud',
          },
          {
            path: 'overview',
            redirectTo: '',
            pathMatch: 'full',
          },
          {
            path: 'new',
            loadComponent: () =>
              import(
                './features/components/cluster/cluster-creation-wizard.component'
              ).then((m) => m.ClusterCreationWizardComponent),
            title: 'Create Cluster - flui.cloud',
          },
          {
            path: 'create/:operationId',
            loadComponent: () =>
              import(
                './features/components/cluster/cluster-progress-tracker.component'
              ).then((m) => m.ClusterProgressTrackerComponent),
            title: 'Creating Cluster - flui.cloud',
          },
          {
            path: ':id',
            loadComponent: () =>
              import(
                './features/components/cluster/cluster-dashboard.component'
              ).then((m) => m.ClusterDashboardComponent),
            title: 'Cluster Details - flui.cloud',
            children: [
              { path: '', redirectTo: 'overview', pathMatch: 'full' },
              {
                path: 'overview',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-overview-tab.component').then(
                    (m) => m.ClusterOverviewTabComponent
                  ),
              },
              {
                path: 'monitoring',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-monitoring-tab.component').then(
                    (m) => m.ClusterMonitoringTabComponent
                  ),
              },
              {
                path: 'network',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-network-tab.component').then(
                    (m) => m.ClusterNetworkTabComponent
                  ),
              },
              {
                path: 'storage',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-storage-tab.component').then(
                    (m) => m.ClusterStorageTabComponent
                  ),
              },
              {
                path: 'nodes',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-nodes-tab.component').then(
                    (m) => m.ClusterNodesTabComponent
                  ),
              },
              {
                path: 'autoscaling',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-autoscaling-tab.component').then(
                    (m) => m.ClusterAutoscalingTabComponent
                  ),
              },
              {
                path: 'firewall',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-firewall-tab.component').then(
                    (m) => m.ClusterFirewallTabComponent
                  ),
              },
              {
                path: 'dns',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-dns-tab.component').then(
                    (m) => m.ClusterDnsTabComponent
                  ),
              },
              {
                path: 'variables',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-variables-tab.component').then(
                    (m) => m.ClusterVariablesTabComponent
                  ),
              },
              {
                path: 'pricing',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-pricing-tab.component').then(
                    (m) => m.ClusterPricingTabComponent
                  ),
              },
              {
                path: 'security',
                loadComponent: () =>
                  import('./features/components/cluster/cluster-security-tab.component').then(
                    (m) => m.ClusterSecurityTabComponent
                  ),
              },
            ],
          },
        ],
      },

      // Settings
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/components/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
        title: 'Settings - flui.cloud',
      },

      // Chart Demo (temporary - for development/testing)
      {
        path: 'chart-demo',
        loadComponent: () =>
          import('./shared/components/charts/chart-demo/chart-demo.component').then(
            (m) => m.ChartDemoComponent
          ),
        title: 'Chart Demo - flui.cloud',
      },
    ],
  },

  // Wildcard route - keep last
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
