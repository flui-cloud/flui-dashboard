import { Routes } from '@angular/router';

export const appsRoutes: Routes = [
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
      import('./features/components/application/app-recap.component').then(
        (m) => m.AppRecapComponent
      ),
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
];
