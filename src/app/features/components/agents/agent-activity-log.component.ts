import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  AgentActivityEntry,
  AgentIdentityActivity,
  ActivityScope,
  actedOn,
  actorRef,
  namedActor,
  operationNote,
  underLabel,
} from '../../model/agent-activity.models';
import { formatTimeSince } from '../../model/dns.models';

@Component({
  selector: 'app-agent-activity-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (identities().length) {
      <div class="flex flex-wrap gap-2" data-testid="activity-actors">
        @for (actor of actors(); track actor.ref) {
          <div
            class="rounded-md border border-border bg-muted/30 px-3 py-2"
            data-testid="activity-actor"
          >
            <p class="m-0 text-[13px] font-medium text-foreground">
              {{ actor.name }}
              @if (actor.revoked) {
                <span class="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  revoked
                </span>
              }
            </p>
            <p class="m-0 text-[12px] text-muted-foreground">
              {{ actor.summary }}
            </p>
          </div>
        }
      </div>
    }

    @if (rows().length === 0) {
      <p class="m-0 text-sm text-muted-foreground" data-testid="no-activity">
        Nothing has been done through an agent yet. This fills itself in as they
        work — it is written by the act, not by anyone reporting one.
      </p>
    } @else {
      <div class="flex flex-col" data-testid="activity-log">
        @for (row of rows(); track row.id) {
          <div
            class="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 border-b border-border/60 py-2.5 sm:grid-cols-[auto_1fr_auto]"
            data-testid="activity-row"
          >
            <span
              class="font-mono text-[12px] tabular-nums text-muted-foreground"
              [title]="row.at"
              >{{ row.when }}</span
            >

            <span class="text-sm text-muted-foreground" data-testid="activity-what">
              <code class="font-mono text-[12.5px] text-foreground">{{ row.tool }}</code>
              @if (row.on) {
                on <b class="font-medium text-foreground">{{ row.on }}</b>
              }
              @if (row.note) {
                — <span data-testid="activity-operation">{{ row.note }}</span>
              }
              @if (row.who) {
                <span class="text-muted-foreground/80"> · {{ row.who }}</span>
              }
            </span>

            <span
              class="justify-self-start whitespace-nowrap text-[12px] sm:justify-self-end"
              [class.text-destructive]="row.tone === 'refused'"
              [class.text-muted-foreground]="row.tone !== 'refused'"
              [title]="row.underDetail"
              data-testid="activity-under"
              >{{ row.under }}</span
            >

            @if (row.error) {
              <div class="col-span-full">
                <button
                  type="button"
                  class="text-[12px] text-muted-foreground underline underline-offset-2"
                  (click)="toggleError(row.id)"
                  data-testid="activity-error-toggle"
                >
                  {{ shown() === row.id ? 'Hide' : 'Show' }} the message it was
                  refused with
                </button>
                @if (shown() === row.id) {
                  <p
                    class="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[12px] text-muted-foreground"
                    data-testid="activity-error"
                  >
                    {{ row.error }}
                  </p>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (scope() === 'instance') {
        <p class="m-0 text-[12px] text-muted-foreground" data-testid="activity-scope">
          You administer access here, so this is every agent on the instance, not
          only yours.
        </p>
      }

      @if (more() > 0) {
        <p class="m-0 text-[12px] text-muted-foreground" data-testid="activity-more">
          Showing the {{ rows().length }} most recent of {{ total() }}.
        </p>
      }
    }
  `,
})
export class AgentActivityLogComponent {
  readonly entries = input<AgentActivityEntry[]>([]);
  readonly identities = input<AgentIdentityActivity[]>([]);
  readonly scope = input<ActivityScope>('own');
  readonly total = input(0);
  readonly keyNames = input<Record<string, string>>({});
  readonly identityNames = input<Record<string, string>>({});

  protected readonly shown = signal<string | null>(null);

  protected readonly more = computed(() =>
    Math.max(0, this.total() - this.entries().length),
  );

  protected readonly rows = computed(() =>
    this.entries().map((entry) => {
      const label = underLabel(entry);
      return {
        id: entry.id,
        at: entry.at,
        when: formatTimeSince(entry.at),
        tool: entry.tool,
        on: actedOn(entry),
        note: operationNote(entry),
        who: this.nameOf(entry),
        under: label.text,
        underDetail: label.detail,
        tone: label.tone,
        error: entry.allowed ? null : entry.error,
      };
    }),
  );

  protected readonly actors = computed(() =>
    this.identities().map((identity) => ({
      ref: actorRef(identity),
      name: this.nameOf(identity) ?? 'An agent with no name left',
      revoked: identity.actorKeyRevoked === true,
      summary: summarise(identity),
    })),
  );

  protected toggleError(id: string): void {
    this.shown.update((open) => (open === id ? null : id));
  }

  private nameOf(entry: {
    actorKeyId: string | null;
    actorKeyName?: string | null;
    userId: string;
  }): string | null {
    return namedActor(entry, this.keyNames(), this.identityNames());
  }
}

function summarise(identity: AgentIdentityActivity): string {
  const calls = identity.calls === 1 ? '1 call' : `${identity.calls} calls`;
  const refused = identity.refused ? `, ${identity.refused} refused` : '';
  return `${calls}${refused} · last acted ${formatTimeSince(identity.lastActivityAt)}`;
}
