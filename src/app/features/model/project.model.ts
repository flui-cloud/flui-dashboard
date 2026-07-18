export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
}

export interface ProjectOption {
  slug: string;
  name: string;
}

export const PROJECT_PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
] as const;

export const PROJECT_FALLBACK_COLOR = '#9ca3af';
