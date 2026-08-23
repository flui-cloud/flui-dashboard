import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { readKeySurface, understatesItself } from './agent-key-surface';

const CATALOGUE = [
  {
    key: 'apps:look',
    area: 'apps',
    depth: 'look',
    label: 'See applications',
    summary: 'Read the applications on this instance and change nothing.',
    scopes: ['mcp:catalog:read', 'mcp:app:read', 'mcp:spec:validate'],
    grantable: true,
  },
  {
    key: 'apps:change',
    area: 'apps',
    depth: 'change',
    label: 'Deploy and operate applications',
    summary: 'Deploy, install, scale, restart and stop applications.',
    scopes: [
      'mcp:catalog:read',
      'mcp:app:read',
      'mcp:spec:validate',
      'mcp:app:write',
      'mcp:obs:read',
    ],
    grantable: true,
  },
  {
    key: 'apps:destroy',
    area: 'apps',
    depth: 'destroy',
    label: 'Delete applications',
    summary: 'Everything Deploy and operate applications can do, plus deleting.',
    scopes: [
      'mcp:catalog:read',
      'mcp:app:read',
      'mcp:spec:validate',
      'mcp:app:write',
      'mcp:obs:read',
      'mcp:app:destructive',
    ],
    grantable: false,
  },
  {
    key: 'observability:look',
    area: 'observability',
    depth: 'look',
    label: 'Read logs and health',
    summary: 'Read logs, edge traffic and alert history.',
    scopes: ['mcp:app:read', 'mcp:obs:read'],
    grantable: true,
  },
] as unknown as PermissionGroupDto[];

const key = (over: Partial<ApiKeyResponseDto> = {}): ApiKeyResponseDto =>
  ({
    id: 'k1',
    name: 'agent',
    revoked: false,
    createdAt: '2026-08-22T09:00:00.000Z',
    scopes: [],
    groups: [],
    ungroupedScopes: [],
    ...over,
  }) as ApiKeyResponseDto;

describe('reading what a key can do', () => {
  it('names the groups when the groups describe the whole key', () => {
    const surface = readKeySurface(
      key({
        scopes: [
          'mcp:catalog:read',
          'mcp:app:read',
          'mcp:obs:read',
          'mcp:spec:validate',
          'mcp:app:write',
        ],
        groups: ['apps:change', 'observability:look'] as never,
        ungroupedScopes: [],
      }),
      CATALOGUE,
    );

    expect(surface.shape).toBe('grouped');
    expect(surface.headline).toBe(
      'Deploy and operate applications and Read logs and health',
    );
    expect(surface.caution).toBeNull();
    expect(understatesItself(surface)).toBe(false);
  });

  it('never describes a key by the smallest group that fits inside it', () => {
    const surface = readKeySurface(
      key({
        name: 'minted before the group changed',
        scopes: [
          'mcp:catalog:read',
          'mcp:app:read',
          'mcp:spec:validate',
          'mcp:app:write',
        ],
        groups: ['apps:look'] as never,
        ungroupedScopes: ['mcp:app:write'],
      }),
      CATALOGUE,
    );

    expect(surface.shape).toBe('beyond-groups');
    expect(understatesItself(surface)).toBe(true);
    expect(surface.headline).toBe('See applications, and more');
    expect(surface.caution).toContain('does more than those names say');
    expect(surface.caution).toContain('mcp:app:write');
    expect(surface.caution).toContain('Deploy and operate applications');
    expect(surface.extras).toEqual([
      {
        scope: 'mcp:app:write',
        carriedBy: ['Deploy and operate applications', 'Delete applications'],
      },
    ]);
  });

  it('says so when no group at all describes the key', () => {
    const surface = readKeySurface(
      key({
        scopes: ['mcp:app:write'],
        groups: [],
        ungroupedScopes: ['mcp:app:write'],
      }),
      CATALOGUE,
    );

    expect(surface.shape).toBe('no-group');
    expect(surface.headline).toBe('No group describes this key');
    expect(surface.caution).toContain('matches no group on this instance');
    expect(understatesItself(surface)).toBe(true);
  });

  it('still names a loose scope the catalogue has never heard of', () => {
    const surface = readKeySurface(
      key({
        scopes: ['mcp:mail:read'],
        groups: [],
        ungroupedScopes: ['mcp:mail:read'],
      }),
      CATALOGUE,
    );

    expect(surface.extras).toEqual([{ scope: 'mcp:mail:read', carriedBy: [] }]);
    expect(surface.caution).toContain(
      'mcp:mail:read, which no group on this instance describes',
    );
  });

  it('reads an unscoped key as the widest one on the screen, not the emptiest', () => {
    const surface = readKeySurface(
      key({ scopes: undefined, groups: undefined, ungroupedScopes: undefined }),
      CATALOGUE,
    );

    expect(surface.shape).toBe('unscoped');
    expect(surface.headline).toBe('Everything you can do');
    expect(surface.caution).toContain('full weight');
  });

  it('keeps the raw name of a group the catalogue does not describe', () => {
    const surface = readKeySurface(
      key({
        scopes: ['mcp:backup:read'],
        groups: ['backups:look'] as never,
        ungroupedScopes: [],
      }),
      CATALOGUE,
    );

    expect(surface.groups).toEqual([
      { key: 'backups:look', label: 'backups:look', summary: '' },
    ]);
    expect(surface.headline).toBe('backups:look');
  });

  it('calls an empty scope list nothing, and only that', () => {
    const surface = readKeySurface(key({ scopes: [] }), CATALOGUE);
    expect(surface.shape).toBe('nothing');
    expect(surface.headline).toBe('Carries nothing');
  });
});
