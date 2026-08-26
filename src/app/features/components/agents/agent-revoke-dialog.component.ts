import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideTriangleAlert, lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  HlmCardContentDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
} from '@spartan-ng/ui-card-helm';
import {
  AgentConcession,
  ConcessionOperation,
} from '../../model/agent-cycle.models';

@Component({
  selector: 'app-agent-revoke-dialog',
  standalone: true,
  imports: [
    NgIcon,
    HlmButtonDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardContentDirective,
  ],
  providers: [provideIcons({ lucideLoader, lucideTriangleAlert, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="cancel.emit()">
      <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
        <div hlmCard (click)="$event.stopPropagation()" data-testid="revoke-dialog">
          <div hlmCardHeader>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-destructive" />
                </div>
                <h2 hlmCardTitle class="text-lg">Take this permission back</h2>
              </div>
              <button hlmBtn variant="ghost" size="sm" class="h-8 w-8 p-0" (click)="cancel.emit()">
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div hlmCardContent class="space-y-4">
            <p class="m-0 text-sm text-muted-foreground">
              Your agent will stop being able to
              <code class="font-mono text-[12.5px] font-medium text-foreground">{{ concession().sentence }}</code>
              without asking. Nothing else changes: this was a pause removed, not a
              permission granted, so nothing is taken away from you.
            </p>

            @if (loading()) {
              <p class="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="running-loading">
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                Checking what is still running under it…
              </p>
            } @else {
              <div
                class="rounded-md border px-3.5 py-3"
                [class]="
                  running().length
                    ? 'border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/10'
                    : 'border-border bg-muted/40'
                "
                data-testid="what-continues"
              >
                @if (running().length) {
                  <p class="m-0 text-sm text-foreground">
                    <span class="font-medium">{{ running().length }}</span>
                    {{ running().length === 1 ? 'operation' : 'operations' }} already started
                    under this permission and will
                    <span class="font-medium">carry on</span> after you revoke it.
                    Revoking stops the next departure, not this one.
                  </p>
                  <ul class="mt-2 space-y-1">
                    @for (op of running(); track op.id) {
                      <li class="font-mono text-[12.5px] text-muted-foreground" data-testid="running-operation">
                        {{ op.operationType }}
                        @if (op.resourceName) {
                          · {{ op.resourceName }}
                        }
                        · {{ op.status }}
                        @if (op.progress !== null && op.progress !== undefined) {
                          · {{ op.progress }}%
                        }
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="m-0 text-sm text-muted-foreground">
                    Nothing is running under this permission. Revoking takes effect
                    immediately and leaves nothing behind.
                  </p>
                }
              </div>

              @if (running().length) {
                <label class="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-border"
                    [checked]="alsoStop()"
                    (change)="alsoStop.set(!alsoStop())"
                    data-testid="also-stop"
                  />
                  <span>
                    Also ask them to stop.
                    <span class="text-muted-foreground">
                      Honoured at the next step boundary and never mid-step — a
                      provisioning cut in half leaves paid-for resources behind.
                    </span>
                  </span>
                </label>
              }
            }

            @if (error(); as e) {
              <p class="m-0 text-sm text-destructive" data-testid="revoke-error">{{ e }}</p>
            }
          </div>

          <div class="flex justify-end gap-2 px-6 pb-6">
            <button hlmBtn variant="outline" size="sm" type="button" (click)="cancel.emit()">
              Keep it
            </button>
            @if (!loading()) {
              <button
                hlmBtn
                variant="destructive"
                size="sm"
                type="button"
                [disabled]="busy()"
                (click)="confirm.emit({ alsoStop: alsoStop() })"
                data-testid="confirm-revoke"
              >
                {{ confirmLabel() }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AgentRevokeDialogComponent {
  readonly concession = input.required<AgentConcession>();
  readonly running = input<ConcessionOperation[]>([]);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly cancel = output<void>();
  readonly confirm = output<{ alsoStop: boolean }>();

  protected readonly alsoStop = signal(false);

  protected readonly confirmLabel = computed(() =>
    this.alsoStop() ? 'Revoke and ask them to stop' : 'Revoke',
  );
}
