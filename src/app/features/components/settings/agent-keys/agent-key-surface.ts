import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';

export type KeyShape =
  | 'unscoped'
  | 'grouped'
  | 'beyond-groups'
  | 'no-group'
  | 'nothing';

export interface SurfaceGroup {
  key: string;
  label: string;
  summary: string;
}

export interface SurfaceExtra {
  scope: string;
  carriedBy: string[];
}

export interface KeySurface {
  shape: KeyShape;
  groups: SurfaceGroup[];
  extras: SurfaceExtra[];
  headline: string;
  caution: string | null;
}

const NOTHING: KeySurface = {
  shape: 'nothing',
  groups: [],
  extras: [],
  headline: 'Carries nothing',
  caution: null,
};

function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function extrasOf(
  scopes: string[],
  catalogue: PermissionGroupDto[],
): SurfaceExtra[] {
  return scopes.map((scope) => ({
    scope,
    carriedBy: catalogue
      .filter((g) => g.scopes.includes(scope))
      .map((g) => g.label),
  }));
}

function sentenceForExtras(extras: SurfaceExtra[]): string {
  return joinWords(
    extras.map((e) =>
      e.carriedBy.length
        ? `${e.scope}, which belongs to ${joinWords(e.carriedBy)}`
        : `${e.scope}, which no group on this instance describes`,
    ),
  );
}

export function readKeySurface(
  key: ApiKeyResponseDto,
  catalogue: PermissionGroupDto[],
): KeySurface {
  const scopes = key.scopes ?? null;

  if (scopes === null) {
    return {
      shape: 'unscoped',
      groups: [],
      extras: [],
      headline: 'Everything you can do',
      caution:
        'This key was issued without a scope list, so it carries the full weight of whoever issued it — not a group on this screen. Revoke it if an agent no longer needs that much.',
    };
  }
  if (!scopes.length) return NOTHING;

  const groups: SurfaceGroup[] = (key.groups ?? []).map((k) => {
    const known = catalogue.find((g) => g.key === k);
    return known
      ? { key: known.key, label: known.label, summary: known.summary }
      : { key: k, label: k, summary: '' };
  });

  const extras = extrasOf(key.ungroupedScopes ?? [], catalogue);
  const labels = groups.map((g) => g.label);

  if (!extras.length) {
    return {
      shape: 'grouped',
      groups,
      extras,
      headline: labels.length ? joinWords(labels) : 'Carries nothing',
      caution: null,
    };
  }

  if (!groups.length) {
    return {
      shape: 'no-group',
      groups,
      extras,
      headline: 'No group describes this key',
      caution: `This key was assembled scope by scope and matches no group on this instance. It carries ${sentenceForExtras(extras)}.`,
    };
  }

  return {
    shape: 'beyond-groups',
    groups,
    extras,
    headline: `${joinWords(labels)}, and more`,
    caution: `This key does more than those names say: on top of them it carries ${sentenceForExtras(extras)}. No group on this instance matches its surface exactly, so read the scopes, not the badges.`,
  };
}

export function understatesItself(surface: KeySurface): boolean {
  return surface.shape === 'beyond-groups' || surface.shape === 'no-group';
}
