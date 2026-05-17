import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  signal, computed, ChangeDetectionStrategy, ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// ── CPU: 5m → 4000m, step 5m (800 steps, fully proportional) ─────────────────
const CPU_MIN = 5;
const CPU_MAX = 4000;
const CPU_STEP = 5;

// ── Memory: 8Mi → 4096Mi, step 8Mi (512 steps, fully proportional) ───────────
const MEM_MIN = 8;
const MEM_MAX = 4096;
const MEM_STEP = 8;

function buildSteps(min: number, max: number, step: number): number[] {
  const result: number[] = [];
  for (let v = min; v <= max; v += step) result.push(v);
  return result;
}

const CPU_STEPS = buildSteps(CPU_MIN, CPU_MAX, CPU_STEP);
const MEM_STEPS = buildSteps(MEM_MIN, MEM_MAX, MEM_STEP);

// ── K8s value helpers ─────────────────────────────────────────────────────────

function parseCpu(k8s: string): number {
  if (!k8s) return 250;
  if (k8s.endsWith('m')) return Number.parseInt(k8s, 10);
  return Math.round(Number.parseFloat(k8s) * 1000);
}

function formatCpu(mc: number): string {
  if (mc < 1000) return `${mc}m`;
  const cores = mc / 1000;
  return cores % 1 === 0 ? `${cores}` : `${Number.parseFloat(cores.toFixed(2))}`;
}

function cpuLabel(mc: number): string {
  if (mc < 1000) return `${mc} millicores`;
  const cores = mc / 1000;
  const n = cores % 1 === 0 ? `${cores}` : cores.toFixed(2);
  return `${n} core${cores === 1 ? '' : 's'}`;
}

function parseMem(k8s: string): number {
  if (!k8s) return 256;
  if (k8s.endsWith('Gi')) return Math.round(Number.parseFloat(k8s) * 1024);
  if (k8s.endsWith('Mi')) return Number.parseInt(k8s, 10);
  if (k8s.endsWith('G')) return Math.round(Number.parseFloat(k8s) * 1000);
  if (k8s.endsWith('M')) return Number.parseInt(k8s, 10);
  return Number.parseInt(k8s, 10);
}

function formatMem(mib: number): string {
  if (mib < 1024) return `${mib}Mi`;
  const gib = mib / 1024;
  return gib % 1 === 0 ? `${gib}Gi` : `${Number.parseFloat(gib.toFixed(2))}Gi`;
}

function memLabel(mib: number): string {
  if (mib < 1024) return `${mib} MiB`;
  const gib = mib / 1024;
  return gib % 1 === 0 ? `${gib} GiB` : `${gib.toFixed(2)} GiB`;
}

function snapToStep(value: number, steps: number[]): number {
  return steps.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
    steps[0] ?? value
  );
}

function stepIndex(value: number, steps: number[]): number {
  return steps.indexOf(snapToStep(value, steps));
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-resource-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
      background: transparent;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      border: 2px solid #3b82f6;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      cursor: grab;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type=range]::-webkit-slider-thumb:active {
      cursor: grabbing;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
    }
    input[type=range]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      border: 2px solid #3b82f6;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      cursor: grab;
    }
    input[type=range]:focus-visible::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4);
    }
    input[type=range]:disabled::-webkit-slider-thumb {
      border-color: #9ca3af;
      cursor: not-allowed;
    }
  `],
  template: `
    <div class="space-y-2.5">

      <!-- Label + K8s value badge -->
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ label }}</span>
        @if (dirty()) {
          <div class="flex items-center gap-1 font-mono text-sm font-bold">
            <span class="text-gray-400 dark:text-gray-500">{{ originalValue }}</span>
            <span class="text-gray-300 dark:text-gray-600 text-xs px-0.5">→</span>
            <span class="text-blue-600 dark:text-blue-400">{{ k8sValue() }}</span>
          </div>
        } @else {
          <span class="text-sm font-bold font-mono text-gray-700 dark:text-gray-200">
            {{ k8sValue() }}
          </span>
        }
      </div>

      <!-- Track + range fill + native input -->
      <div class="relative flex items-center h-6">
        <!-- Background track -->
        <div class="absolute inset-x-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600"></div>
        <!-- Filled range -->
        <div class="absolute left-0 h-1.5 rounded-full transition-all pointer-events-none"
          [class]="dirty() ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-400 dark:bg-gray-400'"
          [style.width.%]="fillPercent()">
        </div>
        <!-- Native range input, transparent, sits on top -->
        <input
          #rangeInput
          type="range"
          [min]="0"
          [max]="stepsSignal().length - 1"
          [step]="1"
          [value]="currentIndex()"
          [disabled]="disabled"
          (input)="onInput($event)"
          class="relative z-10 w-full"
          [style.background]="'transparent'"
        />
      </div>

      <!-- Step markers -->
      <div class="flex justify-between px-0.5">
        @for (s of visibleStepLabels(); track s.index) {
          <span class="text-xs text-gray-300 dark:text-gray-600 font-mono" style="font-size: 10px">{{ s.label }}</span>
        }
      </div>

      <!-- Human-readable description -->
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ humanLabel() }}</p>

    </div>
  `,
})
export class ResourceSliderComponent implements OnChanges {
  @Input({ required: true }) label = '';
  @Input({ required: true }) type: 'cpu' | 'memory' = 'cpu';
  @Input() value = '';
  @Input() disabled = false;
  @Input() maxValue?: number;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('rangeInput') rangeInput?: ElementRef<HTMLInputElement>;

  protected stepsSignal = signal<number[]>(CPU_STEPS);
  protected snappedValue = signal(250);
  protected originalValue = '';

  protected currentIndex = computed(() => stepIndex(this.snappedValue(), this.stepsSignal()));

  protected fillPercent = computed(() => {
    const steps = this.stepsSignal();
    return (this.currentIndex() / (steps.length - 1)) * 100;
  });

  protected k8sValue = computed(() =>
    this.type === 'cpu' ? formatCpu(this.snappedValue()) : formatMem(this.snappedValue())
  );

  protected humanLabel = computed(() =>
    this.type === 'cpu' ? cpuLabel(this.snappedValue()) : memLabel(this.snappedValue())
  );

  protected dirty = computed(() => this.k8sValue() !== this.originalValue);

  protected visibleStepLabels = computed(() => {
    const steps = this.stepsSignal();
    const indices = [0, Math.floor(steps.length / 4), Math.floor(steps.length / 2), Math.floor(3 * steps.length / 4), steps.length - 1];
    return indices.map(i => ({
      index: i,
      label: this.type === 'cpu' ? formatCpu(steps[i]) : formatMem(steps[i]),
    }));
  });

  private buildStepsArray(): number[] {
    const max = this.maxValue ?? (this.type === 'cpu' ? CPU_MAX : MEM_MAX);
    return this.type === 'cpu'
      ? buildSteps(CPU_MIN, max, CPU_STEP)
      : buildSteps(MEM_MIN, max, MEM_STEP);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['type'] || changes['maxValue']) {
      const steps = this.buildStepsArray();
      this.stepsSignal.set(steps);
      const parsed = this.type === 'cpu' ? parseCpu(this.value) : parseMem(this.value);
      const snapped = snapToStep(parsed, steps);
      const formatted = this.type === 'cpu' ? formatCpu(snapped) : formatMem(snapped);

      // Only reset originalValue when the parent pushes a genuinely new baseline
      // (i.e. disabled → enabled transition, type change, or first load).
      // When the user is actively dragging (dirty), the parent echoes our own
      // emitted value back — we must NOT let that overwrite the original.
      const typeChanged = !!changes['type'];
      const isFirstChange = changes['value']?.firstChange;
      // disabled going false→true means edit ended (cancel/save) or component reset
      const disabledBecameTrue = !!changes['disabled'] && changes['disabled'].currentValue === true;

      if (isFirstChange || typeChanged || disabledBecameTrue) {
        // Reset to new baseline unconditionally
        this.snappedValue.set(snapped);
        this.originalValue = formatted;
      } else if (this.disabled) {
        // Slider is disabled (readonly) — parent sent a new value, update baseline
        this.snappedValue.set(snapped);
        this.originalValue = formatted;
      } else if (!this.dirty()) {
        // Slider is enabled but clean (edit just started) → lock in original
        this.snappedValue.set(snapped);
        this.originalValue = formatted;
      }
      // else: enabled + dirty → user is dragging, parent echoes our emits → ignore
    }
  }

  protected onInput(event: Event): void {
    const idx = Number.parseInt((event.target as HTMLInputElement).value, 10);
    const val = this.stepsSignal()[idx];
    this.snappedValue.set(val);
    const k8s = this.type === 'cpu' ? formatCpu(val) : formatMem(val);
    this.valueChange.emit(k8s);
  }
}
