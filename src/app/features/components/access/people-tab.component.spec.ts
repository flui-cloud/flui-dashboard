import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PeopleTabComponent } from './people-tab.component';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';

const USERS = 'http://api/api/v1/auth/users';

describe('PeopleTabComponent visitors', () => {
  let fixture: ComponentFixture<PeopleTabComponent>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = [
    { id: 'p-1', email: 'mario@example.com', role: 'user', state: 'USER_STATE_ACTIVE', kind: 'person' },
    { id: 'v-1', email: 'visitor-1@demo.local', role: 'user', state: 'USER_STATE_ACTIVE', kind: 'visitor' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PeopleTabComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api', authMode: 'oidc' } },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: NotificationService, useValue: { add: () => undefined } },
        { provide: MaskModeService, useValue: { active: () => false, enabled: () => false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PeopleTabComponent);
    TestBed.inject(IamService).loadUsers();
    http.expectOne((r) => r.url === USERS && !r.params.has('kind')).flush(rows);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('marks visitor rows with a badge', () => {
    const badges = el().querySelectorAll('[data-testid="visitor-badge"]');
    expect(badges).toHaveSize(1);
    expect(badges[0].closest('tr')?.textContent).toContain('visitor-1@demo.local');
  });

  it('keeps the block action on a visitor row', () => {
    const row = el().querySelector('[data-testid="visitor-badge"]')!.closest('tr')!;
    expect(row.querySelector('button[title^="Disable"]')).not.toBeNull();
  });

  it('offers neither an invite link nor a role on a visitor row', () => {
    const visitor = el().querySelector('[data-testid="visitor-badge"]')!.closest('tr')!;
    expect(visitor.querySelector('button[title="Generate invite link"]')).toBeNull();
    expect(visitor.querySelector('select')).toBeNull();
    expect(visitor.querySelector('[data-testid="visitor-role"]')?.textContent).toContain('Read-only');

    const person = Array.from(el().querySelectorAll('tbody tr')).find((r) =>
      r.textContent?.includes('mario@example.com'),
    )!;
    expect(person.querySelector('button[title="Generate invite link"]')).not.toBeNull();
    expect(person.querySelector('select')).not.toBeNull();
  });

  it('asks the API for visitors only, then for everyone again', () => {
    (el().querySelector('[data-testid="kind-Visitors"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === USERS && r.params.get('kind') === 'visitor').flush([rows[1]]);
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr')).toHaveSize(1);

    (el().querySelector('[data-testid="kind-All"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === USERS && !r.params.has('kind')).flush(rows);
  });

  it('leaves the filter as it is when the tab closes, without asking again', () => {
    (el().querySelector('[data-testid="kind-People"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === USERS && r.params.get('kind') === 'person').flush([rows[0]]);
    fixture.destroy();
    http.expectNone((r) => r.url === USERS);
    expect(TestBed.inject(IamService).userKind()).toBe('person');
  });
});
