import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ToastService } from '../../../shared/services/toast.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

let nextId = 0;
import { AppAutoscaling, AppRuntimeService } from '../../service/app-runtime.service';

/**
 * Whether the replica count follows the load, and between which counts.
 * Replicas that find no room wait for a node, which is what makes the
 * cluster's scaling group buy one.
 */
@Component({
  selector: 'app-autoscaling-card',
  standalone: true,
  imports: [FlAlert, FlField, FlPanel, FlButton, FlStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fl-panel title="Autoscaling" [flush]="true" data-testid="autoscaling-card">
      <ng-container panelActions>
        @if (current(); as c) {
          <fl-status
            data-testid="autoscaling-state"
            [tone]="c.enabled ? (c.running === false ? 'warning' : 'success') : 'neutral'"
            [label]="
              c.enabled
                ? c.running === false
                  ? 'On, not running on the cluster yet'
                  : 'On'
                : 'Off, fixed count'
            "
          />
        }
      </ng-container>

      @if (failed(); as f) {
        <div class="p-4">
          <fl-alert tone="error" [title]="f" />
        </div>
      } @else if (current()) {
        <div class="flex flex-col gap-4 p-4">
          <fieldset class="fl-fieldset" [disabled]="fromManifest()">
            <legend class="fl-sr">Replica count</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="fl-radiocard">
                <input
                  type="radio"
                  [name]="uid"
                  [checked]="!enabled()"
                  (change)="enabled.set(false)"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">Fixed count</span>
                  <span class="fl-radiocard__desc">Keeps the replica count you set.</span>
                </span>
              </label>
              <label class="fl-radiocard">
                <input
                  type="radio"
                  [name]="uid"
                  [checked]="enabled()"
                  (change)="enabled.set($any($event.target).checked)"
                  data-testid="autoscaling-enabled"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">Follow the load</span>
                  <span class="fl-radiocard__desc">Adds and removes replicas with CPU use.</span>
                </span>
              </label>
            </div>
          </fieldset>

          @if (enabled()) {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <fl-field label="Minimum replicas" [for]="uid + '-min'" hint="1 to 20">
                <div class="fl-input fl-input--lg">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    [id]="uid + '-min'"
                    [value]="min()"
                    (input)="min.set(+$any($event.target).value)"
                    [disabled]="fromManifest()"
                    data-testid="autoscaling-min"
                  />
                </div>
              </fl-field>
              <fl-field label="Maximum replicas" [for]="uid + '-max'" hint="Above the minimum">
                <div class="fl-input fl-input--lg">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    [id]="uid + '-max'"
                    [value]="max()"
                    (input)="max.set(+$any($event.target).value)"
                    [disabled]="fromManifest()"
                    data-testid="autoscaling-max"
                  />
                </div>
              </fl-field>
              <fl-field
                label="Add a replica above CPU"
                [for]="uid + '-cpu'"
                hint="Percent, 10 to 95"
              >
                <div class="fl-input fl-input--lg">
                  <input
                    type="number"
                    min="10"
                    max="95"
                    [id]="uid + '-cpu'"
                    [value]="cpu()"
                    (input)="cpu.set(+$any($event.target).value)"
                    data-testid="autoscaling-cpu"
                  />
                </div>
              </fl-field>
            </div>
          }

          @if (fromManifest()) {
            <fl-alert tone="info" title="Range set in flui.yaml" data-testid="autoscaling-manifest">
              Change deploy.scaling in this app's flui.yaml, then deploy.
            </fl-alert>
          }

          @if (problem(); as p) {
            <fl-alert tone="error" title="Range not valid" data-testid="autoscaling-problem">{{
              p
            }}</fl-alert>
          }
        </div>

        <div
          class="flex flex-wrap items-center justify-end gap-2 rounded-b-fl-lg border-t border-fl-border bg-fl-surface-subtle px-4 py-3"
        >
          @if (dirty()) {
            <button flButton="ghost" type="button" [disabled]="saving()" (click)="reset()">
              Cancel
            </button>
          }
          <button
            flButton="primary"
            type="button"
            [disabled]="!!problem() || !dirty() || saving()"
            (click)="save()"
            data-testid="autoscaling-save"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      }
    </fl-panel>
  `,
})
export class AppAutoscalingCardComponent {
  private readonly runtime = inject(AppRuntimeService);
  private readonly toast = inject(ToastService);

  readonly appId = input<string | null>(null);

  protected readonly uid = `autoscaling-${nextId++}`;

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
    return (
      this.enabled() && (this.min() !== c.min || this.max() !== c.max || this.cpu() !== c.targetCPU)
    );
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

  protected reset(): void {
    const c = this.current();
    if (c) this.show(c);
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
      this.toast.showError({
        title: 'Autoscaling not saved',
        message: Array.isArray(raw) ? raw.join(' ') : raw,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
