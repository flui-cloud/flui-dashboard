import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  viewChild,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbEngine } from '../../model/db-engine';

interface MinimalEditorView {
  state: {
    doc: { toString(): string; length: number };
    selection: { main: { from: number; to: number; empty: boolean } };
    sliceDoc(from: number, to: number): string;
  };
  dispatch(tx: unknown): void;
  destroy(): void;
}

@Component({
  selector: 'app-sql-editor',
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div
      class="flex h-60 resize-y flex-col overflow-hidden rounded-fl-md border border-fl-border-input bg-fl-surface font-mono text-fl-mono-sm focus-within:border-fl-accent"
    >
      <div #editorHost [hidden]="!editorReady()" class="min-h-0 flex-1 overflow-auto"></div>
      @if (!editorReady()) {
        <textarea
          #sqlTextarea
          [(ngModel)]="sqlText"
          (keydown)="onEditorKey($event)"
          spellcheck="false"
          aria-label="SQL"
          class="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-3 font-mono text-fl-mono-sm text-fl-ink outline-none"
          placeholder="SELECT …"
        ></textarea>
      }
    </div>
  `,
})
export class SqlEditorComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly engine = input<DbEngine>('postgres');

  readonly run = output<void>();

  readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  readonly sqlTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('sqlTextarea');

  readonly editorReady = signal(false);
  sqlText = 'SELECT 1;';

  private editorView: MinimalEditorView | null = null;
  private sqlCompartment: { reconfigure(ext: unknown): unknown } | null = null;
  private cmSql: ((cfg: { dialect: unknown; upperCaseKeywords: boolean }) => unknown) | null = null;
  private cmDialects: Partial<Record<DbEngine, unknown>> = {};

  constructor() {
    effect(() => {
      this.engine();
      this.applyEngineDialect();
    });
  }

  ngAfterViewInit(): void {
    void this.tryMountEditor();
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }

  text(): string {
    return this.sqlText;
  }

  setText(text: string): void {
    this.sqlText = text;
    if (this.editorView) {
      this.editorView.dispatch({
        changes: { from: 0, to: this.editorView.state.doc.length, insert: text },
      });
    }
  }

  currentQuery(): string {
    return this.selectedSql() || this.sqlText;
  }

  private selectedSql(): string {
    if (this.editorView) {
      const sel = this.editorView.state.selection?.main;
      if (sel && !sel.empty) {
        return this.editorView.state.sliceDoc(sel.from, sel.to);
      }
      return '';
    }
    const ta = this.sqlTextarea()?.nativeElement;
    if (!ta) return '';
    if (ta.selectionStart != null && ta.selectionStart !== ta.selectionEnd) {
      return (this.sqlText ?? '').slice(ta.selectionStart, ta.selectionEnd);
    }
    return '';
  }

  onEditorKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      this.run.emit();
      return;
    }
    if (!event.shiftKey && !event.altKey) {
      const ta = this.sqlTextarea()?.nativeElement;
      if (ta && ta.selectionStart !== ta.selectionEnd) {
        event.preventDefault();
        this.run.emit();
      }
    }
  }

  private async tryMountEditor(): Promise<void> {
    try {
      const [
        { EditorState, Prec, Compartment },
        view,
        { sql, PostgreSQL, MySQL },
        { basicSetup },
        highlight,
      ] = await Promise.all([
        import('@codemirror/state'),
        import('@codemirror/view'),
        import('@codemirror/lang-sql'),
        import('codemirror'),
        import('./cm-highlight').then((m) => m.fluiHighlighting()),
      ]);
      const { EditorView, keymap } = view;
      const langCompartment = new Compartment();
      const dialects = { postgres: PostgreSQL, mariadb: MySQL };
      this.sqlCompartment = langCompartment;
      this.cmSql = sql as unknown as typeof this.cmSql;
      this.cmDialects = dialects;
      const runKey = Prec.highest(
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
            run: (v: { state: { selection: { main: { empty: boolean } } } }) => {
              if (v.state.selection.main.empty) return false;
              this.zone.run(() => this.run.emit());
              return true;
            },
          },
        ]),
      );
      const syncListener = EditorView.updateListener.of((u) => {
        if (u.docChanged) this.sqlText = u.state.doc.toString();
      });
      const ev = new EditorView({
        state: EditorState.create({
          doc: this.sqlText,
          extensions: [
            basicSetup,
            highlight,
            runKey,
            syncListener,
            langCompartment.of(
              sql({
                dialect: dialects[this.engine() as 'postgres' | 'mariadb'] ?? PostgreSQL,
                upperCaseKeywords: true,
              }),
            ),
            EditorView.contentAttributes.of({ 'aria-label': 'SQL' }),
            EditorView.theme({
              '&': {
                height: '100%',
                backgroundColor: 'transparent',
                color: 'var(--fl-ink)',
              },
              '&.cm-focused': { outline: 'none' },
              '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--fl-font-mono)' },
              '.cm-content': { caretColor: 'var(--fl-ink)' },
              '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fl-ink)' },
              '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--fl-ink)' },
              '.cm-gutters': {
                backgroundColor: 'var(--fl-surface-subtle)',
                color: 'var(--fl-ink-muted)',
                borderRight: '1px solid var(--fl-border-subtle)',
              },
              '.cm-activeLine': { backgroundColor: 'var(--fl-surface-subtle)' },
              '.cm-activeLineGutter': { backgroundColor: 'var(--fl-surface-hover)' },
              '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
                backgroundColor: 'var(--fl-accent-soft)',
              },
            }),
          ],
        }),
        parent: this.editorHost().nativeElement,
      });
      this.editorView = ev as unknown as MinimalEditorView;
      this.editorReady.set(true);
      this.applyEngineDialect();
      requestAnimationFrame(() => {
        ev.requestMeasure();
        ev.requestMeasure();
      });
      setTimeout(() => ev.requestMeasure(), 0);
    } catch {
      this.editorReady.set(false);
    }
  }

  private applyEngineDialect(): void {
    if (!this.editorView || !this.sqlCompartment || !this.cmSql) return;
    const dialect = this.cmDialects[this.engine()];
    if (!dialect) return;
    this.editorView.dispatch({
      effects: this.sqlCompartment.reconfigure(this.cmSql({ dialect, upperCaseKeywords: true })),
    });
  }
}
