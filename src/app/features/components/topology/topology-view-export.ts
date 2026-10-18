import { ExportPalette } from './topology-export';

/** What every exported view carries above the drawing: where it is, what it holds, whether it is masked. */
export interface ExportHeader {
  title: string;
  subtitle: string;
  masked: boolean;
}

export const HEADER_H = 120;
export const MARGIN = 32;

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`);
}

/** `hsl(var(--brand) / 0.4)` as the theme in use says it: an exported image has no stylesheet to ask. */
export function resolveColor(value: string, root: HTMLElement = document.documentElement): string {
  if (!value.includes('var(')) return value;
  const css = getComputedStyle(root);
  return value.replace(/var\(--([\w-]+)\)/g, (_, name: string) => css.getPropertyValue(`--${name}`).trim());
}

export function fontFamily(): string {
  return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}

/** Text cut to a width, roughly: the image has no layout engine to measure with. */
export function fit(text: string, width: number, size: number): string {
  const max = Math.max(3, Math.floor(width / (size * 0.56)));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function frame(
  body: string,
  size: { width: number; height: number },
  header: ExportHeader,
  palette: ExportPalette,
): { svg: string; width: number; height: number } {
  const width = Math.max(720, Math.ceil(size.width + 2 * MARGIN));
  const height = Math.ceil(HEADER_H + size.height + MARGIN);
  const stamp = header.masked
    ? `<g><rect x="${width - MARGIN - 92}" y="${MARGIN - 4}" width="92" height="28" rx="14" fill="${palette.err}"/>` +
      `<text x="${width - MARGIN - 46}" y="${MARGIN + 15}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">Masked</text></g>`
    : '';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(fontFamily())}">`,
    `<rect width="${width}" height="${height}" fill="${palette.bg}"/>`,
    `<rect x="${MARGIN}" y="${MARGIN}" width="18" height="18" rx="5" fill="${palette.brand}"/>`,
    `<text x="${MARGIN + 26}" y="${MARGIN + 14}" font-size="14" font-weight="600" fill="${palette.fg}">Flui</text>`,
    `<text x="${MARGIN}" y="${MARGIN + 46}" font-size="20" font-weight="700" fill="${palette.fg}">${esc(header.title)}</text>`,
    `<text x="${MARGIN}" y="${MARGIN + 64}" font-size="12" fill="${palette.muted}">${esc(header.subtitle)}</text>`,
    stamp,
    `<g transform="translate(${MARGIN} ${HEADER_H})">${body}</g>`,
    '</svg>',
  ].join('');
  return { svg, width, height };
}

/** Rasterises an exported view at twice its size and hands it to the browser as a PNG. */
export async function downloadView(view: { svg: string; width: number; height: number }, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([view.svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The image could not be drawn.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = view.width * 2;
    canvas.height = view.height * 2;
    const context = canvas.getContext('2d')!;
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The image could not be encoded.');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  } finally {
    URL.revokeObjectURL(url);
  }
}
