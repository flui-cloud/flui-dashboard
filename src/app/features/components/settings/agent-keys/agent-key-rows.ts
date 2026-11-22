import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { ConfirmOptions } from '../../../../ui/overlays/confirm';
import { KeySurface, readKeySurface, understatesItself } from './agent-key-surface';
import { ConnectedKey, KeyConnection, readKeyConnection } from './agent-key-connection';

export interface KeyRow {
  key: ApiKeyResponseDto;
  surface: KeySurface;
  warn: boolean;
  expired: boolean;
  scopes: string;
  connection: KeyConnection;
  appNames: string[] | null;
  projectNames: string[] | null;
}

/** Which of a row's editors, if any, is open right now. */
export interface EditTarget {
  keyId: string;
  field: 'applications' | 'projects' | 'permissions';
}

export function resolveNames(
  ids: string[] | null | undefined,
  names: ReadonlyMap<string, string>,
): string[] | null {
  if (!ids) return null;
  return ids.map((id) => names.get(id) ?? `${id} (deleted)`);
}

export function keyRows(
  keys: readonly ApiKeyResponseDto[],
  catalogue: PermissionGroupDto[],
  appNames: ReadonlyMap<string, string>,
  projectNames: ReadonlyMap<string, string>,
  skillVersion: string | null,
  now: number = Date.now(),
): KeyRow[] {
  return keys.map((key) => {
    const surface = readKeySurface(key, catalogue);
    return {
      key,
      surface,
      warn: understatesItself(surface) || surface.shape === 'unscoped',
      expired: !!key.expiresAt && new Date(key.expiresAt).getTime() < now,
      scopes: key.scopes?.length ? key.scopes.join(' · ') : 'no scope list, unscoped',
      connection: readKeyConnection(key as ConnectedKey, skillVersion),
      appNames: resolveNames(key.applicationIds, appNames),
      projectNames: resolveNames(key.projectIds, projectNames),
    };
  });
}

export function reachLine(row: Pick<KeyRow, 'appNames' | 'projectNames'>): string {
  const { appNames, projectNames } = row;
  if (appNames === null && projectNames === null) return 'Reaches every application you can.';
  if (projectNames !== null) {
    const head =
      projectNames.length === 0
        ? 'Every project it named is gone'
        : `Reaches ${projectNames.join(', ')}`;
    return appNames !== null && appNames.length > 0
      ? `${head}, plus ${appNames.join(', ')}.`
      : `${head}.`;
  }
  if (appNames!.length === 0)
    return 'Reaches no application: every application id it named is gone.';
  return `Limited to ${appNames!.join(', ')}.`;
}

export function revokeQuestion(
  key: ApiKeyResponseDto,
  catalogue: PermissionGroupDto[],
  skillVersion: string | null,
): ConfirmOptions {
  const connection = readKeyConnection(key as ConnectedKey, skillVersion);
  const what = `${key.name}: ${readKeySurface(key, catalogue).headline}, ${
    connection.everUsed ? connection.seen : 'never used'
  }.`;
  const body = key.current
    ? 'This is the credential this browser is signed in with. Revoking it ends your session here. ' +
      'You will be signed out immediately, and there is no way back in with this credential. ' +
      'Anything already built stays where it is, only the credential goes.'
    : 'The agent holding it stops working the moment you confirm. ' +
      'Anything the agent has already built stays where it is, only the credential goes. ' +
      'You are not signed in with this one, so your own session is unaffected.';
  return {
    title: key.current ? 'Revoke the key you are using' : 'Revoke this key',
    body: `${what} ${body}`,
    confirmLabel: 'Revoke',
    destructive: true,
  };
}
