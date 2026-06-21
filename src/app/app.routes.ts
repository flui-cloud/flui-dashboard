import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { databaseConsoleRoutes } from './database-console.routes';
import { infrastructureRoutes } from './infrastructure.routes';
import { appsRoutes } from './apps.routes';
import { managementRoutes } from './management.routes';
import { clusterRoutes } from './cluster.routes';

export const routes: Routes = [
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
  {
    path: 'repositories',
    redirectTo: '/apps/repositories',
    pathMatch: 'prefix',
  },
  {
    path: 'github/installed',
    loadComponent: () =>
      import(
        './features/components/application/github-installed.component'
      ).then((m) => m.GithubInstalledComponent),
    title: 'GitHub — flui.cloud',
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/components/shell/shell-layout.component').then(
        (m) => m.ShellLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/components/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        title: 'Dashboard - flui.cloud',
      },

      ...databaseConsoleRoutes,

      {
        path: 'infrastructure',
        children: infrastructureRoutes,
      },
      {
        path: 'apps',
        children: appsRoutes,
      },
      {
        path: 'management',
        children: managementRoutes,
      },
      {
        path: 'cluster',
        children: clusterRoutes,
      },

      {
        path: 'settings',
        loadComponent: () =>
          import('./features/components/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
        title: 'Settings - flui.cloud',
      },
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

  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
