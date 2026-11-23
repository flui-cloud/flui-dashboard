import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RepositoriesService } from '../../core/api/api/repositories.service';
import { Application } from '../model/application.models';
import { BuildBranchService } from './build-branch.service';
import { RepositoryService } from './repository.service';

describe('BuildBranchService', () => {
  let api: jasmine.SpyObj<RepositoriesService>;
  const known = signal<{ id: string; branch: string }[]>([]);

  function app(sourceConfig: object): Application {
    return { sourceConfig } as Application;
  }

  beforeEach(() => {
    known.set([]);
    api = jasmine.createSpyObj<RepositoriesService>('RepositoriesService', [
      'repositoriesControllerGetRepository',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: RepositoriesService, useValue: api },
        { provide: RepositoryService, useValue: { repositories: known.asReadonly() } },
      ],
    });
  });

  const service = () => TestBed.inject(BuildBranchService);

  it('uses the build branch before anything else', async () => {
    expect(await service().branchFor(app({ branch: 'develop' }), 'release')).toBe('release');
    expect(api.repositoriesControllerGetRepository).not.toHaveBeenCalled();
  });

  it("uses the application's source branch", async () => {
    expect(await service().branchFor(app({ branch: 'develop', repositoryId: 'r1' }))).toBe(
      'develop',
    );
    expect(api.repositoriesControllerGetRepository).not.toHaveBeenCalled();
  });

  it('uses the default branch of an already loaded repository', async () => {
    known.set([{ id: 'r1', branch: 'trunk' }]);
    expect(await service().branchFor(app({ repositoryId: 'r1' }))).toBe('trunk');
    expect(api.repositoriesControllerGetRepository).not.toHaveBeenCalled();
  });

  it('reads the repository when it is not loaded', async () => {
    api.repositoriesControllerGetRepository.and.returnValue(
      of({ defaultBranch: 'trunk' }) as never,
    );
    expect(await service().branchFor(app({ repositoryId: 'r1' }))).toBe('trunk');
  });

  it('ends on main when the repository cannot be read', async () => {
    api.repositoriesControllerGetRepository.and.returnValue(throwError(() => new Error('x')));
    expect(await service().branchFor(app({ repositoryId: 'r1' }))).toBe('main');
    expect(await service().branchFor(null)).toBe('main');
  });
});
