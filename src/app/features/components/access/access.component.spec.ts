import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AccessComponent } from './access.component';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AccessDelta, accessDeltaLines } from '../../model/iam.model';

const deltaFixture = (over: Partial<AccessDelta> = {}): AccessDelta => ({
  principal: { type: 'user', ref: 'alice@acme.com' },
  summary:
    'alice@acme.com loses 2 applications (acme-api, acme-db) and the Clusters section.',
  losesNothing: false,
  losesEverything: false,
  principalIsPlatformAdmin: false,
  sectionsClosed: [{ key: 'clusters' }],
  sectionsDowngraded: [],
  sectionsOpened: [],
  coverage: 'snapshot',
  applicationsLost: [
    { id: 'a1', name: 'Acme API', slug: 'acme-api', clusterName: 'prod' },
    { id: 'a2', name: 'Acme DB', slug: 'acme-db', clusterName: 'prod' },
  ],
  applicationsLostCount: 2,
  applicationsGained: [],
  applicationsGainedCount: 0,
  permissionsLost: ['app:read'],
  permissionsGained: [],
  ...over,
});

const iamStub = (
  preview: Subject<AccessDelta | null>,
  removeGrant: jasmine.Spy = jasmine.createSpy('removeGrant'),
) => ({
  grants: signal([
    {
      id: 'g1',
      binding: {
        principal: { type: 'user' as const, ref: 'alice@acme.com' },
        role: 'operator' as const,
        scope: { type: 'global' as const },
      },
    },
  ]),
  principals: signal([]),
  apps: signal([]),
  roles: signal([]),
  grantableRoles: signal([]),
  clusters: signal([]),
  projects: signal([]),
  sections: signal([]),
  tags: signal([]),
  kinds: signal([]),
  groups: signal([]),
  users: signal([]),
  refresh: jasmine.createSpy('refresh'),
  removeGrant,
  revocationPreview: jasmine
    .createSpy('revocationPreview')
    .and.returnValue(preview.asObservable()),
  isRevocable: () => true,
  roleName: (k: string) => k,
  clusterName: (k: string) => k,
  sectionName: (k: string) => k,
  principalDisplay: (p: { ref: string }) => p.ref,
  matchApps: () => [],
});

describe('revoking a grant on the access screen', () => {
  let fixture: ComponentFixture<AccessComponent>;
  let removeGrant: jasmine.Spy;
  let preview: Subject<AccessDelta | null>;

  const delta = deltaFixture;

  beforeEach(async () => {
    removeGrant = jasmine.createSpy('removeGrant');
    preview = new Subject<AccessDelta | null>();

    const iam = iamStub(preview, removeGrant);

    await TestBed.configureTestingModule({
      imports: [AccessComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: IamService, useValue: iam },
        {
          provide: PermissionService,
          useValue: {
            can: () => true,
            load: () => undefined,
            isSectionReadOnly: () => false,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => 'grants' }) },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessComponent);
    fixture.detectChanges();
  });

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  const trashButton = (): HTMLButtonElement | undefined =>
    buttons().find((b) => b.getAttribute('title') === 'Remove grant');

  const byText = (label: string): HTMLButtonElement | undefined =>
    buttons().find((b) => b.textContent?.trim() === label);

  const text = (): string => fixture.nativeElement.textContent as string;

  it('renders the gesture at all — a button that is not there proves nothing', () => {
    expect(trashButton()).toBeDefined();
  });

  it('removes nothing on the click itself', () => {
    trashButton()!.click();
    fixture.detectChanges();
    expect(removeGrant).not.toHaveBeenCalled();
  });

  it('asks the API what is lost rather than working it out here', () => {
    trashButton()!.click();
    fixture.detectChanges();
    expect(
      TestBed.inject(IamService).revocationPreview,
    ).toHaveBeenCalledWith('g1');
  });

  it('shows the sentence the API wrote, and what stands behind it', () => {
    trashButton()!.click();
    fixture.detectChanges();
    preview.next(delta());
    fixture.detectChanges();

    expect(text()).toContain('loses 2 applications');
    byText('What exactly happens')!.click();
    fixture.detectChanges();
    expect(text()).toContain('acme-api');
    expect(text()).toContain('Sections that close: Clusters');
    expect(text()).toContain('also covers whatever matches later');
  });

  it('says "not known" when the preview could not be read, never "nothing"', () => {
    trashButton()!.click();
    fixture.detectChanges();
    preview.next(null);
    fixture.detectChanges();

    expect(text()).toContain('could not be read');
    expect(text()).toContain('not known');
    expect(text()).not.toContain('loses nothing');
  });

  it('removes once the person has seen it and confirmed', () => {
    trashButton()!.click();
    fixture.detectChanges();
    preview.next(delta());
    fixture.detectChanges();
    byText('Remove')!.click();
    fixture.detectChanges();

    expect(removeGrant).toHaveBeenCalledWith('g1');
  });

  it('removes nothing when the person backs out', () => {
    trashButton()!.click();
    fixture.detectChanges();
    preview.next(delta());
    fixture.detectChanges();
    byText('Cancel')!.click();
    fixture.detectChanges();

    expect(removeGrant).not.toHaveBeenCalled();
  });
});

/**
 * Decision 111 — the screen listed `iam_role_bindings` and read as exhaustive.
 *
 * Since decision 101 a rung can also be conferred in the identity provider, and
 * neither the list nor the revocation preview can see it: `stateOf` has no token
 * to read for somebody who is not the caller. (a) was chosen over fusing the
 * provider's attributions in — an honest label costs an inspection, and a
 * preview that has to reach the provider fails when the provider is down.
 *
 * Two halves, and both matter: the caveat has to appear where a rung can arrive
 * from outside, and it has to stay away where one cannot. `AUTH_MODE=local`
 * populates an empty `roles` claim on both strategies, so there the list really
 * is everything.
 */
describe('the access screen says whose grants it is listing', () => {
  const IDP_LIST_NOTE = 'is not listed';
  const IDP_DELTA_NOTE = 'Counted from grants made in Flui only';

  let preview: Subject<AccessDelta | null>;

  const build = async (authMode: 'local' | 'oidc') => {
    preview = new Subject<AccessDelta | null>();
    await TestBed.configureTestingModule({
      imports: [AccessComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: IamService, useValue: iamStub(preview) },
        {
          provide: PermissionService,
          useValue: {
            can: () => true,
            load: () => undefined,
            isSectionReadOnly: () => false,
          },
        },
        { provide: AppConfigService, useValue: { authMode } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => 'grants' }) },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(AccessComponent);
    f.detectChanges();
    return f;
  };

  const openPreview = (f: ComponentFixture<AccessComponent>) => {
    const buttons = (): HTMLButtonElement[] =>
      Array.from(f.nativeElement.querySelectorAll('button'));
    buttons().find((b) => b.getAttribute('title') === 'Remove grant')!.click();
    f.detectChanges();
    preview.next(deltaFixture());
    f.detectChanges();
    buttons().find((b) => b.textContent?.trim() === 'What exactly happens')!.click();
    f.detectChanges();
  };

  it('names the list for what it holds, in both modes', async () => {
    const f = await build('local');
    expect(f.nativeElement.textContent).toContain('Grants made in Flui');
  });

  it('says a rung from the provider is not in the list', async () => {
    const f = await build('oidc');
    expect(f.nativeElement.textContent).toContain(IDP_LIST_NOTE);
  });

  it('says the revocation preview counted only Flui grants', async () => {
    const f = await build('oidc');
    openPreview(f);
    expect(f.nativeElement.textContent).toContain(IDP_DELTA_NOTE);
  });

  it('keeps both sentences away when no provider can confer one', async () => {
    const f = await build('local');
    openPreview(f);
    expect(f.nativeElement.textContent).not.toContain(IDP_LIST_NOTE);
    expect(f.nativeElement.textContent).not.toContain(IDP_DELTA_NOTE);
  });

  it('still says what the revocation takes away — the caveat is added, not substituted', async () => {
    const f = await build('oidc');
    openPreview(f);
    expect(f.nativeElement.textContent).toContain('loses 2 applications');
    expect(f.nativeElement.textContent).toContain('acme-api');
    expect(f.nativeElement.textContent).toContain('Sections that close: Clusters');
  });
});

/**
 * The two branches the screen above cannot reach on its own: a principal that is
 * not a person, and a preview whose coverage is already unknown.
 */
describe('the identity-provider caveat picks its moments', () => {
  const lines = (
    over: Partial<AccessDelta>,
    identityProvider: boolean,
  ): string[] => accessDeltaLines(deltaFixture(over), { identityProvider });

  const caveat = 'Counted from grants made in Flui only';

  it('stays off a group — nothing in the provider confers a rung on one', () => {
    expect(
      lines({ principal: { type: 'group', ref: 'platform' } }, true).join(' '),
    ).not.toContain(caveat);
  });

  it('stays off a service account for the same reason', () => {
    expect(
      lines({ principal: { type: 'service_account', ref: 'ci' } }, true).join(' '),
    ).not.toContain(caveat);
  });

  it('reaches the unknown-coverage branch too, which returns early', () => {
    const out = lines({ coverage: 'unknown' }, true);
    expect(out.join(' ')).toContain('not known');
    expect(out.join(' ')).toContain(caveat);
  });
});
