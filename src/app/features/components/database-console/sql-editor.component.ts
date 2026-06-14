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
  effect,
  inject,
  input,
  signal,
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [FormsModule],
  template: `
    <div
      class="flex min-h-[240px] flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <div
        #editorHost
        [hidden]="!editorReady()"
        class="min-h-0 flex-1 overflow-auto text-sm"
      ></div>
      @if (!editorReady()) {
        <textarea
          #sqlTextarea
          [(ngModel)]="sqlText"
          (keydown)="onEditorKey($event)"
          spellcheck="false"
          class="min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-sm outline-none"
          placeholder="SELECT …"
        ></textarea>
      }
    </div>
  `,
})
export class SqlEditorComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly engine = input<DbEngine>('postgres');

  @Output() readonly run = new EventEmitter<void>();

  @ViewChild('editorHost', { static: true })
  editorHost!: ElementRef<HTMLDivElement>;

  @ViewChild('sqlTextarea')
  sqlTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly editorReady = signal(false);
  sqlText = 'SELECT 1;';

  private editorView: MinimalEditorView | null = null;
  private sqlCompartment: { reconfigure(ext: unknown): unknown } | null = null;
  private cmSql: ((cfg: { dialect: unknown; upperCaseKeywords: boolean }) => unknown) | null =
    null;
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
    const ta = this.sqlTextarea?.nativeElement;
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
      const ta = this.sqlTextarea?.nativeElement;
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
      ] = await Promise.all([
        import('@codemirror/state'),
        import('@codemirror/view'),
        import('@codemirror/lang-sql'),
        import('codemirror'),
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
            runKey,
            syncListener,
            langCompartment.of(
              sql({
                dialect: dialects[this.engine() as 'postgres' | 'mariadb'] ?? PostgreSQL,
                upperCaseKeywords: true,
              }),
            ),
            EditorView.theme({
              '&': {
                height: '100%',
                backgroundColor: 'transparent',
                color: 'inherit',
              },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-content': { caretColor: 'currentColor' },
              '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'currentColor' },
              '&.cm-focused .cm-cursor': { borderLeftColor: 'currentColor' },
              '.cm-gutters': {
                backgroundColor: 'transparent',
                color: 'inherit',
                borderRight: 'none',
                opacity: '0.6',
              },
              '.cm-activeLine': { backgroundColor: 'rgba(127,127,127,0.08)' },
              '.cm-activeLineGutter': {
                backgroundColor: 'rgba(127,127,127,0.08)',
              },
            }),
          ],
        }),
        parent: this.editorHost.nativeElement,
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
      effects: this.sqlCompartment.reconfigure(
        this.cmSql({ dialect, upperCaseKeywords: true }),
      ),
    });
  }
}
