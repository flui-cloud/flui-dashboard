import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProjectsService } from './projects.service';

const BASE = 'https://api.example.test/api/v1';

describe('ProjectsService', () => {
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationService>;
  let service: ProjectsService;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['add']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: NotificationService, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProjectsService);
  });

  afterEach(() => http.verify());

  it('counts every application of a project, system ones included', () => {
    service.loadResidents();
    http.expectOne(`${BASE}/iam/resources`).flush([
      { id: 'a', project: 'billing', type: 'user' },
      { id: 'b', project: 'billing', type: 'system' },
      { id: 'c', project: 'growth', type: 'system' },
      { id: 'd', type: 'user' },
    ]);
    expect(service.residents()?.get('billing')).toBe(2);
    expect(service.residents()?.get('growth')).toBe(1);
  });

  it('knows nothing when the resources cannot be read', () => {
    service.loadResidents();
    http.expectOne(`${BASE}/iam/resources`).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(service.residents()).toBeNull();
  });

  it('explains a delete refused because the project is not empty and re-reads it', () => {
    service.remove('p-1');
    http
      .expectOne(`${BASE}/projects/p-1`)
      .flush({ code: 'PROJECT_NOT_EMPTY' }, { status: 409, statusText: 'Conflict' });
    expect(notify.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        body: 'The project still holds applications, platform ones included.',
      }),
    );
    http.expectOne(`${BASE}/iam/resources`).flush([{ id: 'b', project: 'billing' }]);
    expect(service.residents()?.get('billing')).toBe(1);
  });
});
