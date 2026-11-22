import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideClock, lucideX } from '@ng-icons/lucide';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { GroupChoicesService } from './group-choices.service';
import { ScalingGroupStore } from './scaling-group.store';
import { withExpansion } from './standing-order-write';
import {
  architectureLabel,
  architectureWarning,
} from '../../../shared/components/architecture-badge.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

const ANY = 'any';

function specLabel(spec: { cores: number; memoryMi: number; monthlyEur: number | null }): string {
  const price = spec.monthlyEur === null ? '' : ` · €${spec.monthlyEur.toFixed(2)}/mo`;
  return `${spec.cores} vCPU · ${Math.round(spec.memoryMi / 1024)} GB${price}`;
}

function anyRegionText(up: string[] | null): string {
  if (up === null) return 'Any region — the first that has it';
  return up.length
    ? `Any region — available now in ${up.join(', ')}`
    : 'Any region — sold out everywhere, Flui waits';
}

function regionAvailability(up: string[] | null, region: string): string {
  if (up === null) return '';
  return up.includes(region) ? ' — available now' : ' — sold out, Flui waits';
}

@Component({
  selector: 'app-scaling-now-add-order',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideClock, lucideX })],
  host: { class: 'contents', '(document:keydown.escape)': 'onEscape()' },
  template: `
    <button
      flButton
      size="sm"
      type="button"
      (click)="open.set(true)"
      [disabled]="!canOrder()"
      [title]="canOrder() ? '' : 'Name at least one machine and one region in Group first.'"
      data-testid="add-order-open"
    >
      <fl-icon name="lucideClock" [size]="14" />
      Add a machine
    </button>

    @if (open()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="close()"
      >
        <form
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-order-title"
          data-testid="add-order-form"
          (click)="$event.stopPropagation()"
          (ngSubmit)="submit()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="add-order-title">Add a machine</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              [disabled]="saving()"
              (click)="close()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>

          <div class="fl-dialog__body">
            <fl-field label="Machine" for="add-order-shape">
              <span class="fl-select-wrap">
                <select
                  id="add-order-shape"
                  name="shape"
                  class="fl-select"
                  [ngModel]="shape()"
                  (ngModelChange)="shape.set($event)"
                  data-testid="add-order-shape"
                >
                  @for (option of shapes(); track option.value) {
                    <option [value]="option.value" [attr.title]="option.warning">
                      {{ option.text }}
                    </option>
                  }
                </select>
              </span>
            </fl-field>
            @if (warning(); as text) {
              <fl-status
                class="whitespace-normal"
                tone="warning"
                [label]="text"
                data-testid="add-order-warning"
              />
            }

            <fl-field label="Region" for="add-order-region">
              <span class="fl-select-wrap">
                <select
                  id="add-order-region"
                  name="region"
                  class="fl-select"
                  [ngModel]="region()"
                  (ngModelChange)="region.set($event)"
                  data-testid="add-order-region"
                >
                  @for (option of regions(); track option.value) {
                    <option [value]="option.value">{{ option.text }}</option>
                  }
                </select>
              </span>
            </fl-field>

            <fl-field
              label="How many"
              for="add-order-wanted"
              [hint]="'At most ' + room() + ' within the node ceiling.'"
            >
              <span class="fl-input fl-input--lg w-24">
                <input
                  id="add-order-wanted"
                  name="wanted"
                  type="number"
                  min="1"
                  [max]="room()"
                  [ngModel]="wanted()"
                  (ngModelChange)="wanted.set(+$event || 1)"
                  data-testid="add-order-wanted"
                />
              </span>
            </fl-field>

            @if (failure() ?? refused(); as problem) {
              <fl-alert tone="error" title="Cannot add this order" data-testid="add-order-says">
                {{ problem }}
              </fl-alert>
            } @else {
              <p class="m-0 text-fl-body-sm text-fl-ink-secondary" data-testid="add-order-says">
                {{ says() }}
              </p>
            }
          </div>

          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="saving()" (click)="close()">
              Cancel
            </button>
            <button
              flButton="primary"
              type="submit"
              [disabled]="saving() || !!refused()"
              data-testid="add-order-submit"
            >
              @if (saving()) {
                <fl-spinner label="Adding" />
              }
              {{ saving() ? 'Adding…' : 'Add order' }}
            </button>
          </footer>
        </form>
      </div>
    }
  `,
})
export class ScalingNowAddOrderComponent {
  readonly group = input.required<SectionGroup>();

  private readonly api = inject(ScalingApiService);
  private readonly store = inject(ScalingGroupStore);
  private readonly choices = inject(GroupChoicesService);

  protected readonly open = signal(false);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly shape = signal('');
  protected readonly region = signal('');
  protected readonly wanted = signal(1);

  constructor() {
    effect(() => void this.choices.load(this.group().provider));
    effect(() => {
      const g = this.group();
      if (!g.shapes.includes(this.shape())) this.shape.set(g.shapes[0] ?? '');
      if (this.region() !== ANY && !g.regions.includes(this.region()))
        this.region.set(g.regions[0] ?? '');
    });
  }

  protected readonly canOrder = computed(
    () => this.group().shapes.length > 0 && this.group().regions.length > 0,
  );

  /** How many more the ceiling leaves room for. */
  protected readonly room = computed(() =>
    Math.max(1, this.group().bounds.max - this.group().bounds.desired),
  );

  /** Where each machine can be had now, among the regions this group buys in; null when unread. */
  private upIn(shape: string): string[] | null {
    const reading = this.store.outlook()[shape];
    if (!reading) return null;
    return this.group().regions.filter((r) => reading.upIn.includes(r));
  }

  protected readonly shapes = computed(() => {
    const labels = this.choices.labels(this.group().provider);
    const architectures = this.choices.architectures(this.group().provider);
    const listed = new Map((this.store.catalogue().data?.shapes ?? []).map((s) => [s.shape, s]));
    const total = this.group().regions.length;
    return this.group().shapes.map((value) => {
      const entry = listed.get(value);
      const spec = entry?.facts;
      const label = spec ? specLabel(spec) : labels[value];
      const up = this.upIn(value);
      const where = up === null ? '' : ` — available in ${up.length} of ${total} regions`;
      const architecture = entry?.architecture ?? architectures[value];
      const named = [architectureLabel(architecture), label].filter(Boolean).join(' · ');
      const namedSuffix = named ? ` — ${named}` : '';
      return {
        value,
        text: `${value}${namedSuffix}${where}`,
        warning: architectureWarning(architecture),
      };
    });
  });

  protected readonly regions = computed(() => {
    const labels = this.choices.labels(this.group().provider);
    const up = this.upIn(this.shape());
    const any = { value: ANY, text: anyRegionText(up) };
    return [
      any,
      ...this.group().regions.map((value) => ({
        value,
        text: `${labels[value] ?? value}${regionAvailability(up, value)}`,
      })),
    ];
  });

  /** Whether the chosen machine can be had in the chosen region now; null when unread. */
  private readonly availableNow = computed(() => {
    const up = this.upIn(this.shape());
    if (up === null) return null;
    return this.region() === ANY ? up.length > 0 : up.includes(this.region());
  });

  private readonly where = computed(() => {
    if (this.region() !== ANY) return this.region();
    const up = this.upIn(this.shape());
    return up?.length ? up[0] : 'the first region that has it';
  });

  private readonly write = computed(() =>
    withExpansion(this.group(), {
      shape: this.shape(),
      region: this.region(),
      wanted: this.wanted(),
    }),
  );

  protected readonly warning = computed(
    () => this.shapes().find((option) => option.value === this.shape())?.warning ?? null,
  );

  protected readonly refused = computed(() => {
    const write = this.write();
    return 'refused' in write ? write.refused : null;
  });

  protected readonly says = computed(() => {
    const g = this.group();
    const n = this.wanted();
    const target = `Target ${g.bounds.desired} → ${g.bounds.desired + n}.`;
    const machine = `${n === 1 ? 'one' : n} ${this.shape()} in ${this.where()}`;
    const now = this.availableNow();
    if (g.provision === 'automatic') {
      if (now === true)
        return `${target} ${this.shape()} is available in ${this.where()} now: Flui adds ${machine} on its next pass, whatever the load.`;
      if (now === false) {
        const soldOutWhere =
          this.region() === ANY ? ' everywhere this group adds nodes' : ` in ${this.region()}`;
        return `${target} ${this.shape()} is sold out${soldOutWhere}: Flui waits and adds ${machine} as soon as it can be had, then closes the order.`;
      }
      return `${target} Flui adds ${machine} as soon as it can be had, whatever the load, and closes the order once there.`;
    }
    return now === true
      ? `${target} ${this.shape()} is available in ${this.where()} now; this group only decides, so it names ${machine} and adds nothing.`
      : `${target} This group only decides: it will name ${machine} when it can be had, and add nothing.`;
  });

  protected onEscape(): void {
    if (this.open() && !this.saving()) this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.failure.set(null);
    this.wanted.set(1);
  }

  protected async submit(): Promise<void> {
    const write = this.write();
    if ('refused' in write) return;
    this.saving.set(true);
    this.failure.set(null);
    try {
      await firstValueFrom(this.api.updateGroup(this.group().id, write));
      this.close();
      this.store.reload();
    } catch (error: unknown) {
      const body = (error as { error?: { message?: string | string[] } })?.error?.message;
      this.failure.set(
        Array.isArray(body) ? body.join('. ') : (body ?? 'The order could not be added.'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
