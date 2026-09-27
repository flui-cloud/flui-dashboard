import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ToastService } from '../../../shared/services/toast.service';
import { AppAutoscaling, AppRuntimeService } from '../../service/app-runtime.service';

/**
 * Whether the replica count follows the load, and between which counts.
 * Replicas that find no room wait for a node, which is what makes the
 * cluster's scaling group buy one.
 */
@Component({
  selector: 'app-autoscaling-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-surface p-4 space-y-3" data-testid="autoscaling-card">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autoscaling</span>
        @if (current(); as c) {
          <span class="text-xs text-sub" data-testid="autoscaling-state">
            {{ c.enabled ? (c.running === false ? 'On — not running on the cluster yet' : 'On') : 'Off — fixed count' }}
          </span>
        }
      </div>

      @if (failed()) {
        <p class="m-0 text-sm text-sub">{{ failed() }}</p>
      } @else if (current()) {
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" [checked]="enabled()" (change)="enabled.set($any($event.target).checked)" data-testid="autoscaling-enabled" [disabled]="fromManifest()" />
          Follow the load
        </label>

        @if (enabled()) {
          <div class="flex flex-wrap items-end gap-3 text-sm">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-sub">Min</span>
              <input type="number" min="1" max="20" class="w-20 rounded-md border border-border bg-background px-2 py-1" [value]="min()" (input)="min.set(+$any($event.target).value)" [disabled]="fromManifest()" data-testid="autoscaling-min" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-sub">Max</span>
              <input type="number" min="1" max="20" class="w-20 rounded-md border border-border bg-background px-2 py-1" [value]="max()" (input)="max.set(+$any($event.target).value)" [disabled]="fromManifest()" data-testid="autoscaling-max" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-sub">Add one above CPU %</span>
              <input type="number" min="10" max="95" class="w-20 rounded-md border border-border bg-background px-2 py-1" [value]="cpu()" (input)="cpu.set(+$any($event.target).value)" data-testid="autoscaling-cpu" />
            </label>
          </div>
        }

        @if (fromManifest()) {
          <p class="m-0 text-xs text-sub" data-testid="autoscaling-manifest">
            The range comes from this app's flui.yaml (deploy.scaling): change it there and deploy.
          </p>
        }

        <div class="flex items-center gap-3">
          @if (problem(); as p) {
            <span class="text-xs text-red-600 dark:text-red-400" data-testid="autoscaling-problem">{{ p }}</span>
          }
          <button type="button" class="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            [disabled]="!!problem() || !dirty() || saving()" (click)="save()" data-testid="autoscaling-save">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class AppAutoscalingCardComponent {
  private readonly runtime = inject(AppRuntimeService);
  private readonly toast = inject(ToastService);

  readonly appId = input<string | null>(null);

  protected readonly current = signal<AppAutoscaling | null>(null);
  protected readonly failed = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly enabled = signal(false);
  protected readonly min = signal(1);
  protected readonly max = signal(2);
  protected readonly cpu = signal(80);

  protected readonly fromManifest = computed(() => this.current()?.rangeFrom === 'manifest');

  protected readonly problem = computed(() => {
    if (!this.enabled()) return null;
    if (!(this.min() >= 1 && this.max() <= 20)) return 'Between 1 and 20 replicas.';
    if (this.max() <= this.min()) return 'Max has to be above min, or the count cannot grow.';
    if (!(this.cpu() >= 10 && this.cpu() <= 95)) return 'CPU target between 10 and 95%.';
    return null;
  });

  protected readonly dirty = computed(() => {
    const c = this.current();
    if (!c) return false;
    if (this.enabled() !== c.enabled) return true;
    return this.enabled() && (this.min() !== c.min || this.max() !== c.max || this.cpu() !== c.targetCPU);
  });

  constructor() {
    effect(() => {
      const id = this.appId();
      if (id) untracked(() => void this.load(id));
    });
  }

  private async load(appId: string): Promise<void> {
    try {
      this.show(await this.runtime.autoscaling(appId));
      this.failed.set(null);
    } catch {
      this.failed.set('Autoscaling could not be read.');
    }
  }

  private show(a: AppAutoscaling): void {
    this.current.set(a);
    this.enabled.set(a.enabled);
    this.min.set(a.min);
    this.max.set(Math.max(a.max, a.min + 1));
    this.cpu.set(a.targetCPU);
  }

  /** A flui.yaml app sends only the CPU target: its range lives in the manifest. */
  private body(): { enabled: boolean; min?: number; max?: number; targetCPU?: number } {
    if (this.fromManifest()) return { enabled: this.enabled(), targetCPU: this.cpu() };
    if (!this.enabled()) return { enabled: false };
    return { enabled: true, min: this.min(), max: this.max(), targetCPU: this.cpu() };
  }

  protected async save(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.saving.set(true);
    try {
      const saved = await this.runtime.setAutoscaling(id, this.body());
      this.show(saved);
      this.toast.showSuccess({
        title: 'Autoscaling saved',
        message: saved.enabled ? `${saved.min} to ${saved.max} replicas` : 'Fixed replica count',
      });
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const raw = e?.error?.message ?? e?.message ?? '';
      this.toast.showError({ title: 'Autoscaling not saved', message: Array.isArray(raw) ? raw.join(' ') : raw });
    } finally {
      this.saving.set(false);
    }
  }
}
