import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackupsService } from '../../../core/api/api/backups.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { DecisionSource, decisionPanel } from './app-backup-decision';
import { coverageReasonState } from './backup-protection-state';

/**
 * The top of the Backup tab while an app holding data is not protected: why,
 * and the two ways out — protect it, or decide it is not backed up.
 */
@Component({
  selector: 'app-backup-decision',
  imports: [FormsModule, RouterLink, FlPanel, FlAlert, FlStatus, FlButton],
  host: { class: 'block' },
  template: `
    @if (panel(); as p) {
      <fl-panel title="Backup protection" data-testid="backup-decision">
        <div panelActions class="fl-row">
          @if (p.state === 'unprotected' && !confirming()) {
            @if (p.protectPath) {
              <button
                flButton="primary"
                size="sm"
                type="button"
                (click)="protect.emit()"
                data-testid="backup-decision-protect"
              >
                Protect
              </button>
            }
            <button
              flButton
              size="sm"
              type="button"
              (click)="confirming.set(true)"
              data-testid="backup-decision-skip"
            >
              Don't back up this app
            </button>
          } @else if (p.state === 'decided') {
            <button
              flButton
              size="sm"
              type="button"
              (click)="decide(false)"
              [disabled]="saving()"
              data-testid="backup-decision-undo"
            >
              {{ saving() ? 'Saving…' : 'Back up again' }}
            </button>
          }
        </div>
        <div class="flex flex-col gap-3">
          @if (p.state === 'unprotected') {
            <div class="flex flex-col gap-1">
              <fl-status [tone]="reasonState().tone" [label]="reasonState().label" />
              @if (p.why) {
                <p class="text-fl-body-sm text-fl-ink-muted" data-testid="backup-decision-why">
                  {{ p.why }}
                </p>
              }
            </div>
            @if (confirming()) {
              <div class="flex flex-wrap items-center gap-2" data-testid="backup-decision-confirm">
                <div class="fl-input min-w-0 flex-1">
                  <input
                    [ngModel]="note()"
                    (ngModelChange)="note.set($event)"
                    maxlength="500"
                    placeholder="Why (optional)"
                    aria-label="Why this app is not backed up"
                  />
                </div>
                <button
                  flButton="primary"
                  size="sm"
                  type="button"
                  (click)="decide(true)"
                  [disabled]="saving()"
                  data-testid="backup-decision-confirm-skip"
                >
                  {{ saving() ? 'Saving…' : "Don't back up" }}
                </button>
                <button flButton="ghost" size="sm" type="button" (click)="cancel()">Cancel</button>
              </div>
              <p class="text-fl-caption text-fl-ink-muted">
                Flui stops asking for a backup. Nothing already taken is deleted.
              </p>
            }
          } @else {
            <div class="flex flex-col gap-1">
              <fl-status tone="neutral" label="Not backed up by choice" />
              @if (p.note) {
                <p data-testid="backup-decision-note">{{ p.note }}</p>
              }
              <p class="text-fl-caption text-fl-ink-muted">{{ p.by }}</p>
              @if (p.running.length) {
                <p class="text-fl-body-sm text-fl-ink-muted" data-testid="backup-decision-running">
                  Still running:
                  @for (pol of p.running; track pol.path; let last = $last) {
                    <a [routerLink]="pol.path" class="fl-link">{{ pol.name }}</a>{{
                      last ? '.' : ', '
                    }}
                  }
                  Pause it there if you want.
                </p>
              }
            </div>
          }
          @if (failure(); as f) {
            <fl-alert tone="error" title="Decision not saved">{{ f }}</fl-alert>
          }
        </div>
      </fl-panel>
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
  protected readonly reasonState = computed(() =>
    coverageReasonState(this.protection()?.coverage?.reason ?? ''),
  );
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
