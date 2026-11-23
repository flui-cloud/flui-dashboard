import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { AppVersioningService } from './app-versioning.service';

describe('AppVersioningService GitHub credential failures', () => {
  let versions: jasmine.Spy;
  let service: AppVersioningService;

  beforeEach(() => {
    versions = jasmine.createSpy('versions');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApplicationsService,
          useValue: { applicationReleasesControllerGetAvailableVersions: versions },
        },
      ],
    });
    service = TestBed.inject(AppVersioningService);
  });

  const fail = (status: number, body: unknown) =>
    versions.and.returnValue(
      throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'x' })),
    );

  it('exposes the credential problem and still raises the error', async () => {
    fail(424, {
      statusCode: 424,
      code: 'GITHUB_TOKEN_INVALID',
      credential: 'packages-token',
      message: 'Replace the packages token in Repositories.',
    });
    await expectAsync(service.loadAvailableVersions('a1')).toBeRejected();
    expect(service.credentialProblem()).toEqual({
      credential: 'packages-token',
      title: 'The GitHub packages token is not valid',
      message: 'Replace the packages token in Repositories.',
    });
    expect(service.error()).toContain('The available versions could not be read');
  });

  it('leaves other failures to the generic error', async () => {
    fail(500, { message: 'boom' });
    await expectAsync(service.loadAvailableVersions('a1')).toBeRejected();
    expect(service.credentialProblem()).toBeNull();
    expect(service.error()).toContain('boom');
  });

  it('forgets the problem on reset', async () => {
    fail(424, {
      statusCode: 424,
      code: 'GITHUB_TOKEN_INVALID',
      credential: 'github-app',
      message: 'Reconnect.',
    });
    await expectAsync(service.loadAvailableVersions('a1')).toBeRejected();
    service.reset();
    expect(service.credentialProblem()).toBeNull();
  });
});
