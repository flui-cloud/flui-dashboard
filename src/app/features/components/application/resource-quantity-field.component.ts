import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import {
  CpuUnit,
  MemoryUnit,
  joinCpu,
  joinMemory,
  splitCpu,
  splitMemory,
} from './resource-quantity';

@Component({
  selector: 'app-resource-quantity-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="block">
      <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ label() }}</span>
      <div class="mt-1 flex rounded-lg border bg-white dark:bg-gray-900 overflow-hidden transition-colors"
        [class]="invalid() ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600 focus-within:border-blue-500'">
        <input
          type="number"
          inputmode="decimal"
          min="0"
          [step]="step()"
          [value]="amount()"
          [disabled]="disabled()"
          [attr.aria-label]="label()"
          (input)="onAmount($event)"
          class="w-full min-w-0 px-3 py-2 text-sm font-mono bg-transparent text-gray-900 dark:text-white outline-none disabled:text-gray-500 disabled:cursor-not-allowed"
        />
        <select
          [disabled]="disabled()"
          [attr.aria-label]="label() + ' unit'"
          (change)="onUnit($event)"
          class="px-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-600 outline-none disabled:cursor-not-allowed">
          @for (u of units(); track u.value) {
            <option [value]="u.value" [selected]="u.value === unit()">{{ u.label }}</option>
          }
        </select>
      </div>
    </label>
  `,
})
export class ResourceQuantityFieldComponent {
  readonly label = input.required<string>();
  readonly kind = input.required<'cpu' | 'memory'>();
  readonly value = input<string | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected readonly amount = signal('');
  protected readonly unit = signal<string>('Mi');
  protected readonly invalid = signal(false);

  protected readonly units = computed(() =>
    this.kind() === 'cpu'
      ? [{ value: 'm', label: 'm' }, { value: 'cores', label: 'cores' }]
      : [{ value: 'Mi', label: 'MiB' }, { value: 'Gi', label: 'GiB' }],
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
