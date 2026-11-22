import { Component, computed, input, signal } from '@angular/core';
import { FlTag } from '../../../ui/primitives/tag';
import { EvidenceDto } from '../../../core/api/model/evidenceDto';
import { evidenceHref } from './repo-map-view';

@Component({
  selector: 'app-citation-chip',
  imports: [FlTag],
  host: { class: 'inline-flex flex-col gap-1 whitespace-normal' },
  template: `
    @if (evidence().length > 0) {
      <span class="inline-flex flex-wrap items-center gap-1">
        @if (baseUrl(); as base) {
          <a
            class="fl-tag font-mono hover:text-fl-ink"
            [href]="href(base, evidence()[0])"
            target="_blank"
            rel="noopener"
            [attr.title]="evidence()[0].excerpt || null"
            >{{ headText() }}</a
          >
          @if (evidence().length > 1) {
            <button
              type="button"
              class="fl-tag font-mono cursor-pointer hover:text-fl-ink"
              [attr.aria-expanded]="expanded()"
              [attr.aria-label]="'Show ' + (evidence().length - 1) + ' more citations'"
              (click)="expanded.set(!expanded())"
            >
              +{{ evidence().length - 1 }}
            </button>
          }
        } @else {
          <button
            type="button"
            class="fl-tag font-mono cursor-pointer hover:text-fl-ink"
            [attr.aria-expanded]="expanded()"
            (click)="expanded.set(!expanded())"
          >
            {{ citeText() }}
          </button>
        }
      </span>
      @if (expanded()) {
        <ul class="flex flex-col gap-1">
          @for (e of evidence(); track $index) {
            <li class="fl-mono text-fl-caption text-fl-ink-secondary">
              @if (baseUrl(); as base) {
                <a class="fl-link" [href]="href(base, e)" target="_blank" rel="noopener">{{
                  locate(e)
                }}</a>
              } @else {
                {{ locate(e) }}
              }
              @if (e.excerpt) {
                <span class="text-fl-ink-muted">{{ e.excerpt }}</span>
              }
            </li>
          }
        </ul>
      }
    } @else if (fallback()) {
      <fl-tag class="font-mono">{{ fallback() }}</fl-tag>
    }
  `,
})
export class CitationChipComponent {
  readonly evidence = input<EvidenceDto[]>([]);
  readonly fallback = input<string | undefined>(undefined);
  readonly baseUrl = input<string | null>(null);

  readonly expanded = signal(false);

  readonly headText = computed(() => {
    const first = this.evidence()[0];
    return first ? this.locate(first) : '';
  });

  readonly citeText = computed(() => {
    const list = this.evidence();
    if (list.length === 0) return '';
    const head = this.locate(list[0]);
    return list.length > 1 ? `${head} +${list.length - 1}` : head;
  });

  protected locate(e: EvidenceDto): string {
    return e.line ? `${e.file}:${e.line}` : e.file;
  }

  protected href(base: string, e: EvidenceDto): string {
    return evidenceHref(base, e);
  }
}
