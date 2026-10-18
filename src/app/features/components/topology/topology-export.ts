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

/** The portal's own colours, read from the theme in use. */
export function paletteFromDocument(root: HTMLElement = document.documentElement): ExportPalette {
  const css = getComputedStyle(root);
  const token = (name: string, alpha?: number) => {
    const value = css.getPropertyValue(`--${name}`).trim();
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  };
  return {
    bg: token('background'),
    card: token('card'),
    border: token('border'),
    fg: token('foreground'),
    muted: token('muted-foreground'),
    brand: token('brand'),
    ok: token('ok'),
    warn: token('warn'),
    err: token('destructive'),
    track: token('muted'),
  };
}
