import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  signal,
  viewChild,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentField } from '../../model/document-console.models';

interface CmView {
  state: { doc: { toString(): string; length: number } };
  dispatch(tx: unknown): void;
  focus(): void;
  destroy(): void;
}

const OPERATORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$options',
  '$type',
  '$all',
  '$size',
  '$elemMatch',
  '$mod',
  '$and',
  '$or',
  '$nor',
  '$not',
].map((label) => ({ label, type: 'keyword' as const }));

/**
 * Compass-style filter editor: a one-line CodeMirror input with structure-aware
 * autocomplete. Field paths come from the sampled collection schema (`fields`);
 * after `:` it offers BSON constructors, and a `$`-prefixed word offers operators.
 * Falls back to a plain input if CodeMirror can't load. Read the value via text().
 */
@Component({
  selector: 'app-document-filter-editor',
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div
      #host
      [hidden]="!ready()"
      class="min-w-0 flex-1 overflow-x-auto rounded-fl-md border border-fl-border-input bg-fl-surface font-mono text-fl-mono-sm focus-within:border-fl-accent"
    ></div>
    @if (!ready()) {
      <input
        #fallback
        [(ngModel)]="fallbackText"
        (keydown.enter)="run.emit()"
        [disabled]="disabled()"
        spellcheck="false"
        placeholder='{ field: "value" }  ·  { _id: ObjectId("…") }'
        aria-label="Filter"
        class="min-w-0 flex-1 rounded-fl-md border border-fl-border-input bg-fl-surface px-2 py-1.5 font-mono text-fl-mono-sm text-fl-ink outline-none focus:border-fl-accent disabled:opacity-50"
      />
    }
  `,
})
export class DocumentFilterEditorComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly fields = input<DocumentField[]>([]);
  readonly disabled = input(false);

  readonly run = output<void>();

  readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly ready = signal(false);
  fallbackText = '';

  private view: CmView | null = null;

  text(): string {
    return this.view ? String(this.view.state.doc.toString()) : this.fallbackText;
  }

  setText(t: string): void {
    this.fallbackText = t;
    if (this.view) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: t },
      });
    }
  }

  ngAfterViewInit(): void {
    void this.mount();
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }

  private async mount(): Promise<void> {
    try {
      const [{ EditorState, Prec }, view, { javascript }, ac, { minimalSetup }, highlight] =
        await Promise.all([
          import('@codemirror/state'),
          import('@codemirror/view'),
          import('@codemirror/lang-javascript'),
          import('@codemirror/autocomplete'),
          import('codemirror'),
          import('./cm-highlight').then((m) => m.fluiHighlighting()),
        ]);
      const { EditorView, keymap } = view;
      const {
        autocompletion,
        completionKeymap,
        completionStatus,
        closeBrackets,
        snippetCompletion,
      } = ac;
      const compStatus = completionStatus as (s: unknown) => string | null;

      const ctors = [
        snippetCompletion("ObjectId('${}')", { label: 'ObjectId()', type: 'function' }),
        snippetCompletion("ISODate('${}')", { label: 'ISODate()', type: 'function' }),
        snippetCompletion("NumberDecimal('${}')", { label: 'NumberDecimal()', type: 'function' }),
        snippetCompletion("NumberLong('${}')", { label: 'NumberLong()', type: 'function' }),
        snippetCompletion("NumberInt('${}')", { label: 'NumberInt()', type: 'function' }),
      ];

      const complete = (context: {
        pos: number;
        explicit: boolean;
        matchBefore: (re: RegExp) => { from: number; to: number; text: string } | null;
        state: { sliceDoc: (from: number, to: number) => string };
      }) => {
        const word = context.matchBefore(/[$\w.]*/);
        const typed = word?.text ?? '';
        const head = context.state.sliceDoc(0, word ? word.from : context.pos).trimEnd();
        const last = head.at(-1) ?? '';
        let options: { label: string; type?: string; detail?: string }[];
        if (typed.startsWith('$')) {
          options = OPERATORS;
        } else if (last === ':') {
          options = ctors;
        } else if (last === '' || last === '{' || last === ',' || context.explicit) {
          options = this.fields().map((f) => ({
            label: f.path,
            type: 'property',
            detail: f.types.join(' | '),
          }));
        } else {
          return null;
        }
        if (!options.length) return null;
        return {
          from: word ? word.from : context.pos,
          options,
          validFor: /^[$\w.]*$/,
        };
      };

      const runKeys = Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              this.zone.run(() => this.run.emit());
              return true;
            },
          },
          {
            key: 'Enter',
            run: (v: { state: unknown }) => {
              if (compStatus(v.state) === 'active') return false;
              this.zone.run(() => this.run.emit());
              return true;
            },
          },
        ]),
      );

      const sync = EditorView.updateListener.of(
        (u: { docChanged: boolean; state: { doc: { toString(): string } } }) => {
          if (u.docChanged) this.fallbackText = u.state.doc.toString();
        },
      );

      const ev = new EditorView({
        state: EditorState.create({
          doc: this.fallbackText,
          extensions: [
            minimalSetup,
            highlight,
            javascript(),
            closeBrackets(),
            autocompletion({ override: [complete], activateOnTyping: true, icons: false }),
            keymap.of(completionKeymap),
            runKeys,
            sync,
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ 'aria-label': 'Filter' }),
            EditorView.theme({
              '&': { backgroundColor: 'transparent', color: 'var(--fl-ink)' },
              '&.cm-focused': { outline: 'none' },
              '.cm-scroller': { fontFamily: 'var(--fl-font-mono)' },
              '.cm-content': {
                padding: '6px 8px',
                caretColor: 'var(--fl-ink)',
                fontFamily: 'var(--fl-font-mono)',
              },
              '.cm-line': { padding: '0' },
              '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fl-ink)' },
              '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--fl-ink)' },
              '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
                backgroundColor: 'var(--fl-accent-soft)',
              },
            }),
          ],
        }),
        parent: this.host().nativeElement,
      });
      this.view = ev as unknown as CmView;
      this.ready.set(true);
    } catch {
      this.ready.set(false);
    }
  }
}
