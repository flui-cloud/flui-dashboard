import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideFileText } from '@ng-icons/lucide';
import { EvidenceDto } from '../../../core/api/model/evidenceDto';

/**
 * Renders the file:line a fact came from, and — one click away — the exact
 * excerpt that was read. `evidence` is the ground truth (file/line/excerpt);
 * `fallback` is used only for the DTOs that carry a citation as a plain
 * sentence instead (`DetectedNumberDto`/`DetectedStringDto`.source).
 */
@Component({
  selector: 'app-citation-chip',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (evidence().length > 0) {
      <button
        type="button"
        (click)="expanded.set(!expanded())"
        class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
      >
        <ng-icon name="lucideFileText" class="h-3 w-3" />
        {{ citeText() }}
      </button>
      @if (expanded()) {
        <div class="mt-1 space-y-1">
          @for (e of evidence(); track $index) {
            <div class="rounded bg-slate-100 dark:bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {{ e.file }}{{ e.line ? ':' + e.line : '' }}
              @if (e.excerpt) {
                <span class="text-slate-500 dark:text-slate-500"> — {{ e.excerpt }}</span>
              }
            </div>
          }
        </div>
      }
    } @else if (fallback()) {
      <span class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
        <ng-icon name="lucideFileText" class="h-3 w-3" />
        {{ fallback() }}
      </span>
    }
  `,
})
export class CitationChipComponent {
  readonly evidence = input<EvidenceDto[]>([]);
  readonly fallback = input<string | undefined>(undefined);

  readonly expanded = signal(false);

  readonly citeText = computed(() => {
    const list = this.evidence();
    if (list.length === 0) return '';
    const first = list[0];
    const head = first.line ? `${first.file}:${first.line}` : first.file;
    return list.length > 1 ? `${head} +${list.length - 1}` : head;
  });
}
