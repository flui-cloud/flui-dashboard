export interface ExportPalette {
  bg: string;
  card: string;
  border: string;
  fg: string;
  muted: string;
  brand: string;
  ok: string;
  warn: string;
  err: string;
  track: string;
}

export function paletteFromDocument(root: HTMLElement = document.documentElement): ExportPalette {
  const css = getComputedStyle(root);
  const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
  return {
    bg: token('fl-surface'),
    card: token('fl-surface'),
    border: token('fl-border'),
    fg: token('fl-ink'),
    muted: token('fl-ink-muted'),
    brand: token('fl-accent'),
    ok: token('fl-success'),
    warn: token('fl-warning'),
    err: token('fl-danger'),
    track: token('fl-surface-subtle'),
  };
}
