import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  signal,
} from '@angular/core';

type JsonKind = 'object' | 'array' | 'primitive';

@Component({
  selector: 'app-json-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (kind()) {
      @case ('primitive') {
        <span class="inline-flex gap-1 font-mono text-xs leading-5">
          @if (name() !== undefined) {
            <span class="text-muted-foreground">{{ name() }}:</span>
          }
          <span [class]="primClass()">{{ primDisplay() }}</span>
        </span>
      }
      @default {
        <div class="font-mono text-xs leading-5">
          <button
            type="button"
            (click)="toggle()"
            class="flex items-center gap-1 text-left hover:bg-muted/50 rounded px-0.5"
          >
            <span class="w-3 shrink-0 text-muted-foreground">{{ expanded() ? '▾' : '▸' }}</span>
            @if (name() !== undefined) {
              <span class="text-muted-foreground">{{ name() }}:</span>
            }
            <span class="text-muted-foreground">
              @if (expanded()) {
                {{ openBrace() }}
              } @else {
                {{ openBrace() }} … {{ count() }} {{ unit() }} {{ closeBrace() }}
              }
            </span>
          </button>
          @if (expanded()) {
            <div class="border-l border-border/60 pl-3 ml-1.5">
              @for (e of entries(); track e.key) {
                <app-json-viewer
                  [value]="e.val"
                  [name]="e.key"
                  [depth]="depth() + 1"
                  [autoExpandDepth]="autoExpandDepth()"
                />
              }
            </div>
            <span class="ml-1.5 pl-3 text-muted-foreground">{{ closeBrace() }}</span>
          }
        </div>
      }
    }
  `,
})
export class JsonViewerComponent implements OnInit {
  readonly value = input<unknown>();
  readonly name = input<string | undefined>(undefined);
  readonly depth = input<number>(0);
  readonly autoExpandDepth = input<number>(2);

  readonly expanded = signal(false);

  readonly kind = computed<JsonKind>(() => {
    const v = this.value();
    if (Array.isArray(v)) return 'array';
    if (v !== null && typeof v === 'object') return 'object';
    return 'primitive';
  });

  readonly entries = computed<{ key: string; val: unknown }[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v.map((val, i) => ({ key: String(i), val }));
    if (v !== null && typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>).map(([key, val]) => ({ key, val }));
    }
    return [];
  });

  readonly count = computed(() => this.entries().length);
  readonly unit = computed(() => (this.kind() === 'array' ? 'items' : 'keys'));
  readonly openBrace = computed(() => (this.kind() === 'array' ? '[' : '{'));
  readonly closeBrace = computed(() => (this.kind() === 'array' ? ']' : '}'));

  ngOnInit(): void {
    this.expanded.set(this.depth() < this.autoExpandDepth() && this.count() <= 50);
  }

  toggle(): void {
    this.expanded.update((e) => !e);
  }

  primDisplay(): string {
    const v = this.value();
    if (v === null) return 'null';
    if (typeof v === 'string') return `"${v}"`;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v as number | bigint | boolean);
  }

  primClass(): string {
    const v = this.value();
    if (v === null) return 'text-muted-foreground italic';
    switch (typeof v) {
      case 'string':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'number':
        return 'text-sky-600 dark:text-sky-400';
      case 'boolean':
        return 'text-violet-600 dark:text-violet-400';
      default:
        return '';
    }
  }
}
