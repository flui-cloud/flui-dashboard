import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader,
  lucideX,
  lucideTriangleAlert,
  lucideInfo,
  lucideLock,
  lucideEye,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { EnvVarCandidateDto } from '../../../core/api/model/envVarCandidateDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';

@Component({
  selector: 'app-env-suggestions-panel',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideLoader,
      lucideX,
      lucideTriangleAlert,
      lucideInfo,
      lucideLock,
      lucideEye,
      lucideRefreshCw,
    }),
  ],
  template: `
    <!-- Loading state -->
    @if (loading()) {
      <div class="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin shrink-0" />
          <span>Analyzing repository for environment variables...</span>
        </div>
        <button
          type="button"
          (click)="cancelDetection.emit()"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0"
        >
          <ng-icon name="lucideX" class="h-3.5 w-3.5" />
          Stop
        </button>
      </div>
    }

    <!-- Error state -->
    @if (!loading() && error()) {
      <div class="flex items-start justify-between gap-2 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 text-sm text-yellow-800 dark:text-yellow-300">
        <div class="flex items-start gap-2">
          <ng-icon name="lucideInfo" class="h-4 w-4 shrink-0 mt-0.5" />
          <span>{{ error() }} Configure variables manually below.</span>
        </div>
        <button
          type="button"
          (click)="reanalyze.emit()"
          class="inline-flex items-center gap-1 text-xs shrink-0 hover:opacity-80 transition-opacity"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    }

    <!-- Results -->
    @if (!loading() && !error() && result()) {
      @let r = result()!;

      <!-- Re-analyze button -->
      <div class="flex justify-end">
        <button
          type="button"
          (click)="reanalyze.emit()"
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
          Re-analyze
        </button>
      </div>

      <!-- Fallback warning -->
      @if (r.isFallback) {
        <div class="flex items-start gap-2 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 text-sm text-yellow-800 dark:text-yellow-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
          <span>List detected automatically from base configuration — may be incomplete. Verify before proceeding.</span>
        </div>
      }

      <!-- No candidates -->
      @if (r.candidates.length === 0 && !r.isFallback) {
        <div class="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
          <ng-icon name="lucideInfo" class="h-4 w-4 shrink-0" />
          <span>No environment variable files detected. Add variables manually below.</span>
        </div>
      }

      <!-- Source selector (>1 candidates) -->
      @if (r.candidates.length > 1) {
        <div class="space-y-2">
          <label class="text-sm font-medium block">Detected source</label>
          <div class="flex flex-wrap gap-2">
            @for (candidate of r.candidates; track candidate.sourceFile; let i = $index) {
              <button
                type="button"
                (click)="candidateSelected.emit(i)"
                [class]="getCandidateButtonClass(i)"
              >
                <span class="font-mono text-xs">{{ candidate.sourceFile }}</span>
                @if (i === 0) {
                  <span class="ml-1.5 text-xs opacity-60">(recommended)</span>
                }
                @if (candidate.sourceFrameworkHint) {
                  <span class="ml-1.5 px-1 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {{ candidate.sourceFrameworkHint }}
                  </span>
                }
              </button>
            }
          </div>
        </div>
      }

      <!-- Single candidate: show source label -->
      @if (r.candidates.length === 1) {
        @let c = r.candidates[0];
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <ng-icon name="lucideInfo" class="h-3.5 w-3.5 shrink-0" />
          <span>
            Variables pre-filled from
            <span class="font-mono">{{ c.sourceFile }}</span>
            @if (c.detectedPattern) {
              <span class="ml-1">(pattern: <span class="font-mono">{{ c.detectedPattern }}</span>)</span>
            }
          </span>
          @if (c.sourceFrameworkHint) {
            <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-mono">
              {{ c.sourceFrameworkHint }}
            </span>
          }
        </div>
      }

      <!-- ReadOnly vars (Dockerfile hardcoded) -->
      @let readOnlyVars = getReadOnlyVars(r.candidates[selectedIndex()]);
      @if (readOnlyVars.length > 0) {
        <div class="space-y-2">
          <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ng-icon name="lucideEye" class="h-3.5 w-3.5" />
            Hardcoded in Dockerfile (read-only)
          </div>
          <div class="rounded-md border border-border bg-muted/20 divide-y divide-border">
            @for (v of readOnlyVars; track v.name) {
              <div class="flex items-center gap-3 px-3 py-2 text-sm opacity-70">
                <span class="font-mono text-xs w-1/3 shrink-0 truncate">{{ v.name }}</span>
                <span class="flex-1 font-mono text-xs text-muted-foreground truncate">
                  {{ v.defaultValue ?? '(not set)' }}
                </span>
                @if (v.sensitive) {
                  <ng-icon name="lucideLock" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                <span class="shrink-0 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Fixed</span>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class EnvSuggestionsPanelComponent {
  loading = input.required<boolean>();
  result = input<EnvVarDetectionResultDto | null>(null);
  error = input<string | null>(null);
  selectedIndex = input<number>(0);

  cancelDetection = output<void>();
  candidateSelected = output<number>();
  reanalyze = output<void>();

  getReadOnlyVars(candidate: EnvVarCandidateDto | undefined): DetectedEnvVarDto[] {
    if (!candidate) return [];
    return candidate.vars.filter(v => v.readOnly);
  }

  getCandidateButtonClass(index: number): string {
    const base = 'flex items-center px-3 py-1.5 rounded-md border text-sm transition-colors';
    return index === this.selectedIndex()
      ? `${base} border-primary bg-primary/10 text-foreground`
      : `${base} border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground`;
  }
}
