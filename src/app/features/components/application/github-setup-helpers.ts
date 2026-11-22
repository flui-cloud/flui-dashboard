import type { SetupMethod } from '../../service/github-setup-wizard.service';
import type { GitHubSetupStatusResponseDto } from '../../../core/api/model/gitHubSetupStatusResponseDto';

export const PAT_DEEP_LINK =
  'https://github.com/settings/tokens/new' +
  '?scopes=repo,workflow,user:email,admin:repo_hook,write:packages,read:packages,delete:packages' +
  '&description=Flui';

export interface DerivedUrls {
  readonly callback: string;
  readonly redirect: string;
  readonly webhook: string;
}

export function isLocalUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url);
}

export function derivedUrls(raw: string): DerivedUrls | null {
  const url = raw.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const base = url.replace(/\/$/, '');
  return {
    callback: `${base}/api/v1/repositories/github-app/user-callback`,
    redirect: `${base}/api/v1/repositories/github/setup/github-app/manifest-callback`,
    webhook: `${base}/api/v1/webhooks/github-app`,
  };
}

export function methodLabel(method: SetupMethod): string {
  switch (method) {
    case 'github_app':
      return 'GitHub App';
    case 'pat':
      return 'Personal access token';
    default:
      return 'Not chosen';
  }
}

export function existingLabel(status: GitHubSetupStatusResponseDto | null): string {
  if (!status?.configured) return '';
  const mode = status.authMethod === 'github_app' ? 'GitHub App' : 'Personal access token';
  return status.appSlug ? `${mode}, ${status.appSlug}` : mode;
}

export function patErrorLabel(error?: string, message?: string): string {
  switch (error) {
    case 'invalid_token':
      return 'GitHub rejected the token (401).';
    case 'sso_required':
      return 'This token needs SSO authorization for one of your organizations. Authorize it on GitHub and try again.';
    case 'empty_token':
      return 'Paste a token to validate.';
    case 'github_unreachable':
      return `Could not reach GitHub: ${message ?? 'unknown error'}`;
    default: {
      const suffix = message ? `: ${message}` : '.';
      return `Token validation failed${suffix}`;
    }
  }
}
