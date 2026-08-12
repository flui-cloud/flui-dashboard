import { Routes } from '@angular/router';

export const mailRoutes: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  {
    path: 'overview',
    loadComponent: () =>
      import('./features/components/mail/mail-overview.component').then(
        (m) => m.MailOverviewComponent,
      ),
    title: 'Mail - flui.cloud',
  },
  {
    path: 'activity',
    loadComponent: () =>
      import('./features/components/mail/mail-activity.component').then(
        (m) => m.MailActivityComponent,
      ),
    title: 'Mail activity - flui.cloud',
  },
  {
    path: 'domains',
    loadComponent: () =>
      import('./features/components/mail/mail-domains.component').then(
        (m) => m.MailDomainsComponent,
      ),
    title: 'Sending domains - flui.cloud',
  },
  {
    path: 'suppressions',
    loadComponent: () =>
      import('./features/components/mail/mail-suppressions.component').then(
        (m) => m.MailSuppressionsComponent,
      ),
    title: 'Suppressions - flui.cloud',
  },
  {
    path: 'providers',
    loadComponent: () =>
      import('./features/components/mail/mail-providers.component').then(
        (m) => m.MailProvidersComponent,
      ),
    title: 'Mail providers - flui.cloud',
  },
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/components/mail/mail-setup.component').then(
        (m) => m.MailSetupComponent,
      ),
    title: 'Mail setup - flui.cloud',
  },
];
