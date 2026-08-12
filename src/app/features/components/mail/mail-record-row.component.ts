import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';

export interface OutstandingRecord {
  name: string;
  kind: string;
  value: string;
  purpose: string;
}

const PURPOSE_LABEL: Record<string, string> = {
  spf: 'SPF',
  dkim: 'DKIM',
  dmarc: 'DMARC',
  mx: 'MX',
};

@Component({
  selector: 'app-mail-record-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy, lucideTriangleAlert })],
  template: `
    <div class="rounded-md border border-border bg-muted/40 p-2.5">
      <div class="mb-1.5 flex items-center gap-2">
        <span
          class="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
          >{{ record().kind }}</span
        >
        <span class="text-[11px] font-medium text-foreground">{{ label() }}</span>
      </div>

      <div class="space-y-1">
        <div class="flex items-start gap-2">
          <span class="w-12 shrink-0 pt-0.5 text-[11px] text-muted-foreground">Name</span>
          <span class="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">{{
            record().name
          }}</span>
          <button
            type="button"
            (click)="copy(record().name, 'name')"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            [title]="'Copy the name'"
          >
            <ng-icon
              [name]="copied() === 'name' ? 'lucideCheck' : 'lucideCopy'"
              class="h-3.5 w-3.5"
              [class.text-emerald-600]="copied() === 'name'"
            />
          </button>
        </div>

        @if (priority(); as mx) {
          <div class="flex items-start gap-2">
            <span class="w-12 shrink-0 pt-0.5 text-[11px] text-muted-foreground">Priority</span>
            <span class="min-w-0 flex-1 font-mono text-[11px] text-foreground">{{ mx.priority }}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="w-12 shrink-0 pt-0.5 text-[11px] text-muted-foreground">Value</span>
            <span class="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">{{
              mx.host
            }}</span>
            <button
              type="button"
              (click)="copy(mx.host, 'value')"
              class="shrink-0 text-muted-foreground hover:text-foreground"
              title="Copy the value"
            >
              <ng-icon
                [name]="copied() === 'value' ? 'lucideCheck' : 'lucideCopy'"
                class="h-3.5 w-3.5"
                [class.text-emerald-600]="copied() === 'value'"
              />
            </button>
          </div>
        } @else {
          <div class="flex items-start gap-2">
            <span class="w-12 shrink-0 pt-0.5 text-[11px] text-muted-foreground">Value</span>
            <span class="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">{{
              record().value
            }}</span>
            <button
              type="button"
              (click)="copy(record().value, 'value')"
              class="shrink-0 text-muted-foreground hover:text-foreground"
              title="Copy the value"
            >
              <ng-icon
                [name]="copied() === 'value' ? 'lucideCheck' : 'lucideCopy'"
                class="h-3.5 w-3.5"
                [class.text-emerald-600]="copied() === 'value'"
              />
            </button>
          </div>
        }
      </div>

      @if (caution(); as note) {
        <p
          class="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-px h-3 w-3 shrink-0" />
          <span>{{ note }}</span>
        </p>
      }
    </div>
  `,
})
export class MailRecordRowComponent {
  readonly record = input.required<OutstandingRecord>();

  protected readonly copied = signal<'name' | 'value' | null>(null);

  protected readonly label = computed(
    () => PURPOSE_LABEL[this.record().purpose?.toLowerCase()] ?? this.record().purpose,
  );

  protected readonly caution = computed(() => {
    const record = this.record();
    const value = record.value.toLowerCase();

    if (record.kind === 'MX') {
      return (
        'This MX discards inbound mail — it exists so the domain can send, not receive. ' +
        'Publishing it on a domain that currently receives email will silently stop delivery ' +
        'to those mailboxes. Only add it if nothing reads mail at this domain.'
      );
    }

    if (record.purpose?.toLowerCase() === 'dmarc' && /p=(quarantine|reject)/.test(value)) {
      const policy = /p=reject/.test(value) ? 'reject' : 'quarantine';
      return (
        `This DMARC policy is \`p=${policy}\`, not \`p=none\`: receivers will act on failures ` +
        'immediately rather than only reporting them. If anything else sends as this domain and ' +
        'is not covered by the SPF and DKIM above, its mail starts being filtered the moment ' +
        'this is published.'
      );
    }

    return null;
  });

  protected readonly priority = computed(() => {
    if (this.record().kind !== 'MX') return null;
    // Split on the first gap: a whole-value pattern backtracks on provider input.
    const value = this.record().value.trim();
    const gap = value.search(/\s/);
    if (gap <= 0) return null;
    const priority = value.slice(0, gap);
    const host = value.slice(gap).trim();
    return /^\d+$/.test(priority) && host ? { priority, host } : null;
  });

  protected copy(value: string, field: 'name' | 'value'): void {
    void navigator.clipboard?.writeText(value).then(() => {
      this.copied.set(field);
      setTimeout(() => this.copied.set(null), 1500);
    });
  }
}
