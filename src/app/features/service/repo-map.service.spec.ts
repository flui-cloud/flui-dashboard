import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { RepositoriesService } from '../../core/api/api/repositories.service';
import { Configuration } from '../../core/api/configuration';
import { RepoMapService } from './repo-map.service';

describe('RepoMapService branches', () => {
  let listBranches: jasmine.Spy;
  let service: RepoMapService;

  beforeEach(() => {
    listBranches = jasmine.createSpy('listBranches');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: Configuration, useValue: { basePath: '', withCredentials: false } },
        {
          provide: RepositoriesService,
          useValue: { repositoriesControllerListBranches: listBranches },
        },
      ],
    });
    service = TestBed.inject(RepoMapService);
  });

  const fail = (status: number, body: unknown) =>
    listBranches.and.returnValue(
      throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'x' })),
    );

  it('reports an invalid GitHub credential next to the generic error', async () => {
    fail(424, {
      statusCode: 424,
      code: 'GITHUB_TOKEN_INVALID',
      credential: 'github-app',
      message: 'Reconnect the GitHub app.',
    });
    await service.loadBranches('r1');
    expect(service.branches()).toEqual([]);
    expect(service.branchesError()).toBe('Reconnect the GitHub app.');
    expect(service.branchesProblem()).toEqual({
      credential: 'github-app',
      title: 'Reconnect GitHub',
      message: 'Reconnect the GitHub app.',
    });
  });

  it('keeps the generic handling for other failures', async () => {
    fail(500, { message: 'boom' });
    await service.loadBranches('r1');
    expect(service.branchesError()).toBe('boom');
    expect(service.branchesProblem()).toBeNull();
  });
});
