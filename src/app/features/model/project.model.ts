export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  /** Set on a person's personal project, where their apps go by default. */
  ownerUserId?: string | null;
}

export interface ProjectOption {
  slug: string;
  name: string;
}

export const PROJECT_PRESET_TOKENS = [
  '--fl-red-500',
  '--fl-red-400',
  '--fl-amber-600',
  '--fl-amber-400',
  '--fl-green-700',
  '--fl-green-500',
  '--fl-green-400',
  '--fl-blue-400',
  '--fl-blue-500',
  '--fl-blue-700',
  '--fl-navy-700',
  '--fl-gray-500',
] as const;

export function projectPresetColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return PROJECT_PRESET_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter(
    (value) => value.length > 0,
  );
}
