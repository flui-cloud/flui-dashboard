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
