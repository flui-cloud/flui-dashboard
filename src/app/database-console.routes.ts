import { Routes } from '@angular/router';

export const databaseConsoleRoutes: Routes = [
  {
    path: 'db-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/db-console-page.component'
      ).then((m) => m.DbConsolePageComponent),
    title: 'SQL Console - flui.cloud',
  },
  {
    path: 'kv-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/kv-console-page.component'
      ).then((m) => m.KvConsolePageComponent),
    title: 'Key Browser - flui.cloud',
  },
  {
    path: 'doc-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/document-console-page.component'
      ).then((m) => m.DocumentConsolePageComponent),
    title: 'Document Browser - flui.cloud',
  },
  {
    path: 'object-store-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/object-store-console-page.component'
      ).then((m) => m.ObjectStoreConsolePageComponent),
    title: 'Object Storage - flui.cloud',
  },
  {
    path: 'search-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/search-console-page.component'
      ).then((m) => m.SearchConsolePageComponent),
    title: 'Search Console - flui.cloud',
  },
  {
    path: 'messaging-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/messaging-console-page.component'
      ).then((m) => m.MessagingConsolePageComponent),
    title: 'Messaging Monitor - flui.cloud',
  },
  {
    path: 'cache-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/cache-console-page.component'
      ).then((m) => m.CacheConsolePageComponent),
    title: 'Cache Console - flui.cloud',
  },
  {
    path: 'secrets-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/secrets-console-page.component'
      ).then((m) => m.SecretsConsolePageComponent),
    title: 'Secrets Console - flui.cloud',
  },
  {
    path: 'kafka-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/kafka-console-page.component'
      ).then((m) => m.KafkaConsolePageComponent),
    title: 'Kafka Console - flui.cloud',
  },
  {
    path: 'meilisearch-console/:applicationId',
    loadComponent: () =>
      import(
        './features/components/database-console/meilisearch-console-page.component'
      ).then((m) => m.MeilisearchConsolePageComponent),
    title: 'Meilisearch Console - flui.cloud',
  },
];
