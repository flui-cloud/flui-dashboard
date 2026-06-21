import { Routes } from '@angular/router';

export const clusterRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/components/cluster/cluster-list.component').then(
        (m) => m.ClusterListComponent
      ),
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
];
