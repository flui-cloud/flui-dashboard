export type GithubCredential =
  'github-app' | 'github-account' | 'repository-token' | 'packages-token';

export interface GithubCredentialProblem {
  readonly credential: GithubCredential;
  readonly title: string;
  readonly message: string;
}

const CREDENTIAL_TITLES: Record<GithubCredential, string> = {
  'github-app': 'Reconnect GitHub',
  'github-account': 'Reconnect GitHub',
  'repository-token': 'The repository token is not valid',
  'packages-token': 'The GitHub packages token is not valid',
};

const FALLBACK_MESSAGE =
  'GitHub refused the stored credential. Open repositories to replace or reconnect it.';

function isCredential(value: unknown): value is GithubCredential {
  return typeof value === 'string' && value in CREDENTIAL_TITLES;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function githubCredentialProblem(error: unknown): GithubCredentialProblem | null {
  const failure = asRecord(error);
  const body = asRecord(failure?.['error']);
  if (!failure || !body) return null;
  const status = failure['status'] ?? body['statusCode'];
  if (status !== 424 || body['code'] !== 'GITHUB_TOKEN_INVALID') return null;
  const credential = body['credential'];
  if (!isCredential(credential)) return null;
  const message = body['message'];
  return {
    credential,
    title: CREDENTIAL_TITLES[credential],
    message: typeof message === 'string' && message.trim() ? message : FALLBACK_MESSAGE,
  };
}
