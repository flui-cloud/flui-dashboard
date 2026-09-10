import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';

import { RepoMapComponent } from './repo-map.component';
import { RepoMapService } from '../../service/repo-map.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { RepositoryMapResponseDto } from '../../../core/api/model/repositoryMapResponseDto';

const unit = (id: string, healthPath: unknown, port: unknown = { value: 8080, source: 'Dockerfile:EXPOSE' }) => ({
  id,
  name: id,
  root: id,
  reason: 'own-dockerfile',
  build: { strategy: 'dockerfile', dockerfile: null, context: null },
  port,
  healthPath,
  env: [],
  manifest: null,
  confidence: 'declared',
  evidence: [],
});

const responseWith = (units: unknown[], questions: unknown[]) =>
  ({
    repositoryId: 'r-1',
    repoFullName: 'acme/app',
    branch: 'main',
    read: { ok: true, repoFullName: 'acme/app', ref: 'main', limits: {} },
    map: {
      units,
      services: [],
      inputs: [],
      externals: [],
      blockers: [],
      caveats: [],
      questions,
      decisions: [],
      coverage: 'best_effort',
      boundary: { searched: [], notFound: [] },
    },
    verdict: {
      outcome: 'deployable',
      reason: '',
      remedy: null,
      evidence: [],
      units: [],
      capacity: { assessed: false, clusterId: null, notAssessedReason: 'no-cluster-in-request', assessment: { known: false }, components: [], uncounted: [] },
    },
    render: null,
  }) as unknown as RepositoryMapResponseDto;

describe('an undetermined health path stays a question', () => {
  const build = (response: RepositoryMapResponseDto) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RepoMapService,
          useValue: {
            map: signal(response),
            loading: signal(false),
            error: signal(null),
            branches: signal([]),
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
        { provide: RepositoryService, useValue: { repositories: signal([]), loadRepositories: () => Promise.resolve() } },
        { provide: ClusterService, useValue: { clusters: signal([]), loadClusters: () => Promise.resolve() } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate').and.resolveTo(true) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r-1' }), queryParamMap: convertToParamMap({}) } },
        },
      ],
    });
    return TestBed.createComponent(RepoMapComponent).componentInstance;
  };

  it('asks for the path instead of leaving a blank field or a tick', () => {
    const questions = build(responseWith([unit('.', null)], [])).questions();
    expect(questions.map((q) => q.question)).toEqual([
      'Which path answers a health check for root? Declare it in deploy.healthcheck.path.',
    ]);
  });

  it('never drops a question the engine filed itself', () => {
    // This used to be a global "don't ask twice" guard keyed off /health/i on the question text.
    // It was dead — cartographer files no health question anywhere — and it was harmful: any
    // map-level question that happened to contain the word silenced every unit's own question.
    const engineQuestion = { id: 'q1', question: 'Is this worker meant to be deployed?', options: ['yes', 'no'] };
    const questions = build(responseWith([unit('.', null)], [engineQuestion])).questions();
    expect(questions.map((q) => q.id)).toEqual(['q1', 'health:.']);
  });

  it('does not ask a unit that serves nothing for a health path', () => {
    // A unit with no port has nothing to probe, and the thing actually missing is the port — the
    // engine says so in the verdict, which the obstacle card now carries. Asking here instead
    // would point the reader at the smaller of the two problems.
    const portless = unit('.', null, null);
    expect(build(responseWith([portless], [])).questions()).toEqual([]);
  });

  it('asks nothing when the repository declared a health path', () => {
    const declared = unit('.', { value: '/healthz', source: 'Dockerfile:HEALTHCHECK' });
    expect(build(responseWith([declared], [])).questions()).toEqual([]);
  });
});
