import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  CpuUnit,
  MemoryUnit,
  joinCpu,
  joinMemory,
  splitCpu,
  splitMemory,
} from './resource-quantity';

let nextId = 0;

@Component({
  selector: 'app-resource-quantity-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fl-field" [class.is-invalid]="invalid()">
      <label class="fl-field__label" [for]="id">{{ label() }}</label>
      <div class="flex gap-2">
        <div class="fl-input fl-input--lg min-w-0 flex-1">
          <input
            class="fl-mono"
            type="number"
            inputmode="decimal"
            min="0"
            [id]="id"
            [step]="step()"
            [value]="amount()"
            [disabled]="disabled()"
            [attr.aria-invalid]="invalid()"
            (input)="onAmount($event)"
          />
        </div>
        <span class="fl-select-wrap w-24 shrink-0">
          <select
            class="fl-select"
            [disabled]="disabled()"
            [attr.aria-label]="label() + ' unit'"
            (change)="onUnit($event)"
          >
            @for (u of units(); track u.value) {
              <option [value]="u.value" [selected]="u.value === unit()">{{ u.label }}</option>
            }
          </select>
        </span>
      </div>
    </div>
  `,
})
export class ResourceQuantityFieldComponent {
  readonly label = input.required<string>();
  readonly kind = input.required<'cpu' | 'memory'>();
  readonly value = input<string | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected readonly id = `resource-quantity-${nextId++}`;

  protected readonly amount = signal('');
  protected readonly unit = signal<string>('Mi');
  protected readonly invalid = signal(false);

  protected readonly units = computed(() =>
    this.kind() === 'cpu'
      ? [
          { value: 'm', label: 'm' },
          { value: 'cores', label: 'cores' },
        ]
      : [
          { value: 'Mi', label: 'MiB' },
          { value: 'Gi', label: 'GiB' },
        ],
  );

  protected readonly step = computed(() => {
    const unit = this.unit();
    if (unit === 'cores' || unit === 'Gi') return '0.25';
    return unit === 'm' ? '50' : '64';
  });

  constructor() {
    effect(() => {
      const value = this.value();
      const kind = this.kind();
      untracked(() => this.adopt(kind, value));
    });
  }

  private adopt(kind: 'cpu' | 'memory', value: string | null): void {
    const split = kind === 'cpu' ? splitCpu(value) : splitMemory(value);
    if (!split) {
      this.amount.set('');
      this.unit.set(kind === 'cpu' ? 'm' : 'Mi');
      this.invalid.set(false);
      return;
    }
    if (this.current() === value) return;
    this.amount.set(String(split.amount));
    this.unit.set(split.unit);
    this.invalid.set(false);
  }

  private current(): string | null {
    const amount = Number(this.amount());
    if (this.amount() === '') return null;
    return this.kind() === 'cpu'
      ? joinCpu(amount, this.unit() as CpuUnit)
      : joinMemory(amount, this.unit() as MemoryUnit);
  }

  protected onAmount(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
    this.emit();
  }

  protected onUnit(event: Event): void {
    this.unit.set((event.target as HTMLSelectElement).value);
    this.emit();
  }

  private emit(): void {
    const quantity = this.current();
    this.invalid.set(quantity === null);
    this.valueChange.emit(quantity);
  }
}
