// Hand-written: the API field is newer than the last client generation.
export interface AppAccess {
  tabs: string[];
  readOnly: boolean;
  showcase: boolean;
}

export function accessOf(app: unknown): AppAccess | null {
  const candidate = (app as { access?: unknown } | null | undefined)?.access;
  if (!candidate || typeof candidate !== 'object') return null;
  const { tabs, readOnly, showcase } = candidate as Partial<AppAccess>;
  if (!Array.isArray(tabs)) return null;
  return { tabs, readOnly: !!readOnly, showcase: !!showcase };
}

// Older instances send no access summary: show everything, the API still guards each route.
export function allowsTab(access: AppAccess | null, route: string): boolean {
  if (!access?.tabs) return true;
  return access.tabs.includes(route);
}
