import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IamService } from '../../service/iam.service';
import { GroupsTabComponent } from './groups-tab.component';
import { PermissionService } from '../../../core/services/permission.service';

describe('deleting an access group', () => {
  let fixture: ComponentFixture<GroupsTabComponent>;
  let removeGroup: jasmine.Spy;

  beforeEach(async () => {
    removeGroup = jasmine.createSpy('removeGroup');
    const iam = {
      groups: signal([
        { name: 'platform', description: 'Runs the clusters', members: ['a@x.io', 'b@x.io'] },
      ]),
      users: signal([]),
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

  const byText = (label: string): HTMLButtonElement | undefined => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    return buttons.find((b) => b.textContent?.trim() === label);
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
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Delete group');
    expect(text).toContain('cannot be undone');
    expect(text).toContain('2 member(s) lose whatever this group granted them.');
  });

  it('deletes once the person confirms', () => {
    trashButton()!.click();
    fixture.detectChanges();
    byText('Delete')!.click();
    fixture.detectChanges();
    expect(removeGroup).toHaveBeenCalledWith('platform');
  });

  it('deletes nothing when the person backs out', () => {
    trashButton()!.click();
    fixture.detectChanges();
    byText('Cancel')!.click();
    fixture.detectChanges();
    expect(removeGroup).not.toHaveBeenCalled();
  });
});
