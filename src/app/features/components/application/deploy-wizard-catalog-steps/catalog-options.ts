import { CatalogOptionDto } from '../../../../core/api/model/models';

type Option = Pick<CatalogOptionDto, 'key' | 'default'> & { requires?: string };

/**
 * An option as the install will read it, the same rule the API applies: what
 * the person chose, else the declared default, and off while the option it
 * requires is off.
 */
export function catalogOptionEnabled(
  options: Option[],
  toggles: Record<string, boolean>,
  key: string,
): boolean {
  const option = options.find((o) => o.key === key);
  if (option?.requires && !catalogOptionEnabled(options, toggles, option.requires)) {
    return false;
  }
  return toggles[key] ?? option?.default ?? false;
}

/** True while the option this one requires is off: shown, but not choosable. */
export function catalogOptionBlocked(
  options: Option[],
  toggles: Record<string, boolean>,
  key: string,
): boolean {
  const requires = options.find((o) => o.key === key)?.requires;
  return !!requires && !catalogOptionEnabled(options, toggles, requires);
}
