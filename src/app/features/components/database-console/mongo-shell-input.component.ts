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

interface CmView {
  state: { doc: { toString(): string; length: number } };
  dispatch(tx: unknown): void;
  focus(): void;
  destroy(): void;
}

/**
 * The mongosh shell's input line: a CodeMirror editor (JS highlighting) that runs the
 * statement on Enter (Shift+Enter inserts a newline for multi-line statements) and recalls
 * previous statements with ↑/↓ when the input is single-line — just like a real shell. No
 * eval here; it only emits the typed text. Falls back to a plain input if CodeMirror fails.
 */
@Component({
  selector: 'app-mongo-shell-input',
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div class="flex items-start gap-2">
      <span class="shrink-0 select-none pt-1.5 font-mono text-fl-mono-sm text-fl-accent">{{
        prompt()
      }}</span>
      <div
        #host
        [hidden]="!ready()"
        class="min-w-0 flex-1 overflow-x-auto rounded-fl-md border border-fl-border-input bg-fl-surface font-mono text-fl-mono-sm focus-within:border-fl-accent"
      ></div>
      @if (!ready()) {
        <input
          #fallback
          [(ngModel)]="fallbackText"
          (keydown.enter)="runFallback()"
          [disabled]="disabled()"
          spellcheck="false"
          placeholder="db.collection.find({ … })"
          aria-label="Shell statement"
          class="min-w-0 flex-1 rounded-fl-md border border-fl-border-input bg-fl-surface px-2 py-1.5 font-mono text-fl-mono-sm text-fl-ink outline-none focus:border-fl-accent disabled:opacity-50"
        />
      }
    </div>
  `,
})
export class MongoShellInputComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly prompt = input('>');
  readonly disabled = input(false);

  readonly run = output<string>();

  readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly ready = signal(false);
  fallbackText = '';

  private readonly history: string[] = [];
  private histIndex = -1;

  private view: CmView | null = null;

  setText(t: string): void {
    this.fallbackText = t;
    if (this.view) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: t },
        selection: { anchor: t.length },
      });
      this.view.focus();
    }
  }

  focus(): void {
    this.view?.focus();
  }

  ngAfterViewInit(): void {
    void this.mount();
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }

  runFallback(): void {
    const t = this.fallbackText.trim();
    if (!t || this.disabled()) return;
    this.emit(t);
    this.fallbackText = '';
  }

  private emit(text: string): void {
    this.pushHistory(text);
    this.run.emit(text);
  }

  private pushHistory(text: string): void {
    if (this.history.at(-1) !== text) this.history.push(text);
    if (this.history.length > 100) this.history.shift();
    this.histIndex = -1;
  }

  private runCurrent(): void {
    if (this.disabled() || !this.view) return;
    const text = String(this.view.state.doc.toString()).trim();
    if (!text) return;
    this.zone.run(() => this.emit(text));
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: '' } });
  }

  private recall(dir: -1 | 1): boolean {
    if (!this.history.length || !this.view) return false;
    if (String(this.view.state.doc.toString()).includes('\n')) return false;
    if (dir === -1) {
      this.histIndex =
        this.histIndex === -1 ? this.history.length - 1 : Math.max(0, this.histIndex - 1);
    } else {
      if (this.histIndex === -1) return false;
      this.histIndex += 1;
      if (this.histIndex >= this.history.length) {
        this.histIndex = -1;
        this.setText('');
        return true;
      }
    }
    this.setText(this.history[this.histIndex]);
    return true;
  }

  private async mount(): Promise<void> {
    try {
      const [
        { EditorState, Prec },
        view,
        { javascript },
        { closeBrackets },
        { minimalSetup },
        highlight,
      ] = await Promise.all([
        import('@codemirror/state'),
        import('@codemirror/view'),
        import('@codemirror/lang-javascript'),
        import('@codemirror/autocomplete'),
        import('codemirror'),
        import('./cm-highlight').then((m) => m.fluiHighlighting()),
      ]);
      const { EditorView, keymap } = view;

      const keys = Prec.highest(
        keymap.of([
          {
            key: 'Enter',
            run: () => {
              this.runCurrent();
              return true;
            },
          },
          {
            key: 'Mod-Enter',
            run: () => {
              this.runCurrent();
              return true;
            },
          },
          {
            key: 'Shift-Enter',
            run: (v: unknown) => {
              const ev = v as {
                state: { selection: { main: { from: number; to: number } } };
                dispatch: (tx: unknown) => void;
              };
              const s = ev.state.selection.main;
              ev.dispatch({
                changes: { from: s.from, to: s.to, insert: '\n' },
                selection: { anchor: s.from + 1 },
              });
              return true;
            },
          },
          { key: 'ArrowUp', run: () => this.recall(-1) },
          { key: 'ArrowDown', run: () => this.recall(1) },
        ]),
      );

      const sync = EditorView.updateListener.of(
        (u: { docChanged: boolean; state: { doc: { toString(): string } } }) => {
          if (u.docChanged) this.fallbackText = u.state.doc.toString();
        },
      );

      const ev = new EditorView({
        state: EditorState.create({
          doc: '',
          extensions: [
            minimalSetup,
            highlight,
            javascript(),
            closeBrackets(),
            keys,
            sync,
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ 'aria-label': 'Shell statement' }),
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
