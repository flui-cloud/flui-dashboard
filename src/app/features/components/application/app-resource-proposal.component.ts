import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AppRuntimeService, ResourceProposal } from '../../service/app-runtime.service';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import {
  AppMaintenance,
  MaintenanceService,
  openingLabel,
} from '../../service/maintenance.service';
import { ToastService } from '../../../shared/services/toast.service';

/**
 * The memory change Flui proposes, applied only when a person presses Apply.
 */
@Component({
  selector: 'app-resource-proposal',
  standalone: true,
  imports: [ExplainComponent, FlAlert, FlButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (proposal(); as p) {
      <fl-alert tone="warning" title="Flui proposes more memory" data-testid="resource-proposal">
        <span class="block fl-mono" data-testid="proposal-values">
          Memory
          @if (p.consequence.requests.memory !== p.currentRequests.memory) {
            {{ p.currentRequests.memory ?? '—' }} → {{ p.consequence.requests.memory ?? '—' }}
            reserved,
          } @else {
            {{ p.currentRequests.memory ?? '—' }} reserved,
          }
          @if (p.consequence.limits.memory !== p.currentLimits.memory) {
            {{ p.currentLimits.memory ?? '—' }} → {{ p.consequence.limits.memory ?? '—' }} at most
          } @else {
            {{ p.currentLimits.memory ?? '—' }} at most
          }
        </span>
        <span class="mt-1 block">{{ p.consequence.placement.sentence }}</span>
        <span class="mt-1 block">
          <app-explain label="Why" labelClass="text-fl-body-sm font-medium" testid="proposal-why">
            @for (r of p.reasons; track r.kind) {
              <span class="block">{{ r.sentence }}</span>
            }
            <span class="mt-1 block">{{ p.restart }}</span>
            @if (p.configurationNote) {
              <span class="mt-1 block">{{ p.configurationNote }}</span>
            }
          </app-explain>
        </span>
        <ng-container alertActions>
          @if (confirming()) {
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="applying() || !!p.consequence.problem"
              (click)="apply(p)"
              data-testid="proposal-confirm"
            >
              {{ applying() ? 'Applying…' : 'Apply and restart' }}
            </button>
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="
                applying() ||
                !!p.consequence.problem ||
                !window()?.nextOpening ||
                window()?.mode === 'anytime'
              "
              [attr.title]="window()?.nextOpening ? null : (window()?.says ?? null)"
              (click)="defer()"
              data-testid="proposal-defer"
            >
              At next window{{
                window()?.nextOpening && window()?.mode !== 'anytime'
                  ? ' (' + label(window()!.nextOpening) + ')'
                  : ''
              }}
            </button>
            <button flButton="ghost" size="sm" type="button" (click)="confirming.set(false)">
              Cancel
            </button>
          } @else {
            <button
              flButton
              size="sm"
              type="button"
              (click)="confirming.set(true)"
              data-testid="proposal-apply"
            >
              Apply
            </button>
          }
        </ng-container>
      </fl-alert>
    }
  `,
})
export class AppResourceProposalComponent {
  readonly appId = input<string | null>(null);
  /** A change was held for the maintenance window. */
  readonly deferred = output<void>();
  private readonly runtime = inject(AppRuntimeService);
  private readonly maintenance = inject(MaintenanceService);
  private readonly toast = inject(ToastService);

  protected readonly window = signal<AppMaintenance | null>(null);
  protected label = openingLabel;

  protected readonly proposal = signal<ResourceProposal | null>(null);
  protected readonly confirming = signal(false);
  protected readonly applying = signal(false);

  constructor() {
    effect(() => {
      const id = this.appId();
      this.proposal.set(null);
      this.window.set(null);
      if (id) {
        void this.load(id);
        void this.maintenance
          .app(id)
          .then((w) => this.appId() === id && this.window.set(w))
          .catch(() => undefined);
      }
    });
  }

  private async load(appId: string): Promise<void> {
    try {
      const answer = await this.runtime.proposal(appId);
      if (this.appId() === appId) this.proposal.set(answer.proposal);
    } catch {
      this.proposal.set(null);
    }
  }

  protected async defer(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.applying.set(true);
    const held = await this.maintenance.deferProposal(id);
    this.applying.set(false);
    this.confirming.set(false);
    if (held) {
      this.toast.showSuccess({
        title: 'Held for the maintenance window',
        message: `It runs ${openingLabel(held.runAt)}; Flui reads the evidence again then.`,
      });
      this.deferred.emit();
    }
  }

  protected async apply(p: ResourceProposal): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.applying.set(true);
    const answer = await this.runtime.applyProposal(id, p);
    this.applying.set(false);
    this.confirming.set(false);
    if (answer) this.proposal.set(answer.proposal);
  }
}
