import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { EgressService, EgressView, formatEgressPorts } from '../../service/egress.service';

/** One line in the cluster summary, shown only when applications' outbound traffic is limited. */
@Component({
  selector: 'app-cluster-egress-line',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reading(); as r) {
      @if (!r.open) {
        <p class="m-0 mt-2 text-xs text-sub" data-testid="cluster-egress-line">
          Applications reach only {{ portsOf(r) }} outside the cluster.
        </p>
      }
    }
  `,
})
export class ClusterEgressLineComponent {
  readonly clusterId = input<string | null>(null);
  private readonly api = inject(EgressService);
  protected readonly reading = signal<EgressView | null>(null);

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) void this.load(id);
    });
  }

  protected portsOf(view: EgressView): string {
    return view.ports.length ? `ports ${formatEgressPorts(view.ports)}` : 'no ports';
  }

  private async load(id: string): Promise<void> {
    try {
      this.reading.set(await this.api.cluster(id));
    } catch {
      this.reading.set(null);
    }
  }
}
