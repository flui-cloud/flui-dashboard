/**
 * Best-effort, read-only fill-in for entity-ids.json, once run from a
 * process that actually has API access (this bench was built from a
 * subagent whose vault agent socket was unreachable — see the survey's
 * PRIMARY BLOCKER and README > Entity discovery. Never invents an id: a
 * field that can't be resolved is left as "UNRESOLVED" exactly as the
 * template has it, with the reason logged to stderr.
 *
 * Usage:
 *   FLUI_API_KEY=... node discover-entities.mjs
 *
 * Deliberately does NOT go through the CLI's vault/openProfileKey() — that
 * path is unix-socket-scoped to whichever process unlocked it, which is
 * exactly the blocker this script exists to route around. Pass a real API
 * key directly (never printed, never logged).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { API_URL, ENTITY_IDS_FILE } from './lib/config.mjs';

const API_KEY = process.env.FLUI_API_KEY;
if (!API_KEY) {
  console.error('FLUI_API_KEY is not set. This script makes only read GETs, but still needs a real key.');
  process.exit(2);
}

async function get(pathname) {
  const res = await fetch(`${API_URL}/api/v1${pathname}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${pathname}`);
  }
  return res.json();
}

const list = (body) => (Array.isArray(body) ? body : (body?.data ?? body?.items ?? []));

async function tryGet(label, pathname, extract) {
  try {
    const body = await get(pathname);
    const value = extract(body);
    if (value === undefined || value === null || value === '') {
      console.error(`${label}: ${pathname} returned no usable value — leaving UNRESOLVED`);
      return undefined;
    }
    return value;
  } catch (err) {
    console.error(`${label}: ${pathname} failed (${err.message}) — leaving UNRESOLVED`);
    return undefined;
  }
}

const ENGINE_MATCHERS = {
  postgresFamily: /postgres|mysql/i,
  redisFamily: /redis/i,
  documentStore: /ferret|mongo|document/i,
  objectStore: /garage|object.?store|s3/i,
  fulltext: /meilisearch|fulltext|search/i,
  messaging: /rabbitmq|amqp|messaging/i,
  cache: /memcached|cache/i,
  secrets: /openbao|vault|secrets/i,
  kafka: /kafka/i,
};

async function main() {
  const entityIds = JSON.parse(await readFile(ENTITY_IDS_FILE, 'utf8'));

  const clusters = await tryGet('clusters', '/infrastructure/clusters', (b) => list(b)[0]?.id);
  if (clusters) entityIds.clusters.primary = clusters;

  if (entityIds.clusters.primary && entityIds.clusters.primary !== 'UNRESOLVED') {
    const clusterId = entityIds.clusters.primary;

    const apps = await tryGet(
      'applications',
      `/clusters/${clusterId}/applications`,
      (b) => list(b),
    );
    if (Array.isArray(apps) && apps.length) {
      entityIds.applications.generic = apps[0].id ?? entityIds.applications.generic;
      for (const [key, matcher] of Object.entries(ENGINE_MATCHERS)) {
        const hit = apps.find((a) => matcher.test(`${a.engine ?? ''} ${a.image ?? ''} ${a.name ?? ''}`));
        if (hit) entityIds.applications[key] = hit.id;
      }
    }

    const scalingGroups = await tryGet(
      'scalingGroups',
      `/infrastructure/clusters/${clusterId}/scaling-groups`,
      (b) => list(b)[0]?.id,
    );
    if (scalingGroups) entityIds.scalingGroups.primary = scalingGroups;

    const backupJobs = await tryGet('backupJobs', `/backup-jobs/cluster/${clusterId}`, (b) => list(b)[0]?.id);
    if (backupJobs) entityIds.backupJobs.id = backupJobs;
  }

  const instances = await tryGet('instances', '/instances', (b) => list(b)[0]);
  if (instances) {
    entityIds.instances.provider = instances.provider ?? entityIds.instances.provider;
    entityIds.instances.providerId = instances.providerId ?? instances.id ?? entityIds.instances.providerId;
  }

  const firewall = await tryGet('firewalls', '/infrastructure/firewalls', (b) => list(b)[0]?.id);
  if (firewall) entityIds.firewalls.id = firewall;

  const vnet = await tryGet('vnets', '/vnets', (b) => list(b)[0]?.id);
  if (vnet) entityIds.vnets.id = vnet;

  const backupDestination = await tryGet('backupDestinations', '/backup-destinations', (b) => list(b)[0]?.id);
  if (backupDestination) entityIds.backupDestinations.id = backupDestination;

  const backupPolicy = await tryGet('backupPolicies', '/backup-policies', (b) => list(b)[0]?.id);
  if (backupPolicy) entityIds.backupPolicies.id = backupPolicy;

  const restoreJob = await tryGet('restoreJobs', '/restore-jobs', (b) => list(b)[0]?.id);
  if (restoreJob) entityIds.restoreJobs.id = restoreJob;

  const agentProposal = await tryGet('agentProposals', '/agent/proposals', (b) => list(b)[0]?.id);
  if (agentProposal) entityIds.agentProposals.id = agentProposal;

  const catalogSlug = await tryGet('catalog', '/catalog', (b) => list(b)[0]?.slug);
  if (catalogSlug) entityIds.catalog.slug = catalogSlug;

  // catalog installs: no list endpoint exists (see entity-ids.json's own
  // note). Left UNRESOLVED unless a resolved application happens to carry
  // an install-provenance field — inspected here on a best-effort basis,
  // never guessed.
  if (entityIds.applications.generic && entityIds.applications.generic !== 'UNRESOLVED') {
    const app = await tryGet(
      'catalogInstalls',
      `/clusters/${entityIds.clusters.primary}/applications`,
      (b) => list(b).find((a) => a.id === entityIds.applications.generic)?.catalogInstallId,
    );
    if (app) entityIds.catalogInstalls.id = app;
  }

  await writeFile(ENTITY_IDS_FILE, JSON.stringify(entityIds, null, 2));
  console.log(`Wrote ${ENTITY_IDS_FILE}`);
  console.log('Still UNRESOLVED:');
  const walk = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      if (v && typeof v === 'object') walk(v, `${prefix}${k}.`);
      else if (v === 'UNRESOLVED') console.log(`  ${prefix}${k}`);
    }
  };
  walk(entityIds);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
