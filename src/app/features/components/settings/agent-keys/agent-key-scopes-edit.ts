import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';

export const AREA_LABEL: Record<string, string> = {
  apps: 'Applications',
  observability: 'Logs and health',
  backups: 'Backups',
  migrations: 'Migrations',
  mail: 'Mail',
  access: 'Who has access',
  infrastructure: 'Infrastructure',
  platform: 'Platform updates',
};

export const DEPTH_WORD: Record<string, string> = {
  look: 'See',
  change: 'Change',
  destroy: 'Delete',
};

export interface ScopeArea {
  key: string;
  groups: PermissionGroupDto[];
}

/** The catalogue by area, in the order the catalogue lists them. */
export function areasOf(catalogue: readonly PermissionGroupDto[]): ScopeArea[] {
  const order: string[] = [];
  const byArea = new Map<string, PermissionGroupDto[]>();
  for (const g of catalogue) {
    if (!byArea.has(g.area)) {
      byArea.set(g.area, []);
      order.push(g.area);
    }
    byArea.get(g.area)!.push(g);
  }
  return order.map((key) => ({ key, groups: byArea.get(key)! }));
}

/**
 * The group a key already holds in each area: the deepest one whose scopes it
 * carries in full. An area where it holds none stays empty.
 */
export function heldGroups(
  catalogue: readonly PermissionGroupDto[],
  scopes: readonly string[],
): Set<string> {
  const held = new Set(scopes);
  const picked = new Set<string>();
  for (const area of areasOf(catalogue)) {
    const full = area.groups.filter((g) => g.scopes.every((s) => held.has(s)));
    const deepest = full[full.length - 1];
    if (deepest) picked.add(deepest.key);
  }
  return picked;
}

/**
 * What the key carries once saved: the chosen groups' scopes, plus whatever it
 * holds that no group names, which a group picker has no way to show and so
 * must not drop.
 */
export function scopesAfter(
  catalogue: readonly PermissionGroupDto[],
  current: readonly string[],
  picked: ReadonlySet<string>,
): string[] {
  const grouped = new Set(catalogue.flatMap((g) => g.scopes));
  const kept = current.filter((s) => !grouped.has(s));
  const chosen = catalogue.filter((g) => picked.has(g.key)).flatMap((g) => g.scopes);
  return [...new Set([...kept, ...chosen])];
}
