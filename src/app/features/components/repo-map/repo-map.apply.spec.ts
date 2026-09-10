import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { WritableSignal, signal } from '@angular/core';

import { RepoMapComponent } from './repo-map.component';
import {
  ApplyRefusal,
  RepoApplyResult,
  RepoMapService,
} from '../../service/repo-map.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterStatus } from '../../model/cluster.models';
import { RepositoryMapResponseDto } from '../../../core/api/model/repositoryMapResponseDto';

/**
 * The apply is the one button on this screen that writes to somebody else's repository and spends
 * their Actions minutes. These tests hold the four things that have to be true around it: it says
 * why it cannot be pressed, it reports what it did, it says loudly when it did only half of it,
 * and when it left rows behind it says so in the backend's own words.
 */

const mapResponse = (outcome: string, rendered: boolean): RepositoryMapResponseDto =>
  ({
    repositoryId: 'r-1',
    repoFullName: 'acme/storefront',
    branch: 'main',
    read: { ok: true, repoFullName: 'acme/storefront', ref: 'main', commitSha: '4f9c2a1b77de', limits: {} },
    map: {
      units: [
        {
          id: '.',
          name: 'storefront',
          root: '.',
          reason: 'own-dockerfile',
          build: { strategy: 'dockerfile', dockerfile: null, context: null },
          port: { value: 3000, source: 'Dockerfile:EXPOSE' },
          healthPath: { value: '/healthz', source: 'Dockerfile:HEALTHCHECK' },
          env: [],
          manifest: null,
          confidence: 'declared',
          evidence: [],
        },
      ],
      services: [],
      inputs: [],
      externals: [],
      blockers: [],
      caveats: [],
      questions: [],
      decisions: [],
      coverage: 'best_effort',
      boundary: { searched: [], notFound: [] },
    },
    verdict: {
      outcome,
      reason: 'One unit renders and fits.',
      remedy: null,
      evidence: [],
      units: [{ id: '.', readiness: 'deployable', reason: '', remedy: null, evidence: [] }],
      capacity: {
        assessed: false,
        clusterId: 'c-1',
        notAssessedReason: 'no-declared-footprint',
        assessment: { known: false },
        components: [],
        uncounted: [],
      },
    },
    render: rendered
      ? { units: [{ unitId: '.', name: 'storefront', manifest: {}, yaml: 'kind: Application\n' }], skipped: [], notes: [] }
      : { units: [], skipped: [{ unitId: '.', reason: 'no port could be determined' }], notes: [] },
  }) as unknown as RepositoryMapResponseDto;

const unit = (over: Partial<RepoApplyResult['units'][number]>): RepoApplyResult['units'][number] => ({
  unitId: '.',
  name: 'storefront',
  applicationId: 'app-1',
  slug: 'storefront-1a2b',
  manifestPath: 'flui.yaml',
  workflowPath: '.github/workflows/flui-storefront-aa11bb.yml',
  status: 'AWAITING_BUILD',
  armed: true,
  ...over,
});

const applied = (over: Partial<RepoApplyResult> = {}): RepoApplyResult => ({
  repositoryId: 'r-1',
  repoFullName: 'acme/storefront',
  baseBranch: 'main',
  baseCommitSha: '4f9c2a1b77de55aa0931',
  branch: 'flui/deploy-4f9c2a1',
  branchUrl: 'https://github.com/acme/storefront/tree/flui/deploy-4f9c2a1',
  commitSha: 'aa11bb22cc33dd44ee55',
  commitUrl: 'https://github.com/acme/storefront/commit/aa11bb22cc33dd44ee55',
  files: ['flui.yaml', '.github/workflows/flui-storefront-aa11bb.yml'],
  units: [unit({ workflowRunUrl: 'https://github.com/acme/storefront/actions/runs/9' })],
  partial: false,
  skipped: [],
  verdict: 'deployable',
  verdictReason: 'One unit renders and fits.',
  ...over,
});

interface Harness {
  fixture: ReturnType<typeof TestBed.createComponent<RepoMapComponent>>;
  el: HTMLElement;
  component: RepoMapComponent;
  applyResult: WritableSignal<RepoApplyResult | null>;
  applyRefusal: WritableSignal<ApplyRefusal | null>;
  applying: WritableSignal<boolean>;
  applyMap: jasmine.Spy;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function build(options: {
  response?: RepositoryMapResponseDto;
  clusterId?: string;
} = {}): Promise<Harness> {
  const applyResult = signal<RepoApplyResult | null>(null);
  const applyRefusal = signal<ApplyRefusal | null>(null);
  const applying = signal(false);
  const applyMap = jasmine.createSpy('applyMap').and.resolveTo(undefined);
  const queryParams: Record<string, string> = { branch: 'main' };
  if (options.clusterId) queryParams['clusterId'] = options.clusterId;

  TestBed.configureTestingModule({
    providers: [
      {
        provide: RepoMapService,
        useValue: {
          map: signal(options.response ?? mapResponse('deployable', true)),
          loading: signal(false),
          error: signal(null),
          branches: signal([{ name: 'main', sha: 'abc' }]),
          branchesError: signal(null),
          applying,
          applyResult,
          applyRefusal,
          loadMap: () => Promise.resolve(),
          loadBranches: () => Promise.resolve(),
          applyMap,
          clearApply: () => undefined,
        },
      },
      {
        provide: RepositoryService,
        useValue: {
          repositories: signal([{ id: 'r-1', fullName: 'acme/storefront', branch: 'main' }]),
          loadRepositories: () => Promise.resolve(),
        },
      },
      {
        provide: ClusterService,
        useValue: {
          clusters: signal([{ id: 'c-1', name: 'prod', status: ClusterStatus.ACTIVE }]),
          loadClusters: () => Promise.resolve(),
        },
      },
      {
        provide: Router,
        useValue: {
          navigate: jasmine.createSpy('navigate').and.resolveTo(true),
          createUrlTree: (commands: unknown[]) => commands,
          serializeUrl: (tree: unknown) => (Array.isArray(tree) ? tree.join('/') : String(tree)),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ id: 'r-1' }),
            queryParamMap: convertToParamMap(queryParams),
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(RepoMapComponent);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    component: fixture.componentInstance,
    applyResult,
    applyRefusal,
    applying,
    applyMap,
  };
}

const applyButton = (el: HTMLElement) => el.querySelector('button[aria-disabled]') as HTMLButtonElement;
const text = (el: HTMLElement) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ');

describe('the apply button says why it cannot be pressed', () => {
  it('refuses without a cluster, because the endpoint requires one', async () => {
    const h = await build({ clusterId: undefined });
    expect(h.component.applyBlockedReason()).toBe(
      'Pick a cluster above — an apply always deploys onto one.',
    );
    const button = applyButton(h.el);
    expect(button.disabled).toBe(true);
    // On the wrapper, not the button: a disabled button receives no pointer events and would
    // never show a title of its own.
    expect(button.parentElement?.getAttribute('title')).toBe(h.component.applyBlockedReason());
  });

  it('refuses a verdict the backend would refuse, and names it', async () => {
    const h = await build({ clusterId: 'c-1', response: mapResponse('blocked', true) });
    expect(h.component.applyBlockedReason()).toBe(
      'Flui will not apply a map whose verdict is `blocked`.',
    );
    expect(applyButton(h.el).disabled).toBe(true);
  });

  it('does not refuse `partial` — the backend applies the units that are ready', async () => {
    const h = await build({ clusterId: 'c-1', response: mapResponse('partial', true) });
    expect(h.component.applyBlockedReason()).toBe('');
    expect(applyButton(h.el).disabled).toBe(false);
  });

  it('refuses when nothing rendered, because there would be nothing to commit', async () => {
    const h = await build({ clusterId: 'c-1', response: mapResponse('deployable', false) });
    expect(h.component.applyBlockedReason()).toBe(
      'No flui.yaml was rendered, so there is nothing to commit.',
    );
    expect(applyButton(h.el).disabled).toBe(true);
  });

  it('refuses once the cluster is changed without checking again', async () => {
    const h = await build({ clusterId: 'c-1' });
    expect(h.component.applyBlockedReason()).toBe('');
    h.component.clusterIdInput.set('c-2');
    h.fixture.detectChanges();
    expect(h.component.applyBlockedReason()).toBe(
      'The branch or the cluster changed since this map was read — check again first.',
    );
    expect(applyButton(h.el).disabled).toBe(true);
  });

  it('says what pressing it would write, before it is pressed', async () => {
    const h = await build({ clusterId: 'c-1' });
    const shown = text(h.el);
    // One line, unpressed: this writes to your repository and spends your minutes. The rest — the
    // branch name, one build per unit, the applications Flui creates and never removes on its own,
    // the databases installed before anything is committed — is behind the affordance below, which
    // is where the dashboard's own policy puts a long explanation.
    expect(shown).toContain('writes a branch and a commit to your repository');
    expect(shown).toContain('Actions minutes');
    // The sentence that outlived the feature it described.
    expect(shown).not.toContain('still being built');
  });

  it('has the whole of what it does one press away, not lost', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.component.toggle('apply-detail');
    h.fixture.detectChanges();
    const shown = text(h.el);
    expect(shown).toContain('flui/deploy-');
    expect(shown).toContain('only read');
    // The two costs that outlive a failure, and the ones a person is least likely to expect.
    expect(shown).toContain('Flui never removes an application on its own');
  });

  it('cannot be pressed twice: it is disabled while the call is out', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applying.set(true);
    h.fixture.detectChanges();
    expect(applyButton(h.el).disabled).toBe(true);
    expect(text(h.el)).toContain('This can take a few minutes');
    await h.component.apply();
    expect(h.applyMap).not.toHaveBeenCalled();
  });

  it('sends the cluster and the branch it was checked on', async () => {
    const h = await build({ clusterId: 'c-1' });
    await h.component.apply();
    expect(h.applyMap).toHaveBeenCalledWith('r-1', 'c-1', 'main');
  });
});

describe('a finished apply reports what it did', () => {
  it('shows the branch, the commit, the files and the application it created', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applyResult.set(applied());
    h.fixture.detectChanges();

    const shown = text(h.el);
    expect(shown).toContain('Applied');
    expect(shown).toContain('flui/deploy-4f9c2a1');
    expect(shown).toContain('aa11bb22cc');
    expect(shown).toContain('cut from main, which was not written to.');

    const hrefs = Array.from(h.el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('https://github.com/acme/storefront/tree/flui/deploy-4f9c2a1');
    expect(hrefs).toContain('https://github.com/acme/storefront/commit/aa11bb22cc33dd44ee55');
    expect(hrefs).toContain('https://github.com/acme/storefront/actions/runs/9');
    // Every unit reaches its own application page.
    expect(hrefs).toContain('/apps/applications/app-1');

    expect(shown).toContain('2 files written');
    h.el.querySelectorAll('button').forEach((b) => {
      if ((b.textContent ?? '').includes('files written')) b.click();
    });
    h.fixture.detectChanges();
    expect(text(h.el)).toContain('.github/workflows/flui-storefront-aa11bb.yml');
  });

  it('replaces the warning: nothing still offers to write to the repository', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applyResult.set(applied());
    h.fixture.detectChanges();
    expect(text(h.el)).not.toContain('This writes to your repository');
    expect(applyButton(h.el)).toBeNull();
  });
});

describe('a partial apply says which unit was left unarmed', () => {
  const partial = (markedForReuse: boolean) =>
    applied({
      partial: true,
      units: [
        unit({ unitId: 'web', name: 'storefront', applicationId: 'app-1' }),
        unit({
          unitId: 'worker',
          name: 'storefront-worker',
          applicationId: 'app-2',
          slug: 'storefront-worker-9z',
          status: 'PENDING',
          armed: false,
          reason: 'the webhook credential could not be stored',
          markedForReuse,
        }),
      ],
    });

  it('names the unit, its reason, and does not call the whole thing done', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applyResult.set(partial(true));
    h.fixture.detectChanges();

    const shown = text(h.el);
    expect(shown).toContain('Applied, but not everything was armed');
    expect(shown).toContain('storefront-worker');
    expect(shown).toContain('not armed');
    expect(shown).toContain('the webhook credential could not be stored');
    // Marked for reuse: real, but not the loudest thing on the screen.
    expect(shown).not.toContain('could not be marked for reuse');
    expect(h.component.unmarkedUnits()).toEqual([]);
  });

  it('when it could not be marked, that is the loudest thing on the screen', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applyResult.set(partial(false));
    h.fixture.detectChanges();

    expect(h.component.unmarkedUnits().map((u) => u.unitId)).toEqual(['worker']);
    const shown = text(h.el);
    expect(shown).toContain('1 application could not be marked for reuse.');
    expect(shown).toContain('will create a second application beside it');
    expect(shown).toContain('with a second database if this one attached any');
    // It carries a way to reach the thing it is talking about.
    const hrefs = Array.from(h.el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/apps/applications/app-2');
  });
});

describe('a refusal is shown in the backend’s own words', () => {
  it('does not paraphrase an ordinary refusal', async () => {
    const h = await build({ clusterId: 'c-1' });
    const message =
      'Flui will not apply a map whose verdict is `blocked`. A bind mount has no equivalent on ' +
      'the platform. Nothing was written to the repository.';
    h.applyRefusal.set({ status: 422, message });
    h.fixture.detectChanges();
    expect(text(h.el)).toContain(message);
  });

  it('names what was left behind, and reaches it', async () => {
    const h = await build({ clusterId: 'c-1' });
    const message =
      'Applying acme/storefront failed after 1 application(s) had already been created. The ' +
      'branch flui/deploy-4f9c2a1 was deleted and nothing was committed, but these rows exist on ' +
      'cluster c-1 and Flui does not delete an application on its own — one of them may already ' +
      'own a database:\n' +
      '  • storefront (slug `storefront-1a2b`, id app-1, unit `.`) — services already installed ' +
      'for it: postgres-17\n' +
      'Flui could NOT mark them for reuse, so the next apply will not recognise them and will ' +
      'create new ones: remove these by hand first.';
    h.applyRefusal.set({
      status: 500,
      message,
      stranded: {
        branch: 'flui/deploy-4f9c2a1',
        branchDeleted: true,
        committed: false,
        markedForReuse: false,
        applications: [
          {
            applicationId: 'app-1',
            name: 'storefront',
            slug: 'storefront-1a2b',
            unitId: '.',
            branch: 'flui/deploy-4f9c2a1',
            attachedServices: ['postgres-17'],
          },
        ],
      },
    });
    h.fixture.detectChanges();

    const shown = text(h.el);
    expect(shown).toContain('The apply failed and left something behind');
    // The whole message, unedited: it is the only thing that says what still exists.
    expect(shown).toContain('one of them may already own a database');
    expect(shown).toContain('remove these by hand first');
    expect(shown).toContain('postgres-17');
    const hrefs = Array.from(h.el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/apps/applications/app-1');
  });

  it('will not let the same press happen again while those rows are unmarked', async () => {
    const h = await build({ clusterId: 'c-1' });
    expect(h.component.applyBlockedReason()).toBe('');
    h.applyRefusal.set({
      status: 500,
      message: 'Applying acme/storefront failed after 1 application(s) had already been created.',
      stranded: {
        branch: 'flui/deploy-4f9c2a1',
        branchDeleted: true,
        committed: false,
        markedForReuse: false,
        applications: [],
      },
    });
    h.fixture.detectChanges();
    expect(h.component.applyBlockedReason()).toBe(
      'The last attempt left applications behind that were not marked for reuse — remove them ' +
        'first, or this builds a second set beside them.',
    );
    expect(applyButton(h.el).disabled).toBe(true);
  });

  it('leaves it pressable when the rows were marked: the next apply adopts them', async () => {
    const h = await build({ clusterId: 'c-1' });
    h.applyRefusal.set({
      status: 500,
      message: 'Applying acme/storefront failed after 1 application(s) had already been created.',
      stranded: {
        branch: 'flui/deploy-4f9c2a1',
        branchDeleted: true,
        committed: false,
        markedForReuse: true,
        applications: [],
      },
    });
    h.fixture.detectChanges();
    expect(h.component.applyBlockedReason()).toBe('');
    expect(applyButton(h.el).disabled).toBe(false);
  });
});
