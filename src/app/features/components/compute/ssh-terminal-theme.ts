import type { ITheme } from 'xterm';

const ANSI: Record<string, string> = {
  black: '--fl-navy-900',
  red: '--fl-red-400',
  green: '--fl-green-400',
  yellow: '--fl-amber-400',
  blue: '--fl-blue-400',
  magenta: '--fl-navy-300',
  cyan: '--fl-blue-300',
  white: '--fl-gray-200',
  brightBlack: '--fl-gray-500',
  brightRed: '--fl-red-300',
  brightGreen: '--fl-green-300',
  brightYellow: '--fl-amber-300',
  brightBlue: '--fl-blue-200',
  brightMagenta: '--fl-navy-100',
  brightCyan: '--fl-blue-100',
  brightWhite: '--fl-white',
};

const ROLES: Record<string, string> = {
  background: '--fl-topbar-bg',
  foreground: '--fl-topbar-fg',
  cursor: '--fl-topbar-fg',
  cursorAccent: '--fl-topbar-bg',
  selectionBackground: '--fl-topbar-field-border',
};

export function readTerminalTheme(root: Element = document.documentElement): ITheme {
  const style = getComputedStyle(root);
  const theme: Record<string, string> = {};
  for (const [key, variable] of Object.entries({ ...ROLES, ...ANSI })) {
    const value = style.getPropertyValue(variable).trim();
    if (value) theme[key] = value;
  }
  return theme as ITheme;
}
