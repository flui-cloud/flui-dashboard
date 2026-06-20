import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlay,
  lucideRotateCcw,
  lucideSlidersHorizontal,
} from '@ng-icons/lucide';
import { DocumentField } from '../../model/document-console.models';
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [FormsModule, NgIcon, DocumentFilterEditorComponent],
  providers: [provideIcons({ lucidePlay, lucideRotateCcw, lucideSlidersHorizontal })],
  template: `
    <div class="rounded-lg border border-border bg-card">
      <div class="flex items-center gap-2 p-2">
        <span class="shrink-0 pl-1 font-mono text-xs text-muted-foreground">Filter</span>
        <app-document-filter-editor
          [fields]="fields()"
          [disabled]="disabled()"
          (run)="emit()"
        />
        <button
          type="button"
          (click)="showOptions.set(!showOptions())"
          [class.bg-muted]="showOptions()"
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Project, sort"
        >
          <ng-icon name="lucideSlidersHorizontal" class="h-3.5 w-3.5" /> Options
        </button>
        <button
          type="button"
          (click)="reset()"
          [disabled]="disabled()"
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
          title="Reset"
        >
          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          (click)="emit()"
          [disabled]="disabled() || running()"
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <ng-icon name="lucidePlay" class="h-3 w-3" /> {{ running() ? 'Finding…' : 'Find' }}
        </button>
      </div>

      @if (showOptions()) {
        <div class="grid grid-cols-1 gap-2 border-t border-border p-2 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[11px] text-muted-foreground">Project</span>
            <input
              [(ngModel)]="projectionText"
              (keydown.enter)="emit()"
              [disabled]="disabled()"
              spellcheck="false"
              placeholder='{ name: 1, _id: 0 }'
              class="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[11px] text-muted-foreground">Sort</span>
            <input
              [(ngModel)]="sortText"
              (keydown.enter)="emit()"
              [disabled]="disabled()"
              spellcheck="false"
              placeholder='{ createdAt: -1 }'
              class="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
        </div>
      }
    </div>
  `,
})
export class DocumentQueryBarComponent {
  readonly disabled = input(false);
  readonly running = input(false);
  readonly fields = input<DocumentField[]>([]);

  @Output() readonly find = new EventEmitter<DocQuery>();

  @ViewChild(DocumentFilterEditorComponent)
  private readonly editor?: DocumentFilterEditorComponent;

  protected readonly showOptions = signal(false);

  projectionText = '';
  sortText = '';

  emit(): void {
    if (this.disabled()) return;
    this.find.emit({
      filterText: this.editor?.text() ?? '',
      projectionText: this.projectionText,
      sortText: this.sortText,
    });
  }

  /** Load a query into the bar and run it (used when the assistant routes a find here). */
  setQuery(filterText: string, projectionText: string, sortText: string): void {
    this.editor?.setText(filterText);
    this.projectionText = projectionText;
    this.sortText = sortText;
    if (projectionText || sortText) this.showOptions.set(true);
    this.emit();
  }

  reset(): void {
    this.editor?.setText('');
    this.projectionText = '';
    this.sortText = '';
    this.emit();
  }
}
