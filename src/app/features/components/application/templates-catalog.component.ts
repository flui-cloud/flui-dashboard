import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideLoader,
  lucideSearch,
  lucideGitBranch,
  lucideServer,
  lucideArrowRight,
  lucidePackage,
  lucideRocket,
} from '@ng-icons/lucide';

import {
  siNextdotjs,
  siNuxt,
  siAngular,
  siSvelte,
  siNestjs,
  siSpringboot,
  siDjango,
  siFastapi,
  siDotnet,
  siAstro,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

import { TemplateService } from '../../service/template.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';

/**
 * UI category taxonomy. `generic` is a Flui-only category we surface in the UI
 * to group the bare-bones "generic" template that doesn't belong to a
 * frontend/backend bucket. `static` from the API is intentionally dropped
 * (no templates are currently classified that way).
 */
type Category = 'frontend' | 'backend' | 'fullstack' | 'generic';

interface FrameworkMeta {
  icon: SimpleIcon | null;  // null → fallback to generic package icon
  /** Tailwind text color classes for the icon. Uses currentColor in the SVG. */
  colorClass: string;
}

/**
 * Maps API framework identifier → simple-icons brand icon + colorClass.
 * Add new entries here when the API exposes new templates.
 */
const FRAMEWORK_META: Record<string, FrameworkMeta> = {
  nextjs:        { icon: siNextdotjs,  colorClass: 'text-black dark:text-white' },
  nuxt:          { icon: siNuxt,       colorClass: 'text-[#00DC82]' },
  angular:       { icon: siAngular,    colorClass: 'text-[#DD0031] dark:text-[#FF4081]' },
  // SvelteKit — accept both kebab-case and one-word variants from the API
  'svelte-kit':  { icon: siSvelte,     colorClass: 'text-[#FF3E00]' },
  sveltekit:     { icon: siSvelte,     colorClass: 'text-[#FF3E00]' },
  svelte:        { icon: siSvelte,     colorClass: 'text-[#FF3E00]' },
  nestjs:        { icon: siNestjs,     colorClass: 'text-[#E0234E]' },
  'spring-boot': { icon: siSpringboot, colorClass: 'text-[#6DB33F]' },
  springboot:    { icon: siSpringboot, colorClass: 'text-[#6DB33F]' },
  django:        { icon: siDjango,     colorClass: 'text-[#092E20] dark:text-[#44B78B]' },
  fastapi:       { icon: siFastapi,    colorClass: 'text-[#009688]' },
  'aspnet-core': { icon: siDotnet,     colorClass: 'text-[#512BD4] dark:text-[#9B7BFF]' },
  aspnetcore:    { icon: siDotnet,     colorClass: 'text-[#512BD4] dark:text-[#9B7BFF]' },
  dotnet:        { icon: siDotnet,     colorClass: 'text-[#512BD4] dark:text-[#9B7BFF]' },
  astro:         { icon: siAstro,      colorClass: 'text-black dark:text-white' },
  generic:       { icon: null,         colorClass: 'text-slate-600 dark:text-white' },
};

/**
 * Framework → category override. The API classifies SSR meta-frameworks like
 * Next.js/Nuxt/SvelteKit as "fullstack", but in the UI we want them grouped
 * under Frontend (that's how users look for them). This map shadows
 * `template.category` from the API for both filtering and the badge label.
 * Frameworks not listed here fall back to the API-provided category.
 */
const CATEGORY_OVERRIDES: Record<string, Category> = {
  nextjs:       'frontend',
  nuxt:         'frontend',
  angular:      'frontend',
  'svelte-kit': 'frontend',
  sveltekit:    'frontend',
  svelte:       'frontend',
  astro:        'frontend',
  // The "generic" template is a bare Dockerfile catch-all — it belongs to
  // neither Frontend nor Backend, so it lives under its own Generic category.
  generic:      'generic',
};

const CATEGORY_LABELS: Record<Category, { label: string; class: string }> = {
  frontend:  { label: 'Frontend',   class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  backend:   { label: 'Backend',    class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  fullstack: { label: 'Full-stack', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  generic:   { label: 'Generic',    class: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' },
};

const TEMPLATE_REPO_BASE = 'https://github.com/flui-cloud';

@Component({
  selector: 'app-templates-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideRefreshCw, lucideLoader, lucideSearch, lucideGitBranch,
      lucideServer, lucideArrowRight, lucidePackage, lucideRocket,
    }),
  ],
  template: `
    <div class="space-y-6 p-6 max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Flui Templates</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Grab a production-ready Dockerfile for your framework — fork the repo, add it to your project, and deploy.
          </p>
        </div>
        <button
          (click)="refreshTemplates()"
          [disabled]="isLoading()"
          class="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 text-sm"
        >
          <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="isLoading()" />
          Refresh
        </button>
      </div>

      <!-- Search + Category Filters -->
      <div class="flex items-center gap-3 flex-wrap">
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search frameworks..."
            class="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-sm"
          />
        </div>
        <div class="flex gap-1.5">
          <button (click)="categoryFilter.set('')"          [class]="getCategoryFilterClass('')">All</button>
          <button (click)="categoryFilter.set('frontend')"  [class]="getCategoryFilterClass('frontend')">Frontend</button>
          <button (click)="categoryFilter.set('backend')"   [class]="getCategoryFilterClass('backend')">Backend</button>
          <button (click)="categoryFilter.set('generic')"   [class]="getCategoryFilterClass('generic')">Generic</button>
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex items-center justify-center py-16">
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-primary" />
          <span class="ml-2 text-sm text-muted-foreground">Loading templates...</span>
        </div>
      }

      <!-- Templates Grid -->
      @if (!isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (template of filteredTemplates(); track template.framework) {
            @let meta = getMeta(template.framework);
            @let cat = getCategoryInfo(getCategory(template));
            <div class="group bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 flex flex-col h-full"
                 [class.ring-2]="highlightedFramework() === template.framework"
                 [class.ring-primary]="highlightedFramework() === template.framework">

              <!-- Card Header with brand-colored gradient + icon -->
              <div class="px-5 pt-5 pb-4 relative overflow-hidden">
                <!-- Subtle brand-color background tint -->
                <div class="absolute inset-0 opacity-[0.07] pointer-events-none"
                     [style.background-color]="getBrandColor(template.framework)"></div>

                <div class="relative flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <!-- Framework Icon — uses currentColor + brand-tone colorClass that adapts to dark mode -->
                    <div [class]="'w-11 h-11 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm shrink-0 ' + meta.colorClass"
                         [innerHTML]="getIconSafeHtml(template.framework)">
                    </div>
                    <div>
                      <h3 class="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                        {{ template.displayName }}
                      </h3>
                      <span [class]="'inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ' + cat.class">
                        {{ cat.label }}
                      </span>
                    </div>
                  </div>
                </div>
                <p class="relative text-xs text-muted-foreground mt-3 line-clamp-2">{{ template.description }}</p>
              </div>

              <!-- Card Body -->
              <div class="px-5 py-4 border-t border-border/50 flex flex-col flex-1 gap-3">
                <!-- Tech details as pills -->
                <div class="flex flex-wrap gap-1.5">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/50">
                    <ng-icon name="lucideServer" class="h-3 w-3" />
                    Port {{ template.port }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/50 font-mono">
                    {{ template.healthcheckPath }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/50">
                    {{ template.buildTool }}
                  </span>
                </div>

                <!-- Actions — pinned to bottom of card -->
                <div class="mt-auto space-y-2">
                  <button
                    type="button"
                    (click)="openUseTemplate(template)"
                    [disabled]="!repositoryService.hasRepoScope()"
                    [title]="repositoryService.hasRepoScope() ? '' : disabledTooltip()"
                    class="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border hover:bg-accent transition-all text-xs group/use disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                      <ng-icon name="lucideRocket" class="h-3.5 w-3.5" />
                      Use this template
                    </span>
                    <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover/use:translate-x-0.5" />
                  </button>
                  <a
                    [href]="template.repoUrl || getRepoUrl(template.framework)"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border hover:bg-accent transition-all text-xs group/link"
                  >
                    <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                      <ng-icon name="lucideGitBranch" class="h-3.5 w-3.5" />
                      View on GitHub
                    </span>
                    <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover/link:translate-x-0.5" />
                  </a>
                </div>
              </div>
            </div>
          }
        </div>

        @if (filteredTemplates().length === 0 && !isLoading()) {
          <div class="text-center py-16">
            <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ng-icon name="lucideSearch" class="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 class="font-medium mb-1">No templates found</h3>
            <p class="text-sm text-muted-foreground">Try adjusting your search or filter</p>
          </div>
        }
      }

      <!-- Error -->
      @if (templateService.errorMessage()) {
        <div class="p-3 rounded-md border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          {{ templateService.errorMessage() }}
        </div>
      }
    </div>

  `,
})
export class TemplatesCatalogComponent implements OnInit {
  templateService = inject(TemplateService);
  repositoryService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  searchQuery = signal('');
  categoryFilter = signal<'' | Category>('');
  highlightedFramework = signal<string | null>(null);

  isLoading = this.templateService.loading;

  disabledTooltip = computed(() =>
    this.repositoryService.setupStatus()?.authMethod === 'github_app'
      ? 'Install the Flui GitHub App first'
      : 'Connect GitHub with the repo scope first'
  );

  private readonly iconCache = new Map<string, SafeHtml>();

  filteredTemplates = computed(() => {
    const search = this.searchQuery().toLowerCase();
    const cat = this.categoryFilter();
    let templates = this.templateService.templates();

    if (search) {
      templates = templates.filter(t =>
        t.displayName.toLowerCase().includes(search) ||
        t.framework.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }
    if (cat) {
      templates = templates.filter(t => this.getCategory(t) === cat);
    }
    // Hide deprecated templates by default
    templates = templates.filter(t => !t.isDeprecated);
    return templates;
  });

  /**
   * Returns the effective category for a template:
   *  1. A local override (e.g. Next.js → frontend, generic → generic), or
   *  2. The API-provided category if it's one we surface (frontend/backend/fullstack), or
   *  3. `generic` as a safe fallback for any value we don't have a UI bucket for
   *     (e.g. the API's legacy `static` category, or an unknown framework).
   */
  getCategory(template: TemplateResponseDto): Category {
    const override = CATEGORY_OVERRIDES[template.framework];
    if (override) return override;
    const apiCat = template.category as string;
    if (apiCat === 'frontend' || apiCat === 'backend' || apiCat === 'fullstack') {
      return apiCat;
    }
    return 'generic';
  }

  ngOnInit(): void {
    void (async () => {
      const fw = this.route.snapshot.queryParamMap.get('framework');
      if (fw) this.highlightedFramework.set(fw);
  
      // Load templates, setup/OAuth status, and clusters in parallel — these are independent
      await Promise.allSettled([
        this.loadTemplates(),
        this.repositoryService.checkSetupStatus(),
        this.repositoryService.checkOAuthStatus(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }

  /**
   * Deep-link to the deploy wizard with the template framework as a query param.
   * The wizard picks it up in ngOnInit and starts Flow B pre-seeded with the
   * chosen template. Keeps the catalog as a browse-only experience.
   */
  openUseTemplate(template: TemplateResponseDto): void {
    if (!this.repositoryService.hasRepoScope()) return;
    this.router.navigate(['/apps/deploy/new'], {
      queryParams: { template: template.framework },
    });
  }

  async loadTemplates(): Promise<void> {
    try {
      await this.templateService.loadTemplates();
    } catch {
      // Error stored in service signal
    }
  }

  async refreshTemplates(): Promise<void> {
    await this.loadTemplates();
  }

  getMeta(framework: string): FrameworkMeta {
    return FRAMEWORK_META[framework] ?? FRAMEWORK_META['generic'];
  }

  getCategoryInfo(category: Category): { label: string; class: string } {
    return CATEGORY_LABELS[category];
  }

  getRepoUrl(framework: string): string {
    return `${TEMPLATE_REPO_BASE}/template-${framework}`;
  }

  getBrandColor(framework: string): string {
    const icon = this.getMeta(framework).icon;
    return icon ? `#${icon.hex}` : '#6b7280';
  }

  /**
   * Build a sanitized inline SVG for the framework. Uses `currentColor` so the
   * surrounding container's text color (set per-framework via colorClass) drives
   * the brand color, which lets us adapt for dark mode (e.g. Next.js black → white).
   * Cached per framework to avoid re-sanitization on each render.
   */
  getIconSafeHtml(framework: string): SafeHtml {
    const cached = this.iconCache.get(framework);
    if (cached) return cached;

    const icon = this.getMeta(framework).icon;
    let svg: string;
    if (icon) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-label="${icon.title}">${icon.svg.replaceAll(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
    } else {
      // Fallback: lucide package icon
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
    }

    const safe = this.sanitizer.bypassSecurityTrustHtml(svg);
    this.iconCache.set(framework, safe);
    return safe;
  }

  getCategoryFilterClass(cat: '' | Category): string {
    const base = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors';
    return this.categoryFilter() === cat
      ? `${base} bg-primary text-primary-foreground`
      : `${base} bg-muted text-muted-foreground hover:bg-accent hover:text-foreground`;
  }
}
