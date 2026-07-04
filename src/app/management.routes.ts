import { Routes } from '@angular/router';

export const managementRoutes: Routes = [
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
    path: 'access',
    redirectTo: 'access/grants',
    pathMatch: 'full',
  },
  {
    path: 'access/:tab',
    loadComponent: () =>
      import('./features/components/access/access.component').then(
        (m) => m.AccessComponent,
      ),
    title: 'Access - flui.cloud',
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/components/projects/projects.component').then(
        (m) => m.ProjectsComponent,
      ),
    title: 'Projects - flui.cloud',
  },
  {
    path: 'migrations',
    loadComponent: () =>
      import(
        './features/components/migration/migrations-list.component'
      ).then((m) => m.MigrationsListComponent),
    title: 'Migrations - flui.cloud',
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
];
