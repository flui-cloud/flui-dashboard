import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { heldGroups, scopesAfter } from './agent-key-scopes-edit';

const group = (key: string, area: string, scopes: string[]): PermissionGroupDto =>
  ({ key, area, depth: 'x', label: key, summary: '', scopes, grantable: true, blockedScopes: [] }) as unknown as PermissionGroupDto;

const CATALOGUE = [
  group('apps:look', 'apps', ['mcp:app:read']),
  group('apps:change', 'apps', ['mcp:app:read', 'mcp:app:write']),
  group('apps:destroy', 'apps', ['mcp:app:read', 'mcp:app:write', 'mcp:app:destructive']),
  group('mail:look', 'mail', ['mcp:mail:read']),
];

describe('editing what a key may do', () => {
  it('starts from the deepest group the key carries in each area', () => {
    const picked = heldGroups(CATALOGUE, ['mcp:app:read', 'mcp:app:write', 'mcp:onboarding:read']);
    expect([...picked]).toEqual(['apps:change']);
  });

  it('saves the chosen groups and keeps what no group names', () => {
    const next = scopesAfter(
      CATALOGUE,
      ['mcp:app:read', 'mcp:app:write', 'mcp:onboarding:read'],
      new Set(['apps:destroy', 'mail:look']),
    );
    expect(next.sort()).toEqual(
      ['mcp:app:destructive', 'mcp:app:read', 'mcp:app:write', 'mcp:mail:read', 'mcp:onboarding:read'].sort(),
    );
  });

  it('drops an area set to none', () => {
    const next = scopesAfter(CATALOGUE, ['mcp:app:read', 'mcp:mail:read'], new Set(['mail:look']));
    expect(next).toEqual(['mcp:mail:read']);
  });
});
