import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackupsService } from '../../../core/api/api/backups.service';
import { DecisionSource, decisionPanel } from './app-backup-decision';

/**
 * The top of the Backup tab while an app holding data is not protected: why,
 * and the two ways out — protect it, or decide it is not backed up.
 */
@Component({
  selector: 'app-backup-decision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    @if (panel(); as p) {
      <section
        class="card-surface p-4 space-y-2 border"
        [class]="p.state === 'unprotected' ? 'border-amber-200 dark:border-amber-800' : 'border-border'"
        data-testid="backup-decision"
      >
        @if (p.state === 'unprotected') {
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold">Not backed up</h2>
              @if (p.why) {
                <p class="text-xs text-muted-foreground" data-testid="backup-decision-why">{{ p.why }}</p>
              }
            </div>
            @if (!confirming()) {
              <div class="flex shrink-0 flex-wrap gap-2">
                @if (p.protectPath) {
                  <button
                    type="button"
                    (click)="protect.emit()"
                    class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    data-testid="backup-decision-protect"
                  >Protect</button>
                }
                <button
                  type="button"
                  (click)="confirming.set(true)"
                  class="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                  data-testid="backup-decision-skip"
                >Don't back up this app</button>
              </div>
            }
          </div>
          @if (confirming()) {
            <div class="flex flex-wrap items-center gap-2" data-testid="backup-decision-confirm">
              <input
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
                maxlength="500"
                placeholder="Why (optional)"
                aria-label="Why this app is not backed up"
                class="h-8 min-w-0 flex-1 px-2 rounded-md border border-input bg-background text-xs"
              />
              <button
                type="button"
                (click)="decide(true)"
                [disabled]="saving()"
                class="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                data-testid="backup-decision-confirm-skip"
              >{{ saving() ? 'Saving…' : "Don't back up" }}</button>
              <button type="button" (click)="cancel()" class="px-3 py-1.5 text-xs rounded-md hover:bg-muted">Cancel</button>
            </div>
            <p class="text-xs text-muted-foreground">Flui stops asking for a backup. Nothing already taken is deleted.</p>
          }
        } @else {
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <h2 class="text-sm font-semibold">Not backed up by choice</h2>
              @if (p.note) {
                <p class="text-sm" data-testid="backup-decision-note">{{ p.note }}</p>
              }
              <p class="text-xs text-muted-foreground">{{ p.by }}</p>
              @if (p.running.length) {
                <p class="text-xs text-muted-foreground" data-testid="backup-decision-running">
                  Still running:
                  @for (pol of p.running; track pol.path; let last = $last) {
                    <a [routerLink]="pol.path" class="text-primary hover:underline">{{ pol.name }}</a>{{ last ? '' : ', ' }}
                  }
                  — pause it there if you want.
                </p>
              }
            </div>
            <button
              type="button"
              (click)="decide(false)"
              [disabled]="saving()"
              class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted disabled:opacity-50"
              data-testid="backup-decision-undo"
            >{{ saving() ? 'Saving…' : 'Back up again' }}</button>
          </div>
        }
        @if (failure(); as f) {
          <p class="text-xs text-red-600">{{ f }}</p>
        }
      </section>
    }
  `,
})
export class AppBackupDecisionComponent {
  private readonly api = inject(BackupsService);

  readonly appId = input<string | null>(null);
  readonly protection = input<DecisionSource | null>(null);
  /** The decision was stored: the protection above needs reading again. */
  readonly changed = output<void>();
  /** Protect asked for: the card below sets it up. */
  readonly protect = output<void>();

  protected readonly panel = computed(() => decisionPanel(this.protection()));
  protected readonly confirming = signal(false);
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected cancel(): void {
    this.confirming.set(false);
    this.note.set('');
  }

  protected async decide(notBackedUp: boolean): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.saving.set(true);
    this.failure.set(null);
    const note = this.note().trim();
    try {
      await firstValueFrom(
        this.api.appProtectionControllerSetBackupDecision(id, {
          notBackedUp,
          ...(notBackedUp && note ? { note } : {}),
        }),
      );
      this.cancel();
      this.changed.emit();
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not save the decision');
    } finally {
      this.saving.set(false);
    }
  }
}
