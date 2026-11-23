import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CanDirective } from '../../../core/directives/can.directive';
import {
  FlAlert,
  FlField,
  FlKeyValue,
  FlKvItem,
  FlLoadingState,
  FlPanel,
} from '../../../ui/patterns';
import { FlButton, FlSpinner, FlStatus, FlTag } from '../../../ui/primitives';
import {
  EgressChange,
  EgressPort,
  EgressService,
  EgressView,
  formatEgressPorts,
  parseEgressPorts,
} from '../../service/egress.service';

@Component({
  selector: 'app-cluster-egress-card',
  imports: [
    FormsModule,
    CanDirective,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlField,
    FlAlert,
    FlLoadingState,
    FlButton,
    FlStatus,
    FlTag,
    FlSpinner,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Outbound traffic" data-testid="cluster-egress">
      @if (!editing() && reading()) {
        <ng-container ngProjectAs="[panelActions]">
          <div class="fl-row" *fluiCan="'egress:manage'">
            @if (!reading()?.open) {
              <button
                flButton="ghost"
                size="sm"
                type="button"
                (click)="open()"
                data-testid="egress-open"
              >
                Open all
              </button>
            }
            <button flButton size="sm" type="button" (click)="edit()" data-testid="egress-edit">
              {{ reading()?.open ? 'Limit' : 'Change' }}
            </button>
          </div>
        </ng-container>
      }
      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Which ports your applications can reach outside the cluster. The platform's own services
          are not affected.
        </p>
        @if (reading(); as r) {
          <fl-key-value>
            <fl-kv-item key="Policy">
              @if (r.open) {
                <fl-status tone="neutral" label="Open on every port" />
              } @else {
                <fl-status tone="warning" label="Limited to listed ports" />
              }
            </fl-kv-item>
            @if (!r.open) {
              <fl-kv-item key="Allowed ports">
                <span class="fl-row">
                  @for (p of r.ports; track p.port + p.protocol) {
                    <fl-tag class="fl-mono">{{ portLabel(p) }}</fl-tag>
                  } @empty {
                    <span class="text-fl-ink-muted">None</span>
                  }
                </span>
              </fl-kv-item>
            }
          </fl-key-value>
          <p class="m-0 text-fl-body-sm text-fl-ink" data-testid="egress-summary">
            {{ r.summary }}
          </p>
        } @else {
          <fl-loading-state [rows]="2" />
        }
        @if (editing()) {
          <form class="flex flex-col gap-3 border-t border-fl-border pt-4" (ngSubmit)="save()">
            <fl-field
              label="Allowed ports"
              for="egress-ports"
              class="max-w-sm"
              [hint]="
                problem()
                  ? undefined
                  : 'Comma separated, TCP unless written as 123/udp. Applies to every application that is not part of the platform.'
              "
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="egress-ports"
                  type="text"
                  name="ports"
                  class="fl-mono"
                  placeholder="80, 443"
                  [(ngModel)]="draft"
                  data-testid="egress-input"
                />
              </div>
              @if (problem(); as p) {
                <span class="fl-field__error" role="alert" data-testid="egress-problem">{{
                  p
                }}</span>
              }
            </fl-field>
            <div class="fl-row">
              <button
                flButton="primary"
                type="submit"
                [disabled]="saving()"
                data-testid="egress-save"
              >
                @if (saving()) {
                  <fl-spinner label="Saving" />
                  Saving…
                } @else {
                  Save
                }
              </button>
              <button flButton="ghost" type="button" (click)="editing.set(false)">Cancel</button>
            </div>
          </form>
        }
        @if (outcome(); as o) {
          <div class="flex flex-col gap-2" data-testid="egress-outcome">
            <p class="m-0 text-fl-caption text-fl-ink-muted">
              Written into {{ o.applied }} application {{ o.applied === 1 ? 'space' : 'spaces' }}.
            </p>
            @if (o.failed.length) {
              <fl-alert tone="warning" title="Some application spaces were not updated">
                Not written in {{ o.failed.length }}; the next deploy there writes it.
              </fl-alert>
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class ClusterEgressCardComponent {
  readonly clusterId = input<string | null>(null);
  private readonly api = inject(EgressService);

  protected readonly reading = signal<EgressView | null>(null);
  protected readonly outcome = signal<EgressChange | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected draft = '';

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.reading.set(await this.api.cluster(id));
    } catch {
      this.reading.set(null);
    }
  }

  protected portLabel(p: EgressPort): string {
    return formatEgressPorts([p]);
  }

  protected edit(): void {
    const current = this.reading();
    this.draft = current && !current.open ? formatEgressPorts(current.ports) : '80, 443';
    this.problem.set(null);
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    const ports = parseEgressPorts(this.draft);
    if (typeof ports === 'string') {
      this.problem.set(ports);
      return;
    }
    this.saving.set(true);
    const written = await this.api.setCluster(id, ports);
    this.saving.set(false);
    if (written) this.settle(written);
  }

  protected async open(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    const written = await this.api.openCluster(id);
    if (written) this.settle(written);
  }

  private settle(change: EgressChange): void {
    this.reading.set(change);
    this.outcome.set(change);
    this.editing.set(false);
  }
}
