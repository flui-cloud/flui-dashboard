import { Routes } from '@angular/router';

export const agentsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/components/agents/agents.component').then(
        (m) => m.AgentsComponent,
      ),
    title: 'Agents - flui.cloud',
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('./features/components/agents/agents.component').then(
        (m) => m.AgentsComponent,
      ),
    title: 'Agents - flui.cloud',
  },
  {
    path: 'requests/:proposalId',
    loadComponent: () =>
      import('./features/components/agents/agents.component').then(
        (m) => m.AgentsComponent,
      ),
    title: 'Agent request - flui.cloud',
  },
];
