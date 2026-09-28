import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GrantBuilderComponent } from './grant-builder.component';
import { IamService } from '../../service/iam.service';
import { RoleDef } from '../../model/iam.model';

const role = (key: string, name: string): RoleDef => ({
  key: key as RoleDef['key'],
  name,
  description: '',
  permissions: [],
  assignable: true,
  grantable: true,
  revocable: true,
});

describe('GrantBuilderComponent end of a grant', () => {
  let fixture: ComponentFixture<GrantBuilderComponent>;
  let addGrant: jasmine.Spy;

  const build = async (preset?: { role?: string; duration?: string }) => {
    addGrant = jasmine.createSpy('addGrant');
    await TestBed.configureTestingModule({
      imports: [GrantBuilderComponent],
      providers: [
        {
          provide: IamService,
          useValue: {
            principals: signal([
              { type: 'user', ref: 'alice@acme.com', displayName: 'Alice' },
            ]),
            grantableRoles: signal([
              role('viewer', 'Viewer'),
              role('platform_operator', 'Platform operator'),
            ]),
            clusters: signal([]),
            projects: signal([]),
            kinds: signal([]),
            tags: signal([]),
            apps: signal([]),
            sections: signal([]),
            addGrant,
            matchApps: () => [],
            roleName: (k: string) =>
              k === 'platform_operator' ? 'Platform operator' : 'Viewer',
            clusterName: (k: string) => k,
            sectionName: (k: string) => k,
            principalDisplay: (p: { ref: string }) => p.ref,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GrantBuilderComponent);
    if (preset?.role) fixture.componentRef.setInput('presetRole', preset.role);
    if (preset?.duration)
      fixture.componentRef.setInput('presetDuration', preset.duration);
    fixture.detectChanges();
  };

  const select = (id: string, value: string) => {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const text = () => fixture.nativeElement.textContent as string;

  it('sends no end for a standing grant', async () => {
    await build();
    select('gb-who', 'user::alice@acme.com');
    fixture.componentInstance.save();
    expect(addGrant).toHaveBeenCalledTimes(1);
    expect(addGrant.calls.mostRecent().args[1]).toBeNull();
    expect(text()).not.toContain('until');
  });

  it('sends an end when one is chosen, and says it in the sentence', async () => {
    await build();
    select('gb-who', 'user::alice@acme.com');
    select('gb-ends', '8h');
    expect(text()).toContain('until');
    const before = Date.now();
    fixture.componentInstance.save();
    const at = addGrant.calls.mostRecent().args[1] as Date;
    expect(at instanceof Date).toBeTrue();
    const hours = (at.getTime() - before) / 3600_000;
    expect(hours).toBeGreaterThan(7.99);
    expect(hours).toBeLessThan(8.01);
  });

  it('refuses a date in the past', async () => {
    await build();
    select('gb-who', 'user::alice@acme.com');
    select('gb-ends', 'date');
    fixture.componentInstance.endDate.set('2000-01-01T10:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.canSave()).toBeFalse();
    expect(text()).toContain('Pick a date in the future');
    fixture.componentInstance.save();
    expect(addGrant).not.toHaveBeenCalled();
  });

  it('preselects one day when Platform operator is picked, and explains it', async () => {
    await build();
    expect(text()).not.toContain('without reaching any application data');
    select('gb-role', 'platform_operator');
    expect(fixture.componentInstance.duration()).toBe('1d');
    expect(text()).toContain(
      'Runs the installation without reaching any application data.',
    );
  });

  it('lets the person change the preselected end back to never', async () => {
    await build();
    select('gb-role', 'platform_operator');
    select('gb-ends', 'never');
    select('gb-who', 'user::alice@acme.com');
    fixture.componentInstance.save();
    expect(addGrant.calls.mostRecent().args[0].role).toBe('platform_operator');
    expect(addGrant.calls.mostRecent().args[1]).toBeNull();
  });

  it('opens with a preset role and end', async () => {
    await build({ role: 'platform_operator', duration: '1d' });
    expect(fixture.componentInstance.role()).toBe('platform_operator');
    expect(fixture.componentInstance.duration()).toBe('1d');
  });
});
