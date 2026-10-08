import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CanDirective } from '../../../core/directives/can.directive';
import { EgressChange, EgressService, EgressView, formatEgressPorts, parseEgressPorts } from '../../service/egress.service';

/** Which ports applications on a cluster may reach outside it. */
@Component({
  selector: 'app-cluster-egress-card',
  standalone: true,
  imports: [FormsModule, CanDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card-surface space-y-3 p-4" data-testid="cluster-egress">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="m-0 text-sm font-semibold text-foreground">Outbound ports</h3>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground" data-testid="egress-summary">{{ reading()?.summary ?? 'Reading…' }}</p>
        </div>
        @if (!editing() && reading()) {
          <div class="flex gap-2" *fluiCan="'egress:manage'">
            <button type="button" class="text-[13px] text-primary hover:underline" (click)="edit()" data-testid="egress-edit">
              {{ reading()?.open ? 'Limit' : 'Change' }}
            </button>
            @if (!reading()?.open) {
              <button type="button" class="text-[13px] text-muted-foreground hover:text-destructive" (click)="open()" data-testid="egress-open">Open all</button>
            }
          </div>
        }
      </div>
      @if (editing()) {
        <form class="space-y-2" (ngSubmit)="save()">
          <input
            type="text"
            name="ports"
            class="h-8 w-full max-w-sm rounded-md border border-border bg-background px-2 text-xs text-foreground"
            placeholder="80, 443"
            [(ngModel)]="draft"
            data-testid="egress-input"
          />
          <p class="m-0 text-[12px] text-muted-foreground">Comma separated, TCP unless written as 123/udp. Applies to every application that is not part of the platform.</p>
          @if (problem(); as p) {
            <p class="m-0 text-[12px] text-destructive" data-testid="egress-problem">{{ p }}</p>
          }
          <div class="flex gap-2">
            <button type="submit" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" [disabled]="saving()" data-testid="egress-save">Save</button>
            <button type="button" class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" (click)="editing.set(false)">Cancel</button>
          </div>
        </form>
      }
      @if (outcome(); as o) {
        <p class="m-0 text-[12px] text-muted-foreground" data-testid="egress-outcome">
          Written into {{ o.applied }} application {{ o.applied === 1 ? 'space' : 'spaces' }}.
          @if (o.failed.length) {
            <span class="text-destructive">Not written in {{ o.failed.length }}; the next deploy there writes it.</span>
          }
        </p>
      }
    </section>
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
