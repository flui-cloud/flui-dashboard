import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AppRuntimeService,
  ResourceProposal,
} from '../../service/app-runtime.service';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { AppMaintenance, MaintenanceService, openingLabel } from '../../service/maintenance.service';
import { ToastService } from '../../../shared/services/toast.service';

/**
 * The memory change Flui proposes, applied only when a person presses Apply.
 */
@Component({
  selector: 'app-resource-proposal',
  standalone: true,
  imports: [ExplainComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (proposal(); as p) {
      <section
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
        data-testid="resource-proposal"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <app-explain
              label="Flui proposes more memory"
              labelClass="text-sm font-semibold text-amber-900 dark:text-amber-200"
              testid="proposal-why"
            >
              @for (r of p.reasons; track r.kind) {
                <span class="block">{{ r.sentence }}</span>
              }
              <span class="mt-1 block">{{ p.restart }}</span>
              @if (p.configurationNote) {
                <span class="mt-1 block">{{ p.configurationNote }}</span>
              }
            </app-explain>
            <p class="m-0 font-mono text-[13px] text-gray-800 dark:text-gray-200" data-testid="proposal-values">
              memory
              @if (p.consequence.requests.memory !== p.currentRequests.memory) {
                {{ p.currentRequests.memory ?? '—' }} → {{ p.consequence.requests.memory ?? '—' }} reserved
              } @else {
                {{ p.currentRequests.memory ?? '—' }} reserved
              }
              ·
              @if (p.consequence.limits.memory !== p.currentLimits.memory) {
                {{ p.currentLimits.memory ?? '—' }} → {{ p.consequence.limits.memory ?? '—' }} at most
              } @else {
                {{ p.currentLimits.memory ?? '—' }} at most
              }
            </p>
            <p class="m-0 text-[12px] text-gray-600 dark:text-gray-400">{{ p.consequence.placement.sentence }}</p>
          </div>
          <div class="flex items-center gap-2">
            @if (confirming()) {
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-amber-100 dark:text-gray-300 dark:hover:bg-amber-900/40"
                (click)="confirming.set(false)"
              >Cancel</button>
              <button
                type="button"
                class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                [disabled]="applying() || !!p.consequence.problem"
                (click)="apply(p)"
                data-testid="proposal-confirm"
              >{{ applying() ? 'Applying…' : 'Apply and restart' }}</button>
              <button
                type="button"
                class="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-200"
                [disabled]="applying() || !!p.consequence.problem || !window()?.nextOpening || window()?.mode === 'anytime'"
                [title]="window()?.nextOpening ? '' : (window()?.says ?? '')"
                (click)="defer()"
                data-testid="proposal-defer"
              >At next window{{ window()?.nextOpening && window()?.mode !== 'anytime' ? ' (' + label(window()!.nextOpening) + ')' : '' }}</button>
            } @else {
              <button
                type="button"
                class="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-200"
                (click)="confirming.set(true)"
                data-testid="proposal-apply"
              >Apply</button>
            }
          </div>
        </div>
      </section>
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
        void this.maintenance.app(id).then((w) => this.appId() === id && this.window.set(w)).catch(() => undefined);
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
