import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ScalingApiService } from '../../service/scaling-api.service';
import { SectionGroup } from '../../model/scaling-section.models';
import { ProvisionMode, WriteScalingGroup } from '../../model/scaling-group.models';
import { consequenceOf } from '../scaling-section/scaling-consequence';
import { GroupCostComponent } from '../scaling-section/group-cost.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-scaling-group-form',
  imports: [FormsModule, GroupCostComponent, FlAlert, FlField, FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  host: { class: 'contents', '(document:keydown.escape)': 'close()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      (click)="close()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scaling-group-title"
        (click)="$event.stopPropagation()"
        data-testid="group-form"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="scaling-group-title">
            {{ existing() ? 'Change scaling' : 'Set up scaling' }}
          </h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="close()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-5">
            <div class="flex flex-col gap-5 md:col-span-3">
              <fieldset class="fl-fieldset">
                <legend>Nodes</legend>
                <div class="grid grid-cols-3 gap-3">
                  @for (bound of bounds; track bound.role) {
                    <fl-field [label]="bound.label" [for]="bound.role">
                      <div class="fl-input fl-input--lg">
                        <input
                          [id]="bound.role"
                          type="number"
                          min="0"
                          class="fl-mono"
                          [ngModel]="draftBounds()[bound.role]"
                          (ngModelChange)="setBound(bound.role, $event)"
                        />
                      </div>
                    </fl-field>
                  }
                </div>
                <p class="m-0 text-fl-caption text-fl-ink-muted">
                  Counted across every node, master included: the number shown on the page.
                </p>
              </fieldset>

              <fieldset class="fl-fieldset">
                <legend>When it acts</legend>
                @for (mode of modes; track mode.value) {
                  <label class="fl-radiocard" [attr.for]="mode.value">
                    <input
                      [id]="mode.value"
                      type="radio"
                      name="provision"
                      [checked]="provision() === mode.value"
                      (change)="setProvision(mode.value)"
                    />
                    <span class="fl-radiocard__text">
                      <span class="fl-radiocard__title">{{ mode.label }}</span>
                      <span class="fl-radiocard__desc">{{ mode.help }}</span>
                    </span>
                  </label>
                }
              </fieldset>

              @if (provision() === 'automatic') {
                <fl-field
                  label="Spending ceiling (€ a month)"
                  for="cap"
                  hint="Required while Flui adds nodes. The safety net under the node limits: Flui never passes it, and raises an alarm instead."
                >
                  <div class="fl-input fl-input--lg w-32">
                    <input
                      id="cap"
                      type="number"
                      min="1"
                      class="fl-mono"
                      [ngModel]="cap()"
                      (ngModelChange)="capEdit.set($event)"
                    />
                  </div>
                </fl-field>
              }

              <app-group-cost
                [clusterId]="clusterId()"
                [draft]="costDraft()"
                [needsCeiling]="needsCeiling()"
                (useCeiling)="capEdit.set($event)"
              />
            </div>

            <aside
              class="flex flex-col gap-3 self-start rounded-fl-lg border border-fl-border bg-fl-surface-subtle p-4 md:col-span-2"
              data-testid="consequence"
            >
              <h3 class="m-0 text-fl-body-sm font-semibold">
                {{ provision() === 'automatic' ? 'What you are turning on' : 'What this does' }}
              </h3>
              <p class="m-0 text-fl-body">{{ consequence().sentence }}</p>
              <ul class="m-0 flex list-disc flex-col gap-1 pl-4 text-fl-body-sm text-fl-ink-muted">
                @for (clause of consequence().clauses; track clause) {
                  <li>{{ clause }}</li>
                }
              </ul>
            </aside>
          </div>

          @if (problem(); as message) {
            <fl-alert tone="error" title="Cannot save this scaling" data-testid="form-error">
              {{ message }}
            </fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="close()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            (click)="save()"
            [disabled]="!!problem() || saving()"
            data-testid="form-save"
          >
            {{ saving() ? 'Saving…' : existing() ? 'Save' : 'Turn it on' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ScalingGroupFormComponent {
  private readonly api = inject(ScalingApiService);

  readonly clusterId = input.required<string>();
  readonly existing = input<SectionGroup | null>(null);
  /** Seeds the node limits when this cluster has no group yet. */
  readonly currentNodes = input<number>(1);
  readonly saved = output<SectionGroup>();
  readonly closed = output<void>();

  readonly bounds = [
    { role: 'min' as const, label: 'Min nodes' },
    { role: 'desired' as const, label: 'Target' },
    { role: 'max' as const, label: 'Max nodes' },
  ];

  readonly modes: { value: ProvisionMode; label: string; help: string }[] = [
    {
      value: 'manual',
      label: 'Raise an alarm',
      help: 'Flui names the machine that would fit and waits for you.',
    },
    {
      value: 'automatic',
      label: 'Add the node',
      help: 'Flui adds it when an app is stuck, and removes it when the work fits without it. Each node added is a server billed by the provider.',
    },
  ];

  private readonly boundsEdit = signal<Record<'min' | 'desired' | 'max', number> | null>(null);
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

  readonly draftBounds = computed(() => this.boundsEdit() ?? this.seed().bounds);
  readonly provision = computed(() => this.provisionEdit() ?? this.seed().provision);
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
      maxMonthlyCost: this.provision() === 'automatic' ? Number(this.cap()) : null,
    },
  }));

  readonly costDraft = computed(() => {
    const { min, max } = this.draftBounds();
    if (min < 1 || max > 20 || min > max) return null;
    const cap = this.cap();
    return {
      bounds: { min, max },
      maxMonthlyCost: cap ? Number(cap) : null,
    };
  });

  readonly needsCeiling = computed(
    () => this.provision() === 'automatic' && !isPositiveAmount(this.cap()),
  );

  readonly consequence = computed(() => consequenceOf(this.body(), this.currentNodes()));

  readonly problem = computed(() => {
    const saved = this.failure();
    if (saved) return saved;
    const { min, desired, max } = this.draftBounds();
    if (min < 1 || desired < 1 || max < 1)
      return 'A node count is at least one: every cluster holds its master.';
    if (min > 20 || desired > 20 || max > 20)
      return 'A cluster may hold at most 20 nodes, master included.';
    if (min > max) return 'Max nodes cannot be below min nodes.';
    if (desired < min || desired > max) return 'The target sits between min and max nodes.';
    if (this.provision() === 'automatic' && !isPositiveAmount(this.cap())) {
      return 'Adding nodes automatically needs a spending ceiling, the safety net under the node limits.';
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
    const body = (error as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(body)) return body.join('. ');
    if (typeof body === 'string') return body;
    return 'Scaling could not be saved.';
  }
}

function isPositiveAmount(value: unknown): boolean {
  return Number(value) > 0;
}
