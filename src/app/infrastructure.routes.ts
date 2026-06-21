import { Routes } from '@angular/router';

export const infrastructureRoutes: Routes = [
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
];
