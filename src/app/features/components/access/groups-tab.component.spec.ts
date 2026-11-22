import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IamService } from '../../service/iam.service';
import { GroupsTabComponent } from './groups-tab.component';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmService } from '../../../ui/overlays/confirm';

describe('deleting an access group', () => {
  let fixture: ComponentFixture<GroupsTabComponent>;
  let removeGroup: jasmine.Spy;
  let confirm: jasmine.Spy;

  beforeEach(async () => {
    removeGroup = jasmine.createSpy('removeGroup');
    confirm = jasmine.createSpy('confirm').and.resolveTo(false);
    const iam = {
      groups: signal([
        { name: 'platform', description: 'Runs the clusters', members: ['a@x.io', 'b@x.io'] },
      ]),
      users: signal([]),
      userKind: signal(null),
      loadUsers: jasmine.createSpy('loadUsers'),
      removeGroup,
      removeGroupMember: jasmine.createSpy('removeGroupMember'),
      createGroup: jasmine.createSpy('createGroup'),
      addGroupMember: jasmine.createSpy('addGroupMember'),
    };

    await TestBed.configureTestingModule({
      imports: [GroupsTabComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: IamService, useValue: iam },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupsTabComponent);
    fixture.detectChanges();
  });

  const trashButton = (): HTMLButtonElement | undefined => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    return buttons.find((b) => b.getAttribute('title') === 'Delete group');
  };

  it('renders the gesture at all — a button that is not there proves nothing', () => {
    expect(trashButton()).toBeDefined();
  });

  it('does not delete anything on the click itself', () => {
    trashButton()!.click();
    fixture.detectChanges();
    expect(removeGroup).not.toHaveBeenCalled();
  });

  it('says how many people lose access', () => {
    trashButton()!.click();
    const options = confirm.calls.mostRecent().args[0];
    expect(options.title).toBe('Delete group');
    expect(options.body).toContain('cannot be undone');
    expect(options.body).toContain('2 member(s) lose whatever this group granted them.');
    expect(options.destructive).toBeTrue();
  });

  it('deletes once the person confirms', async () => {
    confirm.and.resolveTo(true);
    trashButton()!.click();
    await confirm.calls.mostRecent().returnValue;
    expect(removeGroup).toHaveBeenCalledWith('platform');
  });

  it('deletes nothing when the person backs out', async () => {
    confirm.and.resolveTo(false);
    trashButton()!.click();
    await confirm.calls.mostRecent().returnValue;
    expect(removeGroup).not.toHaveBeenCalled();
  });
});

describe('the groups tab and the shared list of people', () => {
  const open = (kind: 'visitor' | null) => {
    const iam = {
      groups: signal([]),
      users: signal([]),
      userKind: signal<'visitor' | null>(kind),
      loadUsers: jasmine.createSpy('loadUsers'),
    };
    TestBed.configureTestingModule({
      imports: [GroupsTabComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: IamService, useValue: iam },
        { provide: PermissionService, useValue: { can: () => true } },
      ],
    });
    TestBed.createComponent(GroupsTabComponent).detectChanges();
    return iam;
  };

  it('asks for everyone again when the People tab left it filtered', () => {
    const iam = open('visitor');
    expect(iam.userKind()).toBeNull();
    expect(iam.loadUsers).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when the list already holds everyone', () => {
    expect(open(null).loadUsers).not.toHaveBeenCalled();
  });
});
