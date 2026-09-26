import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { GroupChoicesService } from './group-choices.service';
import { ScalingGroupStore } from './scaling-group.store';
import { withExpansion } from './standing-order-write';

/**
 * "Add this machine as soon as it can be had", whatever the load.
 *
 * Shut by default: most visits to this page are to read it, and the form is
 * one line of intent, not a panel to keep open.
 */
/** A standing order that waits for the first region of the group that has the machine. */
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
  standalone: true,
  imports: [FormsModule, NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucideClock, lucideX })],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button
        hlmBtn
        size="sm"
        variant="outline"
        type="button"
        (click)="open.set(true)"
        [disabled]="!canOrder()"
        [title]="canOrder() ? '' : 'Name at least one machine and one region in Group first.'"
        data-testid="add-order-open"
      >
        <ng-icon name="lucideClock" class="mr-1.5 h-3.5 w-3.5" />
        Add a machine
      </button>
    } @else {
      <div
        class="space-y-2 rounded-lg border border-border bg-card px-3 py-3 text-sm"
        data-testid="add-order-form"
      >
        <div class="flex flex-wrap items-center gap-2">
          <select
            [class]="field"
            [ngModel]="shape()"
            (ngModelChange)="shape.set($event)"
            aria-label="Machine"
            data-testid="add-order-shape"
          >
            @for (option of shapes(); track option.value) {
              <option [value]="option.value">{{ option.text }}</option>
            }
          </select>
          <span class="text-muted-foreground">in</span>
          <select
            [class]="field"
            [ngModel]="region()"
            (ngModelChange)="region.set($event)"
            aria-label="Region"
            data-testid="add-order-region"
          >
            @for (option of regions(); track option.value) {
              <option [value]="option.value">{{ option.text }}</option>
            }
          </select>
          <span class="text-muted-foreground">×</span>
          <input
            type="number"
            min="1"
            [max]="room()"
            class="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            [ngModel]="wanted()"
            (ngModelChange)="wanted.set(+$event || 1)"
            aria-label="How many"
            data-testid="add-order-wanted"
          />
          <button
            hlmBtn
            size="sm"
            type="button"
            [disabled]="saving() || !!refused()"
            (click)="submit()"
            data-testid="add-order-submit"
          >
            {{ saving() ? 'Adding…' : 'Add' }}
          </button>
          <button
            hlmBtn
            size="sm"
            variant="ghost"
            type="button"
            (click)="close()"
            aria-label="Close"
          >
            <ng-icon name="lucideX" class="h-3.5 w-3.5" />
          </button>
        </div>
        <p
          class="m-0 text-[13px]"
          [class]="refused() || failure() ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'"
          data-testid="add-order-says"
        >
          {{ failure() ?? refused() ?? says() }}
        </p>
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
      if (this.region() !== ANY && !g.regions.includes(this.region())) this.region.set(g.regions[0] ?? '');
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
    const facts = new Map(
      (this.store.catalogue().data?.shapes ?? []).map((s) => [s.shape, s.facts]),
    );
    const total = this.group().regions.length;
    return this.group().shapes.map((value) => {
      const spec = facts.get(value);
      const label = spec ? specLabel(spec) : labels[value];
      const up = this.upIn(value);
      const where = up === null ? '' : ` — available in ${up.length} of ${total} regions`;
      const named = label ? ` — ${label}` : '';
      return { value, text: `${value}${named}${where}` };
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
        return `${target} ${this.shape()} is available in ${this.where()} now: Flui buys ${machine} on its next pass, whatever the load.`;
      if (now === false) {
        const soldOutWhere = this.region() === ANY ? ' everywhere this group buys' : ` in ${this.region()}`;
        return `${target} ${this.shape()} is sold out${soldOutWhere}: Flui waits and buys ${machine} as soon as it can be had, then closes the order.`;
      }
      return `${target} Flui buys ${machine} as soon as it can be had, whatever the load, and closes the order once there.`;
    }
    return now === true
      ? `${target} ${this.shape()} is available in ${this.where()} now; this group only decides, so it names ${machine} and buys nothing.`
      : `${target} This group only decides: it will name ${machine} when it can be had, and buy nothing.`;
  });

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
      const body = (error as { error?: { message?: string | string[] } })?.error
        ?.message;
      this.failure.set(
        Array.isArray(body) ? body.join('. ') : (body ?? 'The order could not be added.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected readonly field =
    'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
}
