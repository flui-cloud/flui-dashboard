import { Component, OnInit, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucidePackage,
  lucideTriangleAlert,
  lucideChevronDown,
  lucideCheck,
} from '@ng-icons/lucide';
import { RepositoryAnalysisDto } from '../../../core/api/model/repositoryAnalysisDto';

const SUPPORTED_FRAMEWORKS = [
  { value: 'nextjs', label: 'Next.js', group: 'Frontend' },
  { value: 'nuxt', label: 'Nuxt.js', group: 'Frontend' },
  { value: 'svelte-kit', label: 'SvelteKit', group: 'Frontend' },
  { value: 'angular', label: 'Angular', group: 'Frontend' },
  { value: 'nestjs', label: 'NestJS', group: 'Backend Node' },
  { value: 'express', label: 'Express', group: 'Backend Node' },
  { value: 'django', label: 'Django', group: 'Backend Python' },
  { value: 'fastapi', label: 'FastAPI', group: 'Backend Python' },
  { value: 'spring-boot', label: 'Spring Boot', group: 'Backend JVM' },
  { value: 'aspnet-core', label: 'ASP.NET Core', group: 'Backend .NET' },
];

@Component({
  selector: 'app-build-path-selector',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({ lucideGithub, lucidePackage, lucideTriangleAlert, lucideChevronDown, lucideCheck }),
  ],
  template: `
    <div class="space-y-6">
      <!-- Framework Detection Result -->
      @if (analysisResult()) {
        @let analysis = analysisResult()!;

        <!-- Unsupported warning -->
        @if (!analysis.supported) {
          <div class="flex items-start gap-2 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 text-sm text-yellow-800 dark:text-yellow-300">
            <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
            <span>The detected framework is not yet fully supported. You can still proceed by selecting a build path manually.</span>
          </div>
        }

        <!-- Framework row -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm text-muted-foreground">Detected framework:</span>
          <div class="relative">
            <select
              [value]="confirmedFramework()"
              (change)="onFrameworkChange($event)"
              class="h-8 pl-3 pr-8 rounded-md border border-border bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option [value]="analysis.detection.framework">
                {{ formatFrameworkLabel(analysis.detection.framework) }}
                {{ analysis.detection.version ? '(' + analysis.detection.version + ')' : '' }} ← detected
              </option>
              @for (alt of analysis.alternatives; track alt) {
                @if (alt !== analysis.detection.framework) {
                  <option [value]="alt">{{ formatFrameworkLabel(alt) }}</option>
                }
              }
              <optgroup label="── Other ──">
                @for (fw of otherFrameworks(); track fw.value) {
                  <option [value]="fw.value">{{ fw.label }}</option>
                }
              </optgroup>
            </select>
            <ng-icon name="lucideChevronDown" class="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <!-- Build path cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- GitHub Actions card -->
          <button
            type="button"
            (click)="selectPath('github-actions')"
            [class]="getCardClass('github-actions')"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideGithub" class="h-5 w-5" />
                <span class="font-semibold">GitHub Actions</span>
              </div>
              <div class="flex flex-col items-end gap-1">
                @if (analysis.recommended === 'github-actions') {
                  <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Recommended</span>
                }
                <span [class]="getScoreBadgeClass(analysis.scores.githubActions)">
                  {{ analysis.scores.githubActions }}/100
                </span>
              </div>
            </div>
            <p class="text-sm text-left text-muted-foreground">
              Flui generates a workflow and commits it to your repo. GitHub Actions builds the image and pushes it to the registry.
            </p>
            @if (selectedPath() === 'github-actions') {
              <div class="absolute top-2 right-2">
                <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
              </div>
            }
          </button>

          <!-- Railpack card -->
          <button
            type="button"
            (click)="selectPath('railpack')"
            [class]="getCardClass('railpack')"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <ng-icon name="lucidePackage" class="h-5 w-5" />
                <span class="font-semibold">Railpack</span>
              </div>
              <div class="flex flex-col items-end gap-1">
                @if (analysis.recommended === 'railpack') {
                  <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Recommended</span>
                }
                <span [class]="getScoreBadgeClass(analysis.scores.railpack )">
                  {{ analysis.scores.railpack }}/100
                </span>
              </div>
            </div>
            <p class="text-sm text-left text-muted-foreground">
              Build directly on the Flui cluster using Railpack and BuildKit. No GitHub Actions workflow needed.
            </p>
            @if (selectedPath() === 'railpack') {
              <div class="absolute top-2 right-2">
                <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
              </div>
            }
          </button>
        </div>

        <!-- Score legend -->
        <div class="flex items-center gap-4 text-xs text-muted-foreground">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            ≥ 80 Reliable
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
            50–79 Partial
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
            &lt; 50 Not recommended
          </div>
        </div>
      }

      <!-- Loading state -->
      @if (isLoading()) {
        <div class="space-y-3">
          <div class="h-4 w-1/3 rounded bg-muted animate-pulse"></div>
          <div class="grid grid-cols-2 gap-4">
            <div class="h-32 rounded-lg bg-muted animate-pulse"></div>
            <div class="h-32 rounded-lg bg-muted animate-pulse"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BuildPathSelectorComponent implements OnInit {
  analysisResult = input<RepositoryAnalysisDto | null>(null);
  isLoading = input<boolean>(false);
  initialFramework = input<string>('');

  pathSelected = output<'github-actions' | 'railpack'>();
  frameworkCorrected = output<string>();

  selectedPath = signal<'github-actions' | 'railpack' | null>(null);
  confirmedFramework = signal<string>('');

  readonly otherFrameworks = computed(() => {
    const analysis = this.analysisResult();
    const detected = analysis?.detection?.framework ?? '';
    const alternatives = analysis?.alternatives ?? [];
    return SUPPORTED_FRAMEWORKS.filter(
      fw => fw.value !== detected && !alternatives.includes(fw.value)
    );
  });

  ngOnInit(): void {
    const analysis = this.analysisResult();
    if (analysis) {
      this.confirmedFramework.set(analysis.detection?.framework ?? this.initialFramework());
      if (analysis.recommended === 'github-actions' || analysis.recommended === 'railpack') {
        this.selectedPath.set(analysis.recommended);
      }
    }
  }

  selectPath(path: 'github-actions' | 'railpack'): void {
    this.selectedPath.set(path);
    this.pathSelected.emit(path);
  }

  onFrameworkChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.confirmedFramework.set(value);
    this.frameworkCorrected.emit(value);
  }

  formatFrameworkLabel(fw: string): string {
    return SUPPORTED_FRAMEWORKS.find(f => f.value === fw)?.label ?? fw;
  }

  getScoreBadgeClass(score: number): string {
    const base = 'text-xs font-medium px-1.5 py-0.5 rounded';
    if (score >= 80) return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`;
    if (score >= 50) return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`;
    return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
  }

  getCardClass(path: 'github-actions' | 'railpack'): string {
    const isSelected = this.selectedPath() === path;
    const base = 'relative flex flex-col p-4 rounded-lg border-2 text-left transition-all';
    if (isSelected) return `${base} border-primary bg-primary/5`;
    return `${base} border-border hover:border-primary/50 hover:bg-accent/30 cursor-pointer`;
  }
}
