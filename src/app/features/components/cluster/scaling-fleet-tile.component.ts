import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideMinus, lucidePlus } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterScalingRow, RemovalPreview } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { RemovalPreviewNoteComponent } from '../scaling-section/removal-preview-note.component';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

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
  imports: [RemovalPreviewNoteComponent, FlButton, FlIcon],
  providers: [provideIcons({ lucideMinus, lucidePlus })],
  host: { class: 'fl-metric', 'data-testid': 'tile-fleet' },
  template: `
    <span class="fl-metric__label">Nodes</span>
    <span class="fl-metric__value">
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        (click)="ask(lowerTo())"
        [disabled]="!canRemove() || busy()"
        [title]="removeTooltip()"
        aria-label="One node fewer"
        data-testid="tile-fleet-minus"
      >
        <fl-icon name="lucideMinus" />
      </button>
      <span class="min-w-7 text-center" data-testid="tile-value-fleet">{{ nodes() }}</span>
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        (click)="ask(nodes() + 1)"
        [disabled]="!canAdd() || busy()"
        [title]="addTooltip()"
        aria-label="One node more"
        data-testid="tile-fleet-plus"
      >
        <fl-icon name="lucidePlus" />
      </button>
    </span>

    @switch (step().kind) {
      @case ('confirm') {
        <div class="flex flex-col gap-2 text-fl-body-sm" data-testid="tile-fleet-confirm">
          <span>{{ confirmText() }}</span>
          @if (removal(); as preview) {
            <app-removal-preview-note [preview]="preview" />
          } @else if (removalLoading()) {
            <span class="text-fl-ink-muted">Checking which node would go and what runs on it…</span>
          }
          <span class="fl-row">
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="moveFloor()"
              data-testid="tile-fleet-confirm-yes"
            >
              {{ busy() ? 'Saving…' : 'Confirm' }}
            </button>
            <button flButton="ghost" size="sm" type="button" [disabled]="busy()" (click)="reset()">
              Cancel
            </button>
          </span>
        </div>
      }
      @case ('buy') {
        <div class="flex flex-col gap-2 text-fl-body-sm" data-testid="tile-fleet-buy">
          <span
            >Add one {{ buyStep()?.shape }} in {{ buyStep()?.region }}{{ buyStep()?.price }}? The
            group stays manual.</span
          >
          <span class="fl-row">
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="buy()"
              data-testid="tile-fleet-buy-yes"
            >
              {{ busy() ? 'Adding…' : 'Add' }}
            </button>
            <button flButton="ghost" size="sm" type="button" [disabled]="busy()" (click)="later()">
              Later
            </button>
          </span>
        </div>
      }
      @case ('give-back') {
        <div class="flex flex-col gap-2 text-fl-body-sm" data-testid="tile-fleet-give-back">
          <span
            >Drain and delete {{ giveBackStep()?.node }}? Its work moves to the nodes that
            stay.</span
          >
          <span class="fl-row">
            <button
              flButton="danger"
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="giveBack()"
              data-testid="tile-fleet-give-back-yes"
            >
              {{ busy() ? 'Removing…' : 'Remove' }}
            </button>
            <button flButton="ghost" size="sm" type="button" [disabled]="busy()" (click)="later()">
              Later
            </button>
          </span>
        </div>
      }
      @case ('waiting') {
        <span class="text-fl-body-sm text-fl-ink-muted" data-testid="tile-fleet-waiting">
          {{ waitingText() }}
        </span>
      }
    }

    @if (note()) {
      <span class="fl-metric__caption">{{ note() }}</span>
    }
  `,
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
  /** Which node one fewer gives back and what runs on it, read before the person confirms. */
  protected readonly removal = signal<RemovalPreview | null>(null);
  protected readonly removalLoading = signal(false);

  protected readonly nodes = computed(() => this.row()?.nodes ?? 0);
  private readonly groupId = computed(() => this.row()?.groupId ?? null);
  private readonly manual = computed(() => !this.row()?.acts);

  private readonly movable = computed(() => {
    const row = this.row();
    return !!row?.groupId && row.capability.canProvision;
  });

  protected readonly canAdd = computed(() => this.movable() && this.nodes() < MAX_FLEET_NODES);
  /** A floor above the fleet comes back down to it first: that undoes a + nobody bought yet. */
  protected readonly lowerTo = computed(() => {
    const floor = this.row()?.bounds?.min ?? this.nodes();
    return floor > this.nodes() ? this.nodes() : this.nodes() - 1;
  });

  protected readonly canRemove = computed(() => this.movable() && this.lowerTo() >= 1);

  /** The fleet and floor last looked at, so a reload re-offers a pending approval once and no more. */
  private offeredFor: string | null = null;

  constructor() {
    effect(() => {
      const row = this.row();
      if (!row?.groupId || row.acts || !row.bounds) return;
      const floor = row.bounds.min;
      if (row.nodes === floor) return;
      const key = `${row.groupId}:${row.nodes}:${floor}`;
      if (key === this.offeredFor) return;
      this.offeredFor = key;
      untracked(() => void this.resumeApproval(row.groupId as string, row.nodes < floor));
    });
  }

  /** Re-offers, after a reload, the approval the group is waiting on and nothing else. */
  private async resumeApproval(groupId: string, more: boolean): Promise<void> {
    if (this.step().kind !== 'idle') return;
    try {
      const preview = await firstValueFrom(this.api.preview(groupId));
      if (this.step().kind !== 'idle') return;
      const chosen = preview.chosen;
      if (more && chosen?.shape && chosen.region) {
        const price = chosen.hourlyEur === null ? '' : ` at €${formatHourly(chosen.hourlyEur)}/h`;
        this.step.set({ kind: 'buy', shape: chosen.shape, region: chosen.region, price });
      } else if (!more && preview.giveBack && !preview.giveBack.onItsOwn) {
        this.step.set({ kind: 'give-back', node: preview.giveBack.node });
      }
    } catch {
      return;
    }
  }

  protected readonly addTooltip = computed(() => this.tooltip('One node more'));
  protected readonly removeTooltip = computed(() => {
    if (this.lowerTo() < 1) {
      return 'Only the master is left: it cannot be removed';
    }
    return this.tooltip(
      this.lowerTo() === this.nodes() ? 'Back to the nodes the cluster has' : 'One node fewer',
    );
  });

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
    if (s.to === this.nodes())
      return `${head} Nothing is added or removed: the + not yet acted on is undone.`;
    if (!this.manual()) {
      return more
        ? `${head} The group adds the machine on its own, within its ceilings.`
        : `${head} The group removes one node on its own once it can be emptied.`;
    }
    return more
      ? `${head} This group is manual: you approve the machine and its price next.`
      : `${head} This group is manual: you approve which node goes next.`;
  });

  private tooltip(action: string): string {
    const row = this.row();
    if (!row) return action;
    if (!row.capability.canProvision)
      return 'Flui cannot add nodes on this provider: attach your own machine with `flui node connect`, or detach one from the Nodes tab';
    if (!row.groupId) return 'This cluster has no scaling group yet';
    return action;
  }

  protected ask(to: number): void {
    this.step.set({ kind: 'confirm', to });
    this.removal.set(null);
    const groupId = this.groupId();
    if (groupId && to < this.nodes()) void this.readRemoval(groupId, to);
  }

  private async readRemoval(groupId: string, to: number): Promise<void> {
    this.removalLoading.set(true);
    try {
      const preview = await firstValueFrom(
        this.api.removalPreview(groupId, { min: to, desired: to }),
      );
      const s = this.step();
      if (s.kind === 'confirm' && s.to === to) this.removal.set(preview);
    } catch {
      return;
    } finally {
      this.removalLoading.set(false);
    }
  }

  protected reset(): void {
    this.step.set({ kind: 'idle' });
    this.removal.set(null);
  }

  protected later(): void {
    this.step.set({
      kind: 'waiting',
      says: 'Nothing added or removed. The proposal stays on the group’s Now tab.',
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
      if (s.to === this.nodes()) {
        this.step.set({
          kind: 'waiting',
          says: `Back to ${s.to} ${s.to === 1 ? 'node' : 'nodes'}. Nothing added or removed.`,
        });
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
      const price = chosen.hourlyEur === null ? '' : ` at €${formatHourly(chosen.hourlyEur)}/h`;
      this.step.set({ kind: 'buy', shape: chosen.shape, region: chosen.region, price });
      return;
    }
    if (!more && preview.giveBack && !preview.giveBack.onItsOwn) {
      this.step.set({ kind: 'give-back', node: preview.giveBack.node });
      return;
    }
    this.step.set({
      kind: 'waiting',
      says: preview.blocked?.headline ?? 'The group proposes nothing yet. Its Now tab says why.',
    });
  }

  protected async buy(): Promise<void> {
    const s = this.step();
    const groupId = this.groupId();
    if (s.kind !== 'buy' || !groupId) return;
    await this.approve(
      () => firstValueFrom(this.api.approvePurchase(groupId, { shape: s.shape, region: s.region })),
      'Node being added',
      'Nothing added',
    );
  }

  protected async giveBack(): Promise<void> {
    const s = this.step();
    const groupId = this.groupId();
    if (s.kind !== 'give-back' || !groupId) return;
    await this.approve(
      () => firstValueFrom(this.api.approveRemoval(groupId, s.node)),
      'Node being removed',
      'Nothing removed',
    );
  }

  private async approve(
    call: () => Promise<{ did: string }>,
    done: string,
    failed: string,
  ): Promise<void> {
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
        says: reason || 'Nothing added or removed. The proposal stays on the group’s Now tab.',
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

function formatHourly(eur: number): string {
  return Number(eur.toFixed(4)).toString();
}
