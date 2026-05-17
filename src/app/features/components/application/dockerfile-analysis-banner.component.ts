import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideTriangleAlert, lucideLayers } from '@ng-icons/lucide';
import { DockerfileAnalysisDto } from '../../../core/api/model/dockerfileAnalysisDto';

const RUNTIME_ICONS: Record<string, string> = {
  node: 'Node.js', python: 'Python', java: 'Java', dotnet: '.NET',
  ruby: 'Ruby', go: 'Go', php: 'PHP', rust: 'Rust',
};

@Component({
  selector: 'app-dockerfile-analysis-banner',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ lucideCircleCheck, lucideTriangleAlert, lucideLayers })],
  template: `
    @if (analysis(); as da) {
      <div class="p-3 rounded-lg border border-border bg-card space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          @if (da.isFluiManaged) {
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <ng-icon name="lucideCircleCheck" class="h-3 w-3" /> Flui Ready
            </span>
          } @else {
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <ng-icon name="lucideTriangleAlert" class="h-3 w-3" /> Custom Dockerfile
            </span>
          }
          @if (da.port) {
            <span class="text-xs text-muted-foreground">Port: {{ da.port }}</span>
          }
          @if (da.baseRuntime) {
            <span class="text-xs text-muted-foreground">Runtime: {{ getRuntimeLabel(da.baseRuntime) }}</span>
          }
          @if (da.hasMultiStage) {
            <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ng-icon name="lucideLayers" class="h-3 w-3" /> Multi-stage
            </span>
          }
        </div>
        @if (!da.isFluiManaged) {
          <p class="text-xs text-amber-700 dark:text-amber-400">
            Add <code class="font-mono bg-muted px-1 rounded">#flui-managed</code> to your Dockerfile to indicate it's managed with Flui.
          </p>
        }
      </div>
    }
  `,
})
export class DockerfileAnalysisBannerComponent {
  analysis = input<DockerfileAnalysisDto | null>(null);

  getRuntimeLabel(runtime: string): string {
    return RUNTIME_ICONS[runtime.toLowerCase()] ?? runtime;
  }
}
