import type { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import type { SegmentOption } from '../../../ui/patterns/filter-bar';

export type TemplateCategory = 'frontend' | 'backend' | 'fullstack' | 'generic';

const CATEGORY_OVERRIDES: Record<string, TemplateCategory> = {
  nextjs: 'frontend',
  nuxt: 'frontend',
  angular: 'frontend',
  'svelte-kit': 'frontend',
  sveltekit: 'frontend',
  svelte: 'frontend',
  astro: 'frontend',
  vitepress: 'frontend',
  generic: 'generic',
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Full-stack',
  generic: 'Generic',
};

export const CATEGORY_FILTERS: readonly SegmentOption[] = [
  { value: '', label: 'All' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'generic', label: 'Generic' },
];

const TEMPLATE_REPO_BASE = 'https://github.com/flui-cloud';

export function templateCategory(template: TemplateResponseDto): TemplateCategory {
  const override = CATEGORY_OVERRIDES[template.framework];
  if (override) return override;
  const apiCat = template.category as string;
  if (apiCat === 'frontend' || apiCat === 'backend' || apiCat === 'fullstack') {
    return apiCat;
  }
  return 'generic';
}

export function categoryLabel(category: TemplateCategory): string {
  return CATEGORY_LABELS[category];
}

export function templateRepoUrl(template: TemplateResponseDto): string {
  return template.repoUrl || `${TEMPLATE_REPO_BASE}/template-${template.framework}`;
}

export function filterTemplates(
  templates: TemplateResponseDto[],
  search: string,
  category: '' | TemplateCategory,
): TemplateResponseDto[] {
  const query = search.toLowerCase();
  let rows = templates;
  if (query) {
    rows = rows.filter(
      (t) =>
        t.displayName.toLowerCase().includes(query) ||
        t.framework.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query),
    );
  }
  if (category) {
    rows = rows.filter((t) => templateCategory(t) === category);
  }
  return rows.filter((t) => !t.isDeprecated);
}
