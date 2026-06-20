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

/**
 * The mongosh shell's input line: a CodeMirror editor (JS highlighting) that runs the
 * statement on Enter (Shift+Enter inserts a newline for multi-line statements) and recalls
 * previous statements with ↑/↓ when the input is single-line — just like a real shell. No
 * eval here; it only emits the typed text. Falls back to a plain input if CodeMirror fails.
 */
@Component({
  selector: 'app-mongo-shell-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div class="flex items-start gap-2">
      <span class="shrink-0 select-none pt-1.5 font-mono text-xs text-primary">{{ prompt() }}</span>
      <div
        #host
        [hidden]="!ready()"
        class="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background text-xs"
      ></div>
      @if (!ready()) {
        <input
          #fallback
          [(ngModel)]="fallbackText"
          (keydown.enter)="runFallback()"
          [disabled]="disabled()"
          spellcheck="false"
          placeholder="db.collection.find({ … })"
          class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary disabled:opacity-50"
        />
      }
    </div>
  `,
})
export class MongoShellInputComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly prompt = input('>');
  readonly disabled = input(false);

  @Output() readonly run = new EventEmitter<string>();

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly ready = signal(false);
  fallbackText = '';

  private readonly history: string[] = [];
  private histIndex = -1; // -1 = current (not browsing history)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private view: any = null;

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
    if (this.disabled()) return;
    const text = String(this.view.state.doc.toString()).trim();
    if (!text) return;
    this.zone.run(() => this.emit(text));
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: '' } });
  }

  private recall(dir: -1 | 1): boolean {
    if (!this.history.length) return false;
    // Only hijack ↑/↓ for history when the statement is a single line.
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
      const [{ EditorState, Prec }, view, { javascript }, { closeBrackets }, { minimalSetup }, highlight] =
        await Promise.all([
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

      this.view = new EditorView({
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
            EditorView.theme({
              '&': { backgroundColor: 'transparent', color: 'inherit' },
              '&.cm-focused': { outline: 'none' },
              '.cm-content': {
                padding: '6px 8px',
                caretColor: 'hsl(var(--foreground))',
                fontFamily: 'ui-monospace, monospace',
              },
              '.cm-line': { padding: '0' },
              '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--foreground))' },
              '&.cm-focused .cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
            }),
          ],
        }),
        parent: this.host.nativeElement,
      });
      this.ready.set(true);
    } catch {
      this.ready.set(false);
    }
  }
}
