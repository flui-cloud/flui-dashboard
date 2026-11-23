import { Component, input, signal, viewChild, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlay, lucideRotateCcw, lucideSlidersHorizontal } from '@ng-icons/lucide';
import { DocumentField } from '../../model/document-console.models';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { DocumentFilterEditorComponent } from './document-filter-editor.component';

/** A find query as typed in the bar — raw mongosh-syntax text; parsed server-side. */
export interface DocQuery {
  filterText: string;
  projectionText: string;
  sortText: string;
}

/**
 * Compass-style query bar: the input is ONLY the find filter (with structure-aware
 * autocomplete from the sampled schema) plus Project/Sort behind a toggle. It never
 * mutates data — writes belong to the mongo shell. Paging (20/page) is handled by the
 * result list. Emits raw text; the backend parses mongosh syntax (ObjectId(), …).
 */
@Component({
  selector: 'app-document-query-bar',
  host: { class: 'contents' },
  imports: [FormsModule, FlField, FlButton, FlIcon, DocumentFilterEditorComponent],
  providers: [provideIcons({ lucidePlay, lucideRotateCcw, lucideSlidersHorizontal })],
  template: `
    <div class="fl-panel" role="search" aria-label="Find documents">
      <div class="flex items-center gap-2 px-4 py-3">
        <span class="shrink-0 font-mono text-fl-mono-sm text-fl-ink-muted">Filter</span>
        <app-document-filter-editor [fields]="fields()" [disabled]="disabled()" (run)="emit()" />
        <button
          flButton
          size="sm"
          type="button"
          (click)="showOptions.set(!showOptions())"
          [attr.aria-pressed]="showOptions()"
          [class.bg-fl-accent-soft]="showOptions()"
          title="Project and sort"
        >
          <fl-icon name="lucideSlidersHorizontal" [size]="14" /> Options
        </button>
        <button
          flButton="ghost"
          size="sm"
          [iconOnly]="true"
          type="button"
          (click)="reset()"
          [disabled]="disabled()"
          aria-label="Reset query"
          title="Reset query"
        >
          <fl-icon name="lucideRotateCcw" [size]="14" />
        </button>
        <button
          flButton="primary"
          size="sm"
          type="button"
          (click)="emit()"
          [disabled]="disabled() || running()"
        >
          <fl-icon name="lucidePlay" [size]="14" /> {{ running() ? 'Finding' : 'Find' }}
        </button>
      </div>

      @if (showOptions()) {
        <div class="grid grid-cols-1 gap-3 border-t border-fl-border px-4 py-3 sm:grid-cols-2">
          <fl-field label="Project" for="doc-query-projection">
            <span class="fl-input">
              <input
                id="doc-query-projection"
                class="font-mono"
                [(ngModel)]="projectionText"
                (keydown.enter)="emit()"
                [disabled]="disabled()"
                spellcheck="false"
                placeholder="{ name: 1, _id: 0 }"
              />
            </span>
          </fl-field>
          <fl-field label="Sort" for="doc-query-sort">
            <span class="fl-input">
              <input
                id="doc-query-sort"
                class="font-mono"
                [(ngModel)]="sortText"
                (keydown.enter)="emit()"
                [disabled]="disabled()"
                spellcheck="false"
                placeholder="{ createdAt: -1 }"
              />
            </span>
          </fl-field>
        </div>
      }
    </div>
  `,
})
export class DocumentQueryBarComponent {
  readonly disabled = input(false);
  readonly running = input(false);
  readonly fields = input<DocumentField[]>([]);

  readonly find = output<DocQuery>();

  private readonly editor = viewChild(DocumentFilterEditorComponent);

  protected readonly showOptions = signal(false);

  projectionText = '';
  sortText = '';

  emit(): void {
    if (this.disabled()) return;
    this.find.emit({
      filterText: this.editor()?.text() ?? '',
      projectionText: this.projectionText,
      sortText: this.sortText,
    });
  }

  setQuery(filterText: string, projectionText: string, sortText: string): void {
    this.editor()?.setText(filterText);
    this.projectionText = projectionText;
    this.sortText = sortText;
    if (projectionText || sortText) this.showOptions.set(true);
    this.emit();
  }

  reset(): void {
    this.editor()?.setText('');
    this.projectionText = '';
    this.sortText = '';
    this.emit();
  }
}
