import { HttpErrorResponse } from '@angular/common/http';
import { githubCredentialProblem } from './github-credential';

const failure = (status: number, body: unknown) =>
  new HttpErrorResponse({ status, error: body, statusText: 'x' });

const invalid = (credential: unknown, message: unknown = 'Replace it in Repositories.') => ({
  statusCode: 424,
  code: 'GITHUB_TOKEN_INVALID',
  credential,
  message,
});

describe('githubCredentialProblem', () => {
  it('titles a packages token failure and keeps the API message', () => {
    expect(githubCredentialProblem(failure(424, invalid('packages-token')))).toEqual({
      credential: 'packages-token',
      title: 'The GitHub packages token is not valid',
      message: 'Replace it in Repositories.',
    });
  });

  it('titles a repository token failure', () => {
    expect(githubCredentialProblem(failure(424, invalid('repository-token')))?.title).toBe(
      'The repository token is not valid',
    );
  });

  it('asks to reconnect for the app and the account credentials', () => {
    expect(githubCredentialProblem(failure(424, invalid('github-app')))?.title).toBe(
      'Reconnect GitHub',
    );
    expect(githubCredentialProblem(failure(424, invalid('github-account')))?.title).toBe(
      'Reconnect GitHub',
    );
  });

  it('reads a plain error shaped like the response', () => {
    expect(githubCredentialProblem({ status: 424, error: invalid('github-app') })?.credential).toBe(
      'github-app',
    );
  });

  it('falls back to a generic message when the body carries none', () => {
    const problem = githubCredentialProblem(failure(424, invalid('github-app', '')));
    expect(problem?.message).toContain('Open repositories');
  });

  it('ignores a 424 that is not about a GitHub token', () => {
    expect(githubCredentialProblem(failure(424, { statusCode: 424, code: 'OTHER' }))).toBeNull();
  });

  it('ignores an unknown credential', () => {
    expect(githubCredentialProblem(failure(424, invalid('ssh-key')))).toBeNull();
  });

  it('ignores other statuses even with the same body', () => {
    expect(githubCredentialProblem(failure(502, invalid('github-app')))).toBeNull();
  });

  it('ignores anything that is not an error response', () => {
    expect(githubCredentialProblem(null)).toBeNull();
    expect(githubCredentialProblem(undefined)).toBeNull();
    expect(githubCredentialProblem('GITHUB_TOKEN_INVALID')).toBeNull();
    expect(githubCredentialProblem(new Error('boom'))).toBeNull();
    expect(githubCredentialProblem(failure(424, null))).toBeNull();
  });
});
