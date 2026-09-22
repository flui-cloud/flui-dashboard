import { Routes } from '@angular/router';

export const scalingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/components/scaling-section/scaling-overview.component').then(
        (m) => m.ScalingOverviewComponent
      ),
    title: 'Scaling - flui.cloud',
  },
  {
    path: ':groupId',
    loadComponent: () =>
      import('./features/components/scaling-section/group-shell.component').then(
        (m) => m.ScalingGroupShellComponent
      ),
    title: 'Scaling group - flui.cloud',
    children: [
      { path: '', redirectTo: 'now', pathMatch: 'full' },
      {
        path: 'now',
        loadComponent: () =>
          import('./features/components/scaling-section/tab-now.component').then(
            (m) => m.ScalingNowTabComponent
          ),
      },
      {
        path: 'group',
        loadComponent: () =>
          import('./features/components/scaling-section/tab-group.component').then(
            (m) => m.ScalingGroupTabComponent
          ),
      },
      {
        path: 'market',
        loadComponent: () =>
          import('./features/components/scaling-section/tab-market.component').then(
            (m) => m.ScalingMarketTabComponent
          ),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/components/scaling-section/tab-history.component').then(
            (m) => m.ScalingHistoryTabComponent
          ),
      },
    ],
  },
];
