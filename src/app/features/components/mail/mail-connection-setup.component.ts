import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideRotateCcw, lucideTriangleAlert } from '@ng-icons/lucide';
import { MailRecordRowComponent } from './mail-record-row.component';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  MailConnectionSetup,
  MailReadinessStep,
  READINESS_STEP_LABEL,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';

@Component({
  selector: 'app-mail-connection-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, MailRecordRowComponent],
  providers: [provideIcons({ lucideCircleCheck, lucideRotateCcw, lucideTriangleAlert })],
  template: `
    @if (loading() && !setup()) {
      <div class="mt-2 skeleton h-4 w-52"></div>
    } @else if (error()) {
      <p class="mt-2 text-xs text-muted-foreground">{{ error() }}</p>
    } @else if (setup()) {
      @let s = setup()!;
      @if (s.verified) {
        <p class="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <ng-icon name="lucideCircleCheck" class="h-3.5 w-3.5" />
          {{ providerName() }} authenticates mail from
          <span class="font-mono">{{ s.domain }}</span
          >.
        </p>
      } @else {
        <div class="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p class="text-xs font-medium text-amber-900 dark:text-amber-300">
            {{ providerName() }} is refusing mail from this sender until it verifies
            <span class="font-mono">{{ s.domain ?? 'the domain' }}</span
            >.
          </p>

          @if (steps().length) {
            <ul class="mt-1.5 space-y-0.5">
              @for (step of steps(); track step.id) {
                <li class="flex items-start gap-1.5 text-[11px]">
                  <span class="w-3 shrink-0 text-center" [class]="glyphClass(step)">
                    {{ glyph(step) }}
                  </span>
                  <span class="text-amber-900 dark:text-amber-300">
                    {{ label(step) }}<span class="text-amber-800/70 dark:text-amber-400/70">
                      — {{ detail(step) }}</span
                    >
                  </span>
                </li>
              }
            </ul>
          }

          @if (s.records.length) {
            <ul class="mt-1.5 space-y-0.5">
              @for (record of s.records; track record.name + record.value) {
                <li class="flex items-start gap-1.5 text-[11px]">
                  <span
                    class="w-3 shrink-0 text-center"
                    [class]="
                      record.live
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    "
                  >
                    {{ record.live ? '✓' : '·' }}
                  </span>
                  <span class="min-w-0 text-amber-900 dark:text-amber-300">
                    <span class="font-mono">{{ record.name }}</span>
                    <span class="text-amber-800/70 dark:text-amber-400/70">
                      — {{ recordState(record) }}</span
                    >
                  </span>
                </li>
              }
            </ul>
          }

          @if (s.published) {
            <p class="mt-1.5 flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              <ng-icon name="lucideCircleCheck" class="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Every record it asked for is published and resolving. Nothing left on our side —
                {{ providerName() }} re-reads DNS on its own schedule, which is what the wait is.
              </span>
            </p>
          } @else if (s.canWrite) {
            <p class="mt-1.5 text-[11px] text-amber-800 dark:text-amber-400">
              Flui manages <span class="font-mono">{{ zoneNote(s) }}</span
              >, so the records go in for you. Nothing to copy anywhere.
            </p>
            @if (published(); as done) {
              <p class="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">{{ done }}</p>
            }
          } @else if (s.records.length) {
            <p class="mt-2 text-[11px] text-amber-800 dark:text-amber-400">
              Flui does not hold this zone. Publish these wherever it lives:
            </p>
            <div class="mt-1.5 space-y-1.5">
              @for (record of s.records; track record.name + record.value) {
                <app-mail-record-row [record]="record" />
              }
            </div>
          }

          @if (asked(); as answer) {
            <p class="mt-2 text-[11px]" [class]="answer.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'">
              {{ answer.text }}
            </p>
          }

          <div class="mt-2 flex flex-wrap items-center gap-2">
            @if (s.canWrite) {
              <button
                type="button"
                (click)="publish()"
                [disabled]="busy()"
                class="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium disabled:opacity-60"
                [class]="
                  s.published
                    ? 'border border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                "
              >
                @if (busy()) {
                  <ng-icon name="lucideRotateCcw" class="h-3 w-3 animate-spin" />
                }
                {{ s.published ? 'Ask ' + providerName() + ' to check now' : 'Publish the records' }}
              </button>
            }
            <button
              type="button"
              (click)="load()"
              [disabled]="loading()"
              class="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-300 px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20"
            >
              <ng-icon
                name="lucideRotateCcw"
                class="h-3 w-3"
                [class.animate-spin]="loading()"
              />
              Check again
            </button>
          </div>
        </div>
      }
    }
  `,
})
export class MailConnectionSetupComponent implements OnInit {
  readonly connectionId = input.required<string>();
  readonly providerName = input('The provider');

  private readonly api = inject(MailConsoleService);

  protected readonly setup = signal<MailConnectionSetup | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly published = signal<string | null>(null);
  protected readonly asked = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly steps = computed(() =>
    (this.setup()?.readiness?.steps ?? []).filter(
      (s) => !(s.id === 'credential' && s.status === 'satisfied'),
    ),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.connectionSetup(this.connectionId()).subscribe({
      next: (setup) => {
        this.setup.set(setup);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected zoneNote(setup: MailConnectionSetup): string {
    const parts = (setup.domain ?? '').split('.');
    return parts.length > 2 ? parts.slice(1).join('.') : (setup.domain ?? 'this zone');
  }

  protected recordState(record: MailConnectionSetup['records'][number]): string {
    if (!record.live) return 'not in DNS yet';
    if (record.accepted === true) return 'published, and accepted by the provider';
    return record.accepted === false
      ? 'published — the provider has not read it yet'
      : 'published and resolving';
  }

  protected publish(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.publishForConnection(this.connectionId()).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.asked.set(
          result.recheck?.asked
            ? {
                ok: result.recheck.accepted,
                text: result.recheck.accepted
                  ? `${this.providerName()} accepted the request to look again. Its verdict follows on its own.`
                  : `${this.providerName()} refused to look again: ${result.recheck.detail ?? 'no reason given'}`,
              }
            : null,
        );
        this.published.set(
          result.published.length
            ? `Published ${result.published.length} record(s).`
            : 'Nothing left to publish — the records were already in place.',
        );
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.busy.set(false);
      },
    });
  }

  protected label(step: MailReadinessStep): string {
    return READINESS_STEP_LABEL[step.id] ?? step.id;
  }

  protected detail(step: MailReadinessStep): string {
    if (step.action) return step.action;
    switch (step.status) {
      case 'satisfied':
        return 'done';
      case 'automatable':
        return 'Flui can do this';
      case 'pending':
        return 'the provider is still checking';
      default:
        return step.reason ?? 'needs you';
    }
  }

  protected glyph(step: MailReadinessStep): string {
    if (step.status === 'satisfied') return '✓';
    return step.status === 'pending' ? '⏳' : '→';
  }

  protected glyphClass(step: MailReadinessStep): string {
    return step.status === 'satisfied'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400';
  }
}
