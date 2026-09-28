import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TemporaryAccessTabComponent } from './temporary-access-tab.component';
import { GrantBuilderComponent } from './grant-builder.component';
import { IamService } from '../../service/iam.service';
import { AuditService } from '../../service/audit.service';
import { PermissionService } from '../../../core/services/permission.service';
import { GrantRecord, temporaryGrants } from '../../model/iam.model';

const HOUR = 3600_000;

const grant = (id: string, ref: string, expiresIn: number | null): GrantRecord => ({
  id,
  binding: {
    principal: { type: 'user', ref },
    role: 'platform_operator',
    scope: { type: 'global' },
  },
  expiresAt: expiresIn === null ? null : new Date(Date.now() + expiresIn).toISOString(),
  grantedBy: 'owner@acme.com',
});

describe('temporaryGrants', () => {
  it('leaves standing grants out and splits active from ended', () => {
    const now = Date.now();
    const { active, ended } = temporaryGrants(
      [
        grant('standing', 'sam@acme.com', null),
        grant('later', 'lou@acme.com', 5 * HOUR),
        grant('soon', 'sue@acme.com', 1 * HOUR),
        grant('old', 'ola@acme.com', -48 * HOUR),
        grant('recent', 'ray@acme.com', -1 * HOUR),
      ],
      now,
    );
    expect(active.map((g) => g.id)).toEqual(['soon', 'later']);
    expect(ended.map((g) => g.id)).toEqual(['recent', 'old']);
  });
});

describe('TemporaryAccessTabComponent', () => {
  let fixture: ComponentFixture<TemporaryAccessTabComponent>;
  let list: jasmine.Spy;
  const grants = signal<GrantRecord[]>([]);

  beforeEach(async () => {
    list = jasmine.createSpy('list').and.returnValue(
      of([
        {
          id: 'e1',
          at: new Date().toISOString(),
          userId: 'u1',
          email: 'lou@acme.com',
          actorKind: 'user',
          actorKeyId: null,
          action: 'POST /clusters/:id/nodes',
          target: { id: 'c1' },
          status: 201,
          outcome: 'ok',
          permission: null,
          dataAccess: true,
        },
      ]),
    );
    await TestBed.configureTestingModule({
      imports: [TemporaryAccessTabComponent],
      providers: [
        {
          provide: IamService,
          useValue: {
            grants,
            principalDisplay: (p: { ref: string }) => p.ref,
            roleName: () => 'Platform operator',
            isRevocable: () => true,
            principals: signal([]),
            grantableRoles: signal([]),
            clusters: signal([]),
            projects: signal([]),
            kinds: signal([]),
            tags: signal([]),
            apps: signal([]),
            sections: signal([]),
            matchApps: () => [],
            clusterName: (k: string) => k,
            sectionName: (k: string) => k,
          },
        },
        { provide: AuditService, useValue: { list } },
        {
          provide: PermissionService,
          useValue: { can: () => true, load: () => undefined },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TemporaryAccessTabComponent);
    fixture.componentRef.setInput('scopeText', () => 'Everything');
  });

  const text = () => fixture.nativeElement.textContent as string;
  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="temporary-row"]'));
  const button = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim().startsWith(label),
    );

  it('lists only active temporary grants, with ended ones collapsed', () => {
    grants.set([
      grant('standing', 'sam@acme.com', null),
      grant('active', 'lou@acme.com', 5 * HOUR),
      grant('ended', 'ola@acme.com', -5 * HOUR),
    ]);
    fixture.detectChanges();
    expect(rows()).toHaveSize(1);
    expect(rows()[0].textContent).toContain('lou@acme.com');
    expect(rows()[0].textContent).toContain('ends in');
    expect(rows()[0].textContent).toContain('granted by owner@acme.com');
    expect(text()).not.toContain('sam@acme.com');

    button('Ended')!.click();
    fixture.detectChanges();
    expect(rows()).toHaveSize(2);
    expect(rows()[1].textContent).toContain('ola@acme.com');
    expect(rows()[1].classList).toContain('opacity-60');
  });

  it('hands the grant to the revoke flow', () => {
    grants.set([grant('active', 'lou@acme.com', 5 * HOUR)]);
    fixture.detectChanges();
    let revoked: GrantRecord | undefined;
    fixture.componentInstance.revoke.subscribe((g) => (revoked = g));
    button('Revoke')!.click();
    expect(revoked?.id).toBe('active');
  });

  it('shows the person’s recent activity when a row is opened', () => {
    grants.set([grant('active', 'lou@acme.com', 5 * HOUR)]);
    fixture.detectChanges();
    (rows()[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledWith({ email: 'lou@acme.com', limit: 20 });
    expect(text()).toContain('POST /clusters/:id/nodes');
    expect(rows()[0].textContent).toContain('data');
  });

  it('offers a one-day Platform operator grant when nobody has one', () => {
    grants.set([grant('standing', 'sam@acme.com', null)]);
    fixture.detectChanges();
    expect(text()).toContain('Nobody has temporary access right now.');
    expect(fixture.nativeElement.querySelector('app-grant-builder')).toBeNull();
    button('Give temporary access')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showBuilder()).toBeTrue();
    const builder = fixture.debugElement.query(
      (d) => d.name === 'app-grant-builder',
    ).componentInstance as GrantBuilderComponent;
    expect(builder.role()).toBe('platform_operator');
    expect(builder.duration()).toBe('1d');
  });
});
