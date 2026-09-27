import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';

const MAX_FLEET_NODES = 20;

type Step =
  | { kind: 'idle' }
  | { kind: 'confirm'; to: number }
  | { kind: 'buy'; shape: string; region: string; price: string }
  | { kind: 'give-back'; node: string }
  | { kind: 'waiting'; says: string };

/**
 * The node count, and where a person asks for one node more or one fewer.
 * Nodes change only through the cluster's scaling group: + and − move its
 * floor, and a manual group then asks to approve the purchase or the removal.
 */
@Component({
  selector: 'app-scaling-fleet-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-surface p-4 flex flex-col gap-2 h-full" data-testid="tile-fleet">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-sub">Nodes</div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="ask(nodes() - 1)"
          [disabled]="!canRemove() || busy()"
          [title]="removeTooltip()"
          aria-label="One node fewer"
          data-testid="tile-fleet-minus"
          class="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true" class="text-base leading-none">&minus;</span>
        </button>

        <span class="text-2xl font-semibold tracking-tight text-foreground min-w-7 text-center" data-testid="tile-value-fleet">
          {{ nodes() }}
        </span>

        <button
          type="button"
          (click)="ask(nodes() + 1)"
          [disabled]="!canAdd() || busy()"
          [title]="addTooltip()"
          aria-label="One node more"
          data-testid="tile-fleet-plus"
          class="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true" class="text-base leading-none">+</span>
        </button>
      </div>

      @switch (step().kind) {
        @case ('confirm') {
          <div class="flex flex-col gap-1.5 text-[11px] leading-relaxed" data-testid="tile-fleet-confirm">
            <span>{{ confirmText() }}</span>
            <span class="flex gap-2">
              <button type="button" class="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="moveFloor()" data-testid="tile-fleet-confirm-yes">
                {{ busy() ? 'Saving…' : 'Confirm' }}
              </button>
              <button type="button" class="text-muted-foreground" [disabled]="busy()" (click)="reset()">Cancel</button>
            </span>
          </div>
        }
        @case ('buy') {
          <div class="flex flex-col gap-1.5 text-[11px] leading-relaxed" data-testid="tile-fleet-buy">
            <span>Buy one {{ buyStep()?.shape }} in {{ buyStep()?.region }}{{ buyStep()?.price }}? The group stays manual.</span>
            <span class="flex gap-2">
              <button type="button" class="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="buy()" data-testid="tile-fleet-buy-yes">
                {{ busy() ? 'Ordering…' : 'Buy' }}
              </button>
              <button type="button" class="text-muted-foreground" [disabled]="busy()" (click)="later()">Later</button>
            </span>
          </div>
        }
        @case ('give-back') {
          <div class="flex flex-col gap-1.5 text-[11px] leading-relaxed" data-testid="tile-fleet-give-back">
            <span>Drain and delete {{ giveBackStep()?.node }}? Its work moves to the nodes that stay.</span>
            <span class="flex gap-2">
              <button type="button" class="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="giveBack()" data-testid="tile-fleet-give-back-yes">
                {{ busy() ? 'Removing…' : 'Remove' }}
              </button>
              <button type="button" class="text-muted-foreground" [disabled]="busy()" (click)="later()">Later</button>
            </span>
          </div>
        }
        @case ('waiting') {
          <p class="m-0 text-[11px] leading-relaxed text-sub" data-testid="tile-fleet-waiting">{{ waitingText() }}</p>
        }
      }

      <p class="m-0 mt-auto text-[11px] leading-relaxed text-sub">{{ note() }}</p>
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class ScalingFleetTileComponent {
  private readonly api = inject(ScalingApiService);
  private readonly toast = inject(ToastService);

  /** The limits line, worded by the parent because only it knows where they come from. */
  readonly note = input<string>('');
  readonly row = input<ClusterScalingRow | null>(null);
  readonly changed = output<void>();

  protected readonly step = signal<Step>({ kind: 'idle' });
  protected readonly busy = signal(false);

  protected readonly nodes = computed(() => this.row()?.nodes ?? 0);
  private readonly groupId = computed(() => this.row()?.groupId ?? null);
  private readonly manual = computed(() => !this.row()?.acts);

  private readonly movable = computed(() => {
    const row = this.row();
    return !!row?.groupId && row.capability.canProvision;
  });

  protected readonly canAdd = computed(() => this.movable() && this.nodes() < MAX_FLEET_NODES);
  protected readonly canRemove = computed(() => this.movable() && this.nodes() > 1);

  protected readonly addTooltip = computed(() => this.tooltip('One node more'));
  protected readonly removeTooltip = computed(() =>
    this.nodes() <= 1 ? 'Only the master is left: it cannot be given back' : this.tooltip('One node fewer'),
  );

  protected readonly buyStep = computed(() => {
    const s = this.step();
    return s.kind === 'buy' ? s : null;
  });

  protected readonly giveBackStep = computed(() => {
    const s = this.step();
    return s.kind === 'give-back' ? s : null;
  });

  protected readonly waitingText = computed(() => {
    const s = this.step();
    return s.kind === 'waiting' ? s.says : '';
  });

  protected readonly confirmText = computed(() => {
    const s = this.step();
    if (s.kind !== 'confirm') return '';
    const more = s.to > this.nodes();
    const head = `Hold ${s.to} ${s.to === 1 ? 'node' : 'nodes'}, master included.`;
    if (!this.manual()) {
      return more
        ? `${head} The group buys the machine on its own, within its ceilings.`
        : `${head} The group gives one node back on its own once it can be emptied.`;
    }
    return more
      ? `${head} This group is manual: you approve the machine and its price next.`
      : `${head} This group is manual: you approve which node goes next.`;
  });

  private tooltip(action: string): string {
    const row = this.row();
    if (!row) return action;
    if (!row.capability.canProvision)
      return 'Flui cannot buy on this provider: attach your own machine with `flui node connect`, or detach one from the Nodes tab';
    if (!row.groupId) return 'This cluster has no scaling group yet';
    return action;
  }

  protected ask(to: number): void {
    this.step.set({ kind: 'confirm', to });
  }

  protected reset(): void {
    this.step.set({ kind: 'idle' });
  }

  protected later(): void {
    this.step.set({
      kind: 'waiting',
      says: 'Nothing bought or removed. The proposal stays on the group’s Now tab.',
    });
  }

  protected async moveFloor(): Promise<void> {
    const s = this.step();
    const groupId = this.groupId();
    if (s.kind !== 'confirm' || !groupId) return;
    const more = s.to > this.nodes();
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.api.setFloor(groupId, s.to));
      this.changed.emit();
      if (saved.acts.acts) {
        this.step.set({ kind: 'waiting', says: saved.acts.says });
        return;
      }
      await this.nextApproval(groupId, more);
    } catch (err: unknown) {
      this.fail('Nothing changed', err);
      this.reset();
    } finally {
      this.busy.set(false);
    }
  }

  private async nextApproval(groupId: string, more: boolean): Promise<void> {
    const preview = await firstValueFrom(this.api.preview(groupId));
    const chosen = preview.chosen;
    if (more && chosen?.shape && chosen.region) {
      const price = chosen.hourlyEur === null ? '' : ` at €${chosen.hourlyEur}/h`;
      this.step.set({ kind: 'buy', shape: chosen.shape, region: chosen.region, price });
      return;
    }
    if (!more && preview.giveBack && !preview.giveBack.onItsOwn) {
      this.step.set({ kind: 'give-back', node: preview.giveBack.node });
      return;
    }
    this.step.set({
      kind: 'waiting',
      says:
        preview.blocked?.headline ??
        'The group proposes nothing yet. Its Now tab says why.',
    });
  }

  protected async buy(): Promise<void> {
    const s = this.step();
    const groupId = this.groupId();
    if (s.kind !== 'buy' || !groupId) return;
    await this.approve(
      () => firstValueFrom(this.api.approvePurchase(groupId, { shape: s.shape, region: s.region })),
      'Purchase ordered',
      'Nothing bought',
    );
  }

  protected async giveBack(): Promise<void> {
    const s = this.step();
    const groupId = this.groupId();
    if (s.kind !== 'give-back' || !groupId) return;
    await this.approve(
      () => firstValueFrom(this.api.approveRemoval(groupId, s.node)),
      'Node being given back',
      'Nothing removed',
    );
  }

  private async approve(call: () => Promise<{ did: string }>, done: string, failed: string): Promise<void> {
    this.busy.set(true);
    try {
      const decision = await call();
      this.toast.showSuccess({ title: done, message: decision.did });
      this.step.set({ kind: 'waiting', says: decision.did });
      this.changed.emit();
    } catch (err: unknown) {
      const reason = this.fail(failed, err);
      this.step.set({
        kind: 'waiting',
        says: reason || 'Nothing bought or removed. The proposal stays on the group’s Now tab.',
      });
    } finally {
      this.busy.set(false);
    }
  }

  private fail(title: string, err: unknown): string {
    const e = err as { error?: { message?: string | string[] }; message?: string };
    const raw = e?.error?.message ?? e?.message ?? '';
    const message = Array.isArray(raw) ? raw.join(' ') : raw;
    this.toast.showError({ title, message });
    return message;
  }
}

