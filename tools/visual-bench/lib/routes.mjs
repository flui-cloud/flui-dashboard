/**
 * The full route inventory the bench knows how to capture, built from the
 * survey (see the task brief) and cross-checked against app.routes.ts +
 * every nested *.routes.ts file. Two kinds of entries:
 *
 *   - a flat job {slug, path, auth, chartHeavy?, note?}
 *   - a group {slug, base, auth, tabs, chartHeavy?} expanded into one job
 *     per tab by buildJobs()
 *
 * `auth: 'anonymous'` means the route sits outside authGuard in
 * app.routes.ts and is captured with a bare (no storageState) context.
 * Everything else is captured with the saved reference session.
 *
 * Parametric groups read their id out of entity-ids.json. A group whose id
 * is still "UNRESOLVED" (or missing) is NOT expanded into jobs — it's
 * recorded as `skipped` in MANIFEST.json instead. Never invent an id here.
 */

const UNRESOLVED = new Set([undefined, null, '', 'UNRESOLVED']);
const resolved = (value) => !UNRESOLVED.has(value);

export function buildJobs(entityIds) {
  const jobs = [];
  const skipped = [];

  const addJob = (job) => jobs.push(job);
  const addSkip = (slug, reason) => skipped.push({ slug, reason });

  // Segment-wise substitution — never a blind string.replace(), since
  // placeholder names can be literal prefixes of one another
  // (":provider" vs. ":providerId") and a substring replace would corrupt
  // the longer one.
  const fillTemplate = (template, params) =>
    template
      .split('/')
      .map((segment) => (segment.startsWith(':') ? params[segment.slice(1)] : segment))
      .join('/');

  const addGroup = (group) => {
    const params = group.params ?? { id: group.id };
    const missing = Object.values(params).some((v) => !resolved(v));
    if (missing) {
      addSkip(group.slug, `entity id unresolved (${group.idSource})`);
      return;
    }
    const base = fillTemplate(group.base, params);
    if (!group.tabs) {
      addJob({ slug: group.slug, path: base, auth: group.auth, chartHeavy: group.chartHeavy });
      return;
    }
    for (const tab of group.tabs) {
      addJob({
        slug: `${group.slug}--${tab}`,
        path: `${base}/${tab}`,
        auth: group.auth,
        chartHeavy: group.chartHeavy?.includes(tab),
      });
    }
  };

  // ---- Anonymous routes (outside authGuard) --------------------------
  addJob({ slug: 'login', path: '/login', auth: 'anonymous' });
  addJob({
    slug: 'auth-callback',
    path: '/auth/callback',
    auth: 'anonymous',
    note: 'No OIDC code param supplied — captures whatever idle/error state the callback component shows without one, not a completed exchange.',
  });
  addJob({ slug: 'try', path: '/try', auth: 'anonymous' });
  addJob({
    slug: 'github-installed',
    path: '/github/installed',
    auth: 'anonymous',
    note: 'Renders outside the auth guard; captured without a completed GitHub App install redirect.',
  });

  // ---- Fixture-backed scaling section (anonymous, fully deterministic) -
  addJob({ slug: 'mock-scaling-overview', path: '/mock/scaling-section', auth: 'anonymous' });
  for (const tab of ['now', 'group', 'market', 'history']) {
    addJob({ slug: `mock-scaling-g-prod--${tab}`, path: `/mock/scaling-section/g-prod/${tab}`, auth: 'anonymous' });
  }

  // ---- Static routes under the guarded shell --------------------------
  const staticSession = [
    '/dashboard',
    '/apps/projects',
    '/apps/databases',
    '/apps/tools',
    '/apps/system',
    '/apps/applications',
    '/apps/repositories',
    '/apps/repositories/github-setup',
    '/apps/templates',
    '/apps/catalog',
    '/apps/image-registry',
    '/apps/build-namespace',
    '/apps/deploy/new',
    '/infrastructure/compute',
    '/infrastructure/firewall/clusters',
    '/infrastructure/firewall/provider-firewalls',
    '/infrastructure/keys',
    '/infrastructure/domains/zones',
    '/infrastructure/domains/issuers',
    '/infrastructure/domains/internal-hosting',
    '/infrastructure/domains/register',
    '/infrastructure/platform-components',
    '/infrastructure/vnet',
    '/infrastructure/vnet/new',
    '/management/providers',
    '/management/access/grants',
    '/management/access/people',
    '/management/access/groups',
    '/management/access/roles',
    '/management/operating-context',
    '/management/projects',
    '/management/migrations',
    '/management/backup/overview',
    '/management/backup/destinations',
    '/management/backup/destinations/new',
    '/management/backup/policies',
    '/management/backup/policies/new',
    '/management/backup/jobs',
    '/management/backup/restore',
    '/management/backup/restore/new',
    '/management/mail/overview',
    '/management/mail/activity',
    '/management/mail/domains',
    '/management/mail/suppressions',
    '/management/mail/providers',
    '/management/mail/setup',
    '/cluster',
    '/cluster/new',
    '/scaling',
    '/agents',
    '/agents/requests',
    '/settings',
  ];
  for (const path of staticSession) {
    addJob({ slug: slugify(path), path, auth: 'session' });
  }
  // chart-demo is a known non-determinism hazard (Math.random() dataset on
  // every load) — still captured, but flagged so MANIFEST.json records that
  // pixel-identical runs are not expected for this one file.
  addJob({
    slug: 'chart-demo',
    path: '/chart-demo',
    auth: 'session',
    chartHeavy: true,
    note: 'chart-demo.component.ts generates its dataset with Math.random() on every load — NOT expected to diff-clean between two runs. See README > Known non-determinism.',
  });

  // ---- Parametric groups -----------------------------------------------
  addGroup({
    slug: 'compute-instance',
    base: '/infrastructure/compute/:provider/:providerId',
    params: { provider: entityIds.instances?.provider, providerId: entityIds.instances?.providerId },
    idSource: 'GET /instances',
    auth: 'session',
  });
  addGroup({ slug: 'firewall', base: '/infrastructure/firewall/:id', id: entityIds.firewalls?.id, idSource: 'GET /infrastructure/firewalls', auth: 'session' });
  addGroup({ slug: 'vnet', base: '/infrastructure/vnet/:id', id: entityIds.vnets?.id, idSource: 'GET /vnets', auth: 'session' });
  addGroup({ slug: 'provider-detail', base: '/management/providers/:id', id: entityIds.providers?.id, idSource: 'GET /management/configurations', auth: 'session' });
  addGroup({ slug: 'backup-destination', base: '/management/backup/destinations/:id', id: entityIds.backupDestinations?.id, idSource: 'GET /backup-destinations', auth: 'session' });
  addGroup({ slug: 'backup-policy', base: '/management/backup/policies/:id', id: entityIds.backupPolicies?.id, idSource: 'GET /backup-policies', auth: 'session' });
  addGroup({ slug: 'backup-job', base: '/management/backup/jobs/:id', id: entityIds.backupJobs?.id, idSource: 'GET /backup-jobs/cluster/:clusterId', auth: 'session' });
  addGroup({ slug: 'restore-job', base: '/management/backup/restore/:id', id: entityIds.restoreJobs?.id, idSource: 'GET /restore-jobs', auth: 'session' });
  addGroup({ slug: 'agent-proposal', base: '/agents/requests/:id', id: entityIds.agentProposals?.id, idSource: 'GET /agent/proposals', auth: 'session' });
  addGroup({ slug: 'catalog-app', base: '/apps/catalog/:id', id: entityIds.catalog?.slug, idSource: 'GET /catalog', auth: 'session' });
  addGroup({ slug: 'catalog-install', base: '/apps/catalog/installs/:id', id: entityIds.catalogInstalls?.id, idSource: 'no list endpoint — see README', auth: 'session' });

  addGroup({
    slug: 'cluster-detail',
    base: '/cluster/:id',
    id: entityIds.clusters?.primary,
    idSource: 'GET /infrastructure/clusters',
    auth: 'session',
    tabs: ['overview', 'monitoring', 'network', 'storage', 'nodes', 'autoscaling', 'scaling', 'firewall', 'dns', 'variables', 'pricing', 'security'],
    chartHeavy: ['overview', 'monitoring', 'pricing'],
  });

  addGroup({
    slug: 'application-detail',
    base: '/apps/applications/:id',
    id: entityIds.applications?.generic,
    idSource: 'GET /clusters/:clusterId/applications',
    auth: 'session',
    tabs: ['overview', 'clients', 'monitoring', 'logs', 'revisions', 'configuration', 'resources', 'dns', 'builds', 'releases', 'snapshots', 'schedules', 'gateway', 'diagnoses', 'debug-pods'],
    chartHeavy: ['overview', 'monitoring', 'resources'],
  });
  addGroup({
    slug: 'application-recap',
    base: '/apps/recap/:id',
    id: entityIds.applications?.generic,
    idSource: 'same as application-detail',
    auth: 'session',
  });

  addGroup({
    slug: 'scaling-group-live',
    base: '/scaling/:id',
    id: entityIds.scalingGroups?.primary,
    idSource: 'GET /infrastructure/clusters/:clusterId/scaling-groups',
    auth: 'session',
    tabs: ['now', 'group', 'market', 'history'],
  });

  const consoleFamilies = [
    ['db-console', entityIds.applications?.postgresFamily, 'engine label: postgres/mysql-family'],
    ['kv-console', entityIds.applications?.redisFamily, 'engine label: redis-family'],
    ['doc-console', entityIds.applications?.documentStore, 'engine label: document-store (e.g. FerretDB)'],
    ['object-store-console', entityIds.applications?.objectStore, 'engine label: object-storage (e.g. Garage)'],
    ['search-console', entityIds.applications?.fulltext, 'engine label: fulltext (Meilisearch)'],
    ['messaging-console', entityIds.applications?.messaging, 'engine label: messaging (RabbitMQ)'],
    ['cache-console', entityIds.applications?.cache, 'engine label: cache (Memcached)'],
    ['secrets-console', entityIds.applications?.secrets, 'engine label: secrets (OpenBao)'],
    ['kafka-console', entityIds.applications?.kafka, 'engine label: kafka'],
    ['meilisearch-console', entityIds.applications?.fulltext, 'same instance as search-console, per project memory'],
  ];
  for (const [slug, id, idSource] of consoleFamilies) {
    addGroup({ slug, base: `/${slug}/:id`, id, idSource, auth: 'session' });
  }

  // ---- Transient / not-a-stable-entity routes: never resolvable, always
  // recorded as skipped so the manifest explains the gap instead of hiding it.
  for (const [slug, reason] of TRANSIENT_ROUTES) {
    addSkip(slug, reason);
  }

  return { jobs, skipped };
}

const TRANSIENT_ROUTES = [
  ['cluster-create-progress', '/cluster/create/:operationId only exists mid-provisioning; HARD RULES forbid triggering a real provision to capture it'],
  ['deploy-standalone-build', '/apps/deploy/standalone/:buildId only meaningful mid-build'],
  ['deploy-build-progress', '/apps/deploy/build/:applicationId/:buildId only meaningful mid-build; a terminal historical build (via app-builds list) would be a better deterministic stand-in once entity discovery works'],
  ['deploy-gha-build', '/apps/deploy/gha-build/:applicationId needs a GitHub Actions build in flight or history'],
  ['deploy-operation-progress', '/apps/deploy/:operationId is a generic deploy-operation progress view; a completed operation may not render meaningfully here'],
];

function slugify(path) {
  return path.replace(/^\//, '').replace(/\//g, '--') || 'root';
}
