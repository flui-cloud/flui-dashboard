import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ScalingApiService } from '../../service/scaling-api.service';
import { SectionGroup } from '../../model/scaling-section.models';
import {
  ProvisionMode,
  WriteScalingGroup,
} from '../../model/scaling-group.models';
import { consequenceOf } from '../scaling-section/scaling-consequence';

/**
 * Sets up scaling for one cluster, or changes it. The figure being agreed to —
 * how large the cluster may become and how much it may spend unattended — is
 * on screen beside the fields, not behind a second click.
 */
@Component({
  selector: 'app-scaling-group-form',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 sm:p-8"
      (click)="close()"
    >
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="existing() ? 'Change scaling' : 'Set up scaling'"
        (click)="$event.stopPropagation()"
        class="card-surface flex max-h-full w-full max-w-4xl gap-5 overflow-y-auto p-6"
        data-testid="group-form"
      >
        <div class="flex flex-1 flex-col gap-5">
          <h3 class="m-0 text-lg font-semibold text-foreground">
            {{ existing() ? 'Change scaling' : 'Set up scaling' }}
          </h3>

          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 p-0 text-xs font-semibold text-foreground">
              Nodes
            </legend>
            <div class="flex flex-wrap items-end gap-3">
              @for (bound of bounds; track bound.role) {
                <div class="flex flex-col gap-1.5">
                  <label [attr.for]="bound.role" class="text-[11px] text-sub">{{
                    bound.label
                  }}</label>
                  <input
                    [id]="bound.role"
                    type="number"
                    min="0"
                    [ngModel]="draftBounds()[bound.role]"
                    (ngModelChange)="setBound(bound.role, $event)"
                    class="h-11 w-24 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground"
                  />
                </div>
              }
            </div>
            <p class="m-0 text-[11px] text-sub">
              Counted across every node, master included — the number shown on
              the page.
            </p>
          </fieldset>

          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 p-0 text-xs font-semibold text-foreground">
              When it acts
            </legend>
            @for (mode of modes; track mode.value) {
              <label
                [attr.for]="mode.value"
                class="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3"
                [class]="
                  provision() === mode.value
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-border'
                "
              >
                <input
                  [id]="mode.value"
                  type="radio"
                  name="provision"
                  class="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  [checked]="provision() === mode.value"
                  (change)="setProvision(mode.value)"
                />
                <span class="flex flex-col gap-0.5">
                  <span class="text-[13px] font-semibold text-foreground">{{
                    mode.label
                  }}</span>
                  <span class="text-xs leading-relaxed text-sub">{{
                    mode.help
                  }}</span>
                </span>
              </label>
            }
          </fieldset>

          @if (provision() === 'automatic') {
            <div class="flex flex-col gap-1.5">
              <label for="cap" class="text-xs font-semibold text-foreground"
                >Monthly cap</label
              >
              <div class="flex items-center gap-2.5">
                <input
                  id="cap"
                  type="number"
                  min="1"
                  [ngModel]="cap()"
                  (ngModelChange)="capEdit.set($event)"
                  class="h-11 w-32 rounded-lg border border-primary bg-card px-3 font-mono text-sm text-foreground"
                />
                <span class="text-[11px] font-semibold text-primary"
                  >Required while Flui buys</span
                >
              </div>
              <p class="m-0 text-[11px] text-sub">
                Flui will not cross it, and raises an alarm instead.
              </p>
            </div>
          }

          @if (problem(); as message) {
            <p
              class="m-0 text-sm text-red-600 dark:text-red-400"
              data-testid="form-error"
            >
              {{ message }}
            </p>
          }

          <div class="flex gap-2">
            <button
              type="button"
              (click)="save()"
              [disabled]="!!problem() || saving()"
              class="min-h-11 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="form-save"
            >
              {{ saving() ? 'Saving…' : existing() ? 'Save' : 'Turn it on' }}
            </button>
            <button
              type="button"
              (click)="close()"
              class="min-h-11 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>

        <aside
          class="w-80 shrink-0 rounded-xl border border-border bg-muted/40 p-5"
          data-testid="consequence"
        >
          <h4 class="m-0 mb-3 text-[13px] font-semibold text-foreground">
            {{
              provision() === 'automatic'
                ? 'What you are turning on'
                : 'What this does'
            }}
          </h4>
          <p class="m-0 text-[15px] leading-relaxed text-foreground">
            {{ consequence().sentence }}
          </p>
          <ul
            class="m-0 mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-sub"
          >
            @for (clause of consequence().clauses; track clause) {
              <li>{{ clause }}</li>
            }
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class ScalingGroupFormComponent {
  private readonly api = inject(ScalingApiService);

  readonly clusterId = input.required<string>();
  readonly existing = input<SectionGroup | null>(null);
  /** Seeds the ceiling and the floor when this cluster has no group yet. */
  readonly currentNodes = input<number>(1);
  readonly saved = output<SectionGroup>();
  readonly closed = output<void>();

  readonly bounds = [
    { role: 'min' as const, label: 'floor' },
    { role: 'desired' as const, label: 'target' },
    { role: 'max' as const, label: 'ceiling' },
  ];

  readonly modes: { value: ProvisionMode; label: string; help: string }[] = [
    {
      value: 'manual',
      label: 'Raise an alarm',
      help: 'Flui names the machine that would fit and waits for you.',
    },
    {
      value: 'automatic',
      label: 'Buy the node',
      help: 'Flui buys it when an app is stuck, and gives it back when the work fits without it.',
    },
  ];

  // Each field reads its seed until someone edits it, so the form is correct on
  // its first paint without writing to signals while rendering.
  private readonly boundsEdit = signal<Record<
    'min' | 'desired' | 'max',
    number
  > | null>(null);
  private readonly provisionEdit = signal<ProvisionMode | null>(null);
  readonly capEdit = signal<number | null>(null);
  readonly saving = signal(false);
  private readonly failure = signal<string | null>(null);

  private readonly seed = computed(() => {
    const group = this.existing();
    if (group) {
      return {
        bounds: { ...group.bounds },
        provision: group.provision,
        cap: group.limits.maxMonthlyCost,
      };
    }
    const nodes = this.currentNodes();
    return {
      bounds: { min: nodes, desired: nodes, max: nodes + 2 },
      provision: 'manual' as ProvisionMode,
      cap: null,
    };
  });

  readonly draftBounds = computed(
    () => this.boundsEdit() ?? this.seed().bounds,
  );
  readonly provision = computed(
    () => this.provisionEdit() ?? this.seed().provision,
  );
  readonly cap = computed(() => this.capEdit() ?? this.seed().cap);

  setBound(role: 'min' | 'desired' | 'max', value: number): void {
    this.boundsEdit.set({ ...this.draftBounds(), [role]: Number(value) });
  }

  setProvision(mode: ProvisionMode): void {
    this.provisionEdit.set(mode);
  }

  readonly body = computed<WriteScalingGroup>(() => ({
    name: this.existing()?.name ?? 'default',
    bounds: this.draftBounds(),
    provision: this.provision(),
    limits: {
      maxMonthlyCost:
        this.provision() === 'automatic' ? Number(this.cap()) : null,
    },
  }));

  readonly consequence = computed(() =>
    consequenceOf(this.body(), this.currentNodes()),
  );

  readonly problem = computed(() => {
    const saved = this.failure();
    if (saved) return saved;
    const { min, desired, max } = this.draftBounds();
    if (min < 1 || desired < 1 || max < 1)
      return 'A node count is at least one: every cluster holds its master.';
    if (max > 20) return 'A cluster may hold at most 20 nodes.';
    if (min > max) return 'The ceiling cannot be below the floor.';
    if (desired < min || desired > max)
      return 'The target sits between the floor and the ceiling.';
    if (this.provision() === 'automatic' && Number(this.cap()) <= 0) {
      return 'Set a monthly ceiling before letting Flui buy.';
    }
    return null;
  });

  async save(): Promise<void> {
    this.failure.set(null);
    this.saving.set(true);
    try {
      const group = this.existing();
      const written = await firstValueFrom(
        group
          ? this.api.updateGroup(group.id, this.body())
          : this.api.createGroup(this.clusterId(), this.body()),
      );
      this.saved.emit(written);
      this.close();
    } catch (error: unknown) {
      this.failure.set(this.readError(error));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }

  private readError(error: unknown): string {
    const body = (error as { error?: { message?: string | string[] } })?.error
      ?.message;
    if (Array.isArray(body)) return body.join('. ');
    if (typeof body === 'string') return body;
    return 'Scaling could not be saved.';
  }
}
