import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { MailRecordsTable } from './mail-records-table';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailConnectionSetup, MailReadinessStep } from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { stepLabel, stepStatus, stepTone } from './mail-readiness';

@Component({
  selector: 'app-mail-connection-setup',
  imports: [FlAlert, FlLoadingState, FlButton, FlStatus, MailRecordsTable],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (loading() && !setup()) {
      <fl-loading-state [rows]="1" />
    } @else if (error()) {
      <fl-alert tone="error" title="Could not read the setup">{{ error() }}</fl-alert>
    } @else if (setup()) {
      @let s = setup()!;
      @if (s.verified) {
        <fl-status
          tone="success"
          [label]="providerName() + ' authenticates mail from ' + s.domain"
        />
      } @else {
        <fl-alert
          tone="warning"
          [title]="
            providerName() +
            ' is refusing mail from this sender until it verifies ' +
            (s.domain ?? 'the domain')
          "
        >
          @if (s.published) {
            Every record it asked for is published and resolving. Nothing left on our side:
            {{ providerName() }} re-reads DNS on its own schedule, which is what the wait is.
          } @else if (s.canWrite) {
            Flui manages <span class="fl-mono">{{ zoneNote(s) }}</span>, so the records go in for
            you. Nothing to copy anywhere.
          } @else if (s.records.length) {
            Flui does not hold this zone. Publish these wherever it lives.
          }
          <ng-container alertActions>
            @if (s.canWrite) {
              <button flButton size="sm" type="button" [disabled]="busy()" (click)="publish()">
                {{
                  s.published ? 'Ask ' + providerName() + ' to check now' : 'Publish the records'
                }}
              </button>
            }
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="loading()"
              (click)="load()"
            >
              Check again
            </button>
          </ng-container>
        </fl-alert>

        @if (steps().length) {
          <ul class="m-0 flex list-none flex-col gap-1 p-0 text-fl-body-sm">
            @for (step of steps(); track step.id) {
              <li class="fl-row">
                <fl-status [tone]="tone(step)" [label]="label(step)" />
                <span class="text-fl-ink-muted">{{ detail(step) }}</span>
              </li>
            }
          </ul>
        }

        @if (s.records.length) {
          <app-mail-records-table [records]="s.records" [showValues]="!s.canWrite" />
        }

        @if (published(); as done) {
          <fl-status tone="success" [label]="done" />
        }

        @if (asked(); as answer) {
          <fl-alert [tone]="answer.ok ? 'info' : 'error'" [title]="answer.text" />
        }
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
            : 'Nothing left to publish, the records were already in place.',
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
    return stepLabel(step);
  }

  protected tone(step: MailReadinessStep): ReturnType<typeof stepTone> {
    return stepTone(step);
  }

  protected detail(step: MailReadinessStep): string {
    if (step.action) return step.action;
    if (step.status === 'manual' && step.reason) return step.reason;
    return stepStatus(step);
  }
}
