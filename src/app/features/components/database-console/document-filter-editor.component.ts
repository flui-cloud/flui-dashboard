import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentField } from '../../model/document-console.models';

/** Mongo query operators offered at value position (inside `{ field: { … } }`). */
const OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists',
  '$regex', '$options', '$type', '$all', '$size', '$elemMatch', '$mod',
  '$and', '$or', '$nor', '$not',
].map((label) => ({ label, type: 'keyword' as const }));

/**
 * Compass-style filter editor: a one-line CodeMirror input with structure-aware
 * autocomplete. Field paths come from the sampled collection schema (`fields`);
 * after `:` it offers BSON constructors, and a `$`-prefixed word offers operators.
 * Falls back to a plain input if CodeMirror can't load. Read the value via text().
 */
@Component({
  selector: 'app-document-filter-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div
      #host
      [hidden]="!ready()"
      class="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted text-xs"
    ></div>
    @if (!ready()) {
      <input
        #fallback
        [(ngModel)]="fallbackText"
        (keydown.enter)="run.emit()"
        [disabled]="disabled()"
        spellcheck="false"
        placeholder='{ field: "value" }  ·  { _id: ObjectId("…") }'
        class="min-w-0 flex-1 rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs outline-none focus:border-primary disabled:opacity-50"
      />
    }
  `,
})
export class DocumentFilterEditorComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly fields = input<DocumentField[]>([]);
  readonly disabled = input(false);

  @Output() readonly run = new EventEmitter<void>();

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly ready = signal(false);
  fallbackText = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private view: any = null;

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
      const { autocompletion, completionKeymap, completionStatus, closeBrackets, snippetCompletion } =
        ac;
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
        const head = context.state
          .sliceDoc(0, word ? word.from : context.pos)
          .trimEnd();
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

      const sync = EditorView.updateListener.of((u: { docChanged: boolean; state: { doc: { toString(): string } } }) => {
        if (u.docChanged) this.fallbackText = u.state.doc.toString();
      });

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
            EditorView.theme({
              '&': { backgroundColor: 'transparent', color: 'inherit' },
              '&.cm-focused': { outline: 'none' },
              '.cm-content': { padding: '6px 8px', caretColor: 'hsl(var(--foreground))', fontFamily: 'ui-monospace, monospace' },
              '.cm-line': { padding: '0' },
              '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--foreground))' },
              '&.cm-focused .cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
            }),
          ],
        }),
        parent: this.host.nativeElement,
      });
      this.view = ev;
      this.ready.set(true);
    } catch {
      this.ready.set(false);
    }
  }
}
