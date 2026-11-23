import { Component, OnInit, computed, input, signal } from '@angular/core';

type JsonKind = 'object' | 'array' | 'primitive' | 'bson';

const BSON_CLS = 'text-fl-warning-text';
const NUM_CLS = 'text-fl-accent-strong';
const MUTED_CLS = 'text-fl-ink-muted italic';
const STRING_CLS = 'text-fl-success';

function leaf(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

function detectBsonToken(v: unknown): { text: string; cls: string } | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 1) {
    const k = keys[0];
    const val = o[k];
    switch (k) {
      case '$oid':
        return { text: `ObjectId('${leaf(val)}')`, cls: BSON_CLS };
      case '$date': {
        let iso = '';
        if (typeof val === 'string') {
          iso = val;
        } else {
          const ms = (val as { $numberLong?: string })?.$numberLong;
          if (ms !== undefined) iso = new Date(Number(ms)).toISOString();
        }
        return { text: `ISODate('${iso}')`, cls: BSON_CLS };
      }
      case '$numberDecimal':
        return { text: `Decimal128('${leaf(val)}')`, cls: BSON_CLS };
      case '$numberLong':
        return { text: `Long('${leaf(val)}')`, cls: BSON_CLS };
      case '$numberInt':
      case '$numberDouble':
        return { text: leaf(val), cls: NUM_CLS };
      case '$timestamp': {
        const t = val as { t?: number; i?: number };
        return { text: `Timestamp(${t?.t}, ${t?.i})`, cls: BSON_CLS };
      }
      case '$binary': {
        const b = val as { base64?: string; subType?: string };
        return { text: `BinData(${b?.subType}, '${b?.base64}')`, cls: BSON_CLS };
      }
      case '$regularExpression': {
        const r = val as { pattern?: string; options?: string };
        return { text: `/${r?.pattern}/${r?.options ?? ''}`, cls: BSON_CLS };
      }
      case '$minKey':
        return { text: 'MinKey()', cls: BSON_CLS };
      case '$maxKey':
        return { text: 'MaxKey()', cls: BSON_CLS };
      case '$undefined':
        return { text: 'undefined', cls: MUTED_CLS };
      case '$symbol':
        return { text: `'${leaf(val)}'`, cls: STRING_CLS };
    }
  }
  if (Object.hasOwn(o, '$code')) {
    return { text: `Code('${leaf(o['$code'])}')`, cls: BSON_CLS };
  }
  return null;
}

@Component({
  selector: 'app-json-viewer',
  template: `
    @switch (kind()) {
      @case ('primitive') {
        <span class="inline-flex gap-1 font-mono text-fl-mono-sm">
          @if (name() !== undefined) {
            <span class="text-fl-ink-secondary">{{ name() }}:</span>
          }
          <span [class]="primClass()">{{ primDisplay() }}</span>
        </span>
      }
      @case ('bson') {
        <span class="inline-flex gap-1 font-mono text-fl-mono-sm">
          @if (name() !== undefined) {
            <span class="text-fl-ink-secondary">{{ name() }}:</span>
          }
          <span [class]="bson()!.cls">{{ bson()!.text }}</span>
        </span>
      }
      @default {
        <div class="font-mono text-fl-mono-sm">
          <button
            type="button"
            (click)="toggle()"
            [attr.aria-expanded]="expanded()"
            class="flex items-center gap-1 rounded-fl-sm px-0.5 text-left hover:bg-fl-surface-hover"
          >
            <span class="w-3 shrink-0 text-fl-ink-muted" aria-hidden="true">{{
              expanded() ? '▾' : '▸'
            }}</span>
            @if (name() !== undefined) {
              <span class="text-fl-ink-secondary">{{ name() }}:</span>
            }
            <span class="text-fl-ink-muted">
              @if (expanded()) {
                {{ openBrace() }}
              } @else {
                {{ openBrace() }} … {{ count() }} {{ unit() }} {{ closeBrace() }}
              }
            </span>
          </button>
          @if (expanded()) {
            <div class="ml-1.5 border-l border-fl-border-subtle pl-3">
              @for (e of entries(); track e.key) {
                <div>
                  <app-json-viewer
                    [value]="e.val"
                    [name]="e.key"
                    [depth]="depth() + 1"
                    [autoExpandDepth]="autoExpandDepth()"
                  />
                </div>
              }
            </div>
            <span class="ml-1.5 pl-3 text-fl-ink-muted">{{ closeBrace() }}</span>
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

  readonly bson = computed(() => detectBsonToken(this.value()));

  readonly kind = computed<JsonKind>(() => {
    if (this.bson()) return 'bson';
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
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
      return String(v);
    }
    return JSON.stringify(v) ?? 'undefined';
  }

  primClass(): string {
    const v = this.value();
    if (v === null) return MUTED_CLS;
    switch (typeof v) {
      case 'string':
        return STRING_CLS;
      case 'number':
        return NUM_CLS;
      case 'boolean':
        return BSON_CLS;
      default:
        return '';
    }
  }
}
