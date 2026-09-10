import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';

import { RepoMapComponent } from './repo-map.component';
import { RepoMapService } from '../../service/repo-map.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { RepositoryMapResponseDto } from '../../../core/api/model/repositoryMapResponseDto';

/**
 * The screen answers four things: can this be deployed, what does it need from me,
 * what is in the way, what happens next. Everything else the engine produces is our
 * diagnostic instrument and belongs in the JSON. This test is the guard on that
 * decision: it renders one realistic map and counts the words a person is shown
 * before pressing anything.
 */
const WORD_CEILING = 200;

const ev = (file: string, line?: number, excerpt?: string) => [{ file, line, excerpt }];

const RESPONSE = {
  repositoryId: 'r-1',
  repoFullName: 'acme/storefront',
  branch: 'main',
  read: {
    ok: true,
    repoFullName: 'acme/storefront',
    ref: 'main',
    commitSha: '4f9c2a1b77de55aa0931',
    truncated: false,
    contentComplete: true,
    skipped: { symlinks: 2, oversize: 1, other: 0 },
    bytesRead: 1_482_310,
    highDensityUnread: [],
    limits: {
      maxArchiveBytes: 67_108_864,
      maxContentBytes: 8_388_608,
      maxFileBytes: 1_048_576,
      maxEntries: 20_000,
      timeoutMs: 30_000,
    },
  },
  map: {
    coverage: 'best_effort',
    units: [
      {
        id: '.',
        name: 'storefront',
        root: '.',
        reason: 'own-dockerfile',
        build: {
          strategy: 'dockerfile',
          dockerfile: { value: 'Dockerfile', confidence: 'declared', source: 'Dockerfile', evidence: ev('Dockerfile') },
          context: null,
        },
        port: { value: 3000, source: 'Dockerfile:EXPOSE' },
        healthPath: null,
        env: [
          { name: 'DATABASE_URL', role: 'derived', fromService: 'postgres', source: '.env.example:3', evidence: ev('.env.example', 3, 'DATABASE_URL=') },
          { name: 'REDIS_URL', role: 'derived', fromService: 'redis', source: '.env.example:4', evidence: ev('.env.example', 4, 'REDIS_URL=') },
          { name: 'STRIPE_SECRET_KEY', role: 'secret', source: '.env.example:9', evidence: ev('.env.example', 9, 'STRIPE_SECRET_KEY=') },
          { name: 'NODE_ENV', role: 'build-time', value: 'production', source: 'Dockerfile:12', evidence: ev('Dockerfile', 12, 'ENV NODE_ENV') },
        ],
        manifest: null,
        confidence: 'declared',
        evidence: ev('Dockerfile'),
      },
      {
        id: 'worker',
        name: 'storefront-worker',
        root: 'worker',
        reason: 'own-dockerfile',
        build: {
          strategy: 'dockerfile',
          dockerfile: { value: 'worker/Dockerfile', confidence: 'declared', source: 'worker/Dockerfile', evidence: ev('worker/Dockerfile') },
          context: 'worker',
        },
        port: null,
        healthPath: null,
        env: [
          { name: 'DATABASE_URL', role: 'derived', fromService: 'postgres', source: 'worker/.env.example:1', evidence: ev('worker/.env.example', 1, 'DATABASE_URL=') },
        ],
        manifest: null,
        confidence: 'derived',
        evidence: ev('worker/Dockerfile'),
      },
    ],
    services: [
      {
        name: 'postgres',
        block: 'postgres-17',
        engine: 'postgres',
        family: 'relational',
        unit: null,
        confidence: 'declared',
        signals: [
          { kind: 'dependency', observed: 'pg@8.13.1', engine: 'postgres', family: 'relational', unit: null, injectionKeys: ['DATABASE_URL'], localName: null, confidence: 'declared', source: 'package.json:31', evidence: ev('package.json', 31, '"pg": "^8.13.1"') },
          { kind: 'compose-service', observed: 'image: postgres:17-alpine', engine: 'postgres', family: 'relational', unit: null, injectionKeys: [], localName: 'db', confidence: 'declared', source: 'docker-compose.yml:14', evidence: ev('docker-compose.yml', 14, 'postgres:17-alpine') },
        ],
        injectionKeys: ['DATABASE_URL'],
        source: 'package.json:31',
        evidence: ev('package.json', 31, '"pg": "^8.13.1"'),
      },
      {
        name: 'redis',
        block: 'redis-7',
        engine: 'redis',
        family: 'cache',
        unit: null,
        confidence: 'derived',
        signals: [
          { kind: 'dependency', observed: 'ioredis@5.4.1', engine: 'redis', family: 'cache', unit: null, injectionKeys: ['REDIS_URL'], localName: null, confidence: 'derived', source: 'package.json:24', evidence: ev('package.json', 24, '"ioredis"') },
        ],
        injectionKeys: ['REDIS_URL'],
        source: 'package.json:24',
        evidence: ev('package.json', 24, '"ioredis"'),
      },
    ],
    inputs: [
      {
        name: 'STRIPE_SECRET_KEY',
        forService: null,
        unit: null,
        secret: true,
        reason: 'The application reads this key at startup and the repository never writes a value for it, so it has to come from you.',
        source: '.env.example:9',
        evidence: ev('.env.example', 9, 'STRIPE_SECRET_KEY='),
        blocksStart: true,
      },
      {
        name: 'SESSION_SECRET',
        forService: null,
        unit: null,
        secret: true,
        reason: 'Read at startup, no default in the repository.',
        source: '.env.example:11',
        evidence: ev('.env.example', 11, 'SESSION_SECRET='),
      },
    ],
    externals: [
      {
        name: 'Stripe',
        requires: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        unit: null,
        confidence: 'declared',
        source: 'package.json:35',
        evidence: ev('package.json', 35, '"stripe"'),
      },
    ],
    blockers: [
      {
        code: 'bind-mount-config',
        unit: 'worker',
        summary:
          'The worker service bind-mounts ./config/worker.yaml from the host into the container, and a bind mount has no equivalent on the platform. The file it expects is not in the image.',
        remedy:
          'Copy config/worker.yaml into the image in the Dockerfile, or move its values into environment variables the platform can supply. Either removes the dependency on a host path.',
        source: 'docker-compose.yml:41',
        evidence: ev('docker-compose.yml', 41, './config/worker.yaml:/app/config.yaml'),
      },
    ],
    caveats: [
      {
        code: 'ambiguous-alternatives',
        unit: '.',
        summary:
          'Both ioredis and node-cache are imported and either could be the cache this application uses at runtime. Redis was chosen because the compose file names a redis service; if the application really uses the in-process cache, the redis block will run unused.',
        source: 'package.json:24',
        evidence: ev('package.json', 24, '"ioredis"'),
      },
      {
        code: 'interchange-default',
        unit: 'worker',
        summary: 'The worker declares no resources, so the platform default footprint was used to weigh it.',
        source: 'worker/Dockerfile',
        evidence: ev('worker/Dockerfile'),
      },
    ],
    questions: [
      {
        id: 'q-health-root',
        question: 'Does the storefront answer a health probe on /, or on a path it does not declare?',
        options: ['/', '/healthz', 'no probe'],
        source: 'src/server.ts:88',
        evidence: ev('src/server.ts', 88, "app.get('/'"),
      },
    ],
    decisions: [
      { subject: 'service `redis`: catalog block', choice: 'redis-7', decidedBy: 'engine', confidence: 'derived', reason: 'The compose file pins redis:7-alpine and the catalog answers that major.', source: 'docker-compose.yml:28', evidence: ev('docker-compose.yml', 28), alternatives: ['redis-6'] },
      { subject: 'unit `.`: build strategy', choice: 'dockerfile', decidedBy: 'engine', confidence: 'declared', reason: 'The unit carries its own Dockerfile, so the platform build path was not needed.', source: 'Dockerfile', evidence: ev('Dockerfile') },
      { subject: 'unit `.`: port', choice: '3000', decidedBy: 'engine', confidence: 'declared', reason: 'EXPOSE names one port and nothing contradicts it.', source: 'Dockerfile:20', evidence: ev('Dockerfile', 20, 'EXPOSE 3000') },
    ],
    boundary: {
      searched: ['flui.yaml', 'Dockerfile', 'docker-compose.yml', 'package.json', '.env.example', 'worker/Dockerfile'],
      notFound: [
        'Routes were found (/, /api/v1) but none is a health endpoint, so no healthcheck was written. Declare deploy.healthcheck.path yourself.',
        'No `.env` was read: only `.env.example` is committed.',
      ],
    },
  },
  verdict: {
    outcome: 'partial',
    reason:
      'unit `.` is deployable once you supply STRIPE_SECRET_KEY and SESSION_SECRET; unit `worker` is blocked because the worker service bind-mounts ./config/worker.yaml from the host into the container, and a bind mount has no equivalent on the platform.',
    remedy:
      'Copy config/worker.yaml into the image in the Dockerfile, or move its values into environment variables. Then re-map the branch.',
    evidence: ev('docker-compose.yml', 41),
    units: [
      { id: '.', readiness: 'deployable_pending_inputs', reason: 'Two values must be supplied before it starts.', remedy: 'Supply STRIPE_SECRET_KEY and SESSION_SECRET.', evidence: ev('.env.example', 9) },
      { id: 'worker', readiness: 'blocked', reason: 'A bind mount has no equivalent on the platform.', remedy: 'Copy the file into the image.', evidence: ev('docker-compose.yml', 41) },
    ],
    capacity: {
      assessed: true,
      clusterId: 'c-1',
      notAssessedReason: null,
      assessment: {
        known: true,
        fits: true,
        requiredCpuMillicores: 1100,
        requiredMemoryMebibytes: 2304,
        availableCpuMillicores: 3400,
        availableMemoryMebibytes: 6144,
      },
      components: [
        { label: 'unit `.`', unit: '.', cpuRequestMillicores: 250, memoryLimitMebibytes: 512, replicas: 1, basis: 'platform default' },
        { label: 'unit `worker`', unit: 'worker', cpuRequestMillicores: 250, memoryLimitMebibytes: 512, replicas: 1, basis: 'platform default' },
        { label: 'service `postgres`', unit: null, cpuRequestMillicores: 500, memoryLimitMebibytes: 1024, replicas: 1, basis: 'catalog block postgres-17' },
        { label: 'service `redis`', unit: null, cpuRequestMillicores: 100, memoryLimitMebibytes: 256, replicas: 1, basis: 'catalog block redis-7' },
      ],
      uncounted: [],
    },
  },
  render: {
    units: [
      { unitId: '.', name: 'storefront', manifest: {}, yaml: 'apiVersion: flui.cloud/v1\nkind: Application\nmetadata:\n  name: storefront\n' },
    ],
    skipped: [{ unitId: 'worker', reason: 'blocked by bind-mount-config' }],
    notes: [],
  },
} as unknown as RepositoryMapResponseDto;

function build() {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: RepoMapService,
        useValue: {
          map: signal(RESPONSE),
          loading: signal(false),
          error: signal(null),
          branches: signal([{ name: 'main', sha: 'abc' }, { name: 'develop', sha: 'def' }]),
          branchesError: signal(null),
          applying: signal(false),
          applyResult: signal(null),
          applyRefusal: signal(null),
          loadMap: () => Promise.resolve(),
          loadBranches: () => Promise.resolve(),
          applyMap: () => Promise.resolve(),
          clearApply: () => undefined,
        },
      },
      { provide: RepositoryService, useValue: { repositories: signal([{ id: 'r-1', fullName: 'acme/storefront', branch: 'main' }]), loadRepositories: () => Promise.resolve() } },
      { provide: ClusterService, useValue: { clusters: signal([]), loadClusters: () => Promise.resolve() } },
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate').and.resolveTo(true) } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r-1' }), queryParamMap: convertToParamMap({}) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(RepoMapComponent);
  fixture.detectChanges();
  return fixture;
}

describe('what the screen shows before anyone presses anything', () => {
  it(`shows at most ${WORD_CEILING} words`, () => {
    const el = build().nativeElement as HTMLElement;
    const visible = (el.innerText || el.textContent || '').trim();
    const words = visible.split(/\s+/).filter(Boolean);
    // eslint-disable-next-line no-console
    console.log(`VISIBLE_WORDS=${words.length}`);
    expect(words.length).toBeLessThanOrEqual(WORD_CEILING);
  });
});
