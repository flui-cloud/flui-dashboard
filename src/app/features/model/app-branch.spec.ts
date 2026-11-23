import { Application } from './application.models';
import { resolveBuildBranch, sourceBranchOf, sourceRepositoryIdOf } from './app-branch';

function app(sourceConfig: object): Application {
  return { sourceConfig } as Application;
}

describe('resolveBuildBranch', () => {
  it('prefers the branch of the build being retried', () => {
    expect(
      resolveBuildBranch({
        buildBranch: 'release',
        sourceBranch: 'develop',
        repositoryDefaultBranch: 'trunk',
      }),
    ).toBe('release');
  });

  it("falls back to the application's source branch", () => {
    expect(resolveBuildBranch({ sourceBranch: 'develop', repositoryDefaultBranch: 'trunk' })).toBe(
      'develop',
    );
  });

  it("falls back to the repository's default branch", () => {
    expect(resolveBuildBranch({ sourceBranch: ' ', repositoryDefaultBranch: 'trunk' })).toBe(
      'trunk',
    );
  });

  it('ends on main when nothing is known', () => {
    expect(resolveBuildBranch({})).toBe('main');
  });
});

describe('source config readers', () => {
  it('reads the branch and repository id', () => {
    const a = app({ branch: 'develop', repositoryId: 'repo-1' });
    expect(sourceBranchOf(a)).toBe('develop');
    expect(sourceRepositoryIdOf(a)).toBe('repo-1');
  });

  it('returns null for missing or non-string values', () => {
    const a = app({ branch: 3 });
    expect(sourceBranchOf(a)).toBeNull();
    expect(sourceRepositoryIdOf(a)).toBeNull();
    expect(sourceBranchOf(null)).toBeNull();
  });
});
