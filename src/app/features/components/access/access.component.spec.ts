import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AccessComponent } from './access.component';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AccessDelta } from '../../model/iam.model';

describe('revoking a grant on the access screen', () => {
  let fixture: ComponentFixture<AccessComponent>;
  let removeGrant: jasmine.Spy;
  let preview: Subject<AccessDelta | null>;

  const delta = (over: Partial<AccessDelta> = {}): AccessDelta => ({
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

  beforeEach(async () => {
    removeGrant = jasmine.createSpy('removeGrant');
    preview = new Subject<AccessDelta | null>();

    const iam = {
      grants: signal([
        {
          id: 'g1',
          binding: {
            principal: { type: 'user' as const, ref: 'alice@acme.com' },
            role: 'editor' as const,
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
    };

    await TestBed.configureTestingModule({
      imports: [AccessComponent],
      providers: [
        provideHttpClient(),
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
