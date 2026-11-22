import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClusterHaService, ClusterHaView } from '../../service/cluster-ha.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';

const LEVEL: Record<ClusterHaView['level'], string> = {
  standard: 'Standard',
  'three-locations': 'Survives a location',
};

const ROLE: Record<ClusterHaView['missing'][number]['role'], string> = {
  server: 'a server',
  'data-host': 'a node for copies of data',
};

@Component({
  selector: 'app-cluster-ha-card',
  imports: [RouterLink, FlPanel, FlStatus, FlAlert],
  host: { class: 'block' },
  template: `
    @if (view(); as v) {
      <fl-panel title="High availability" class="h-full" data-testid="cluster-ha-card">
        <fl-status
          panelActions
          [tone]="v.level === 'standard' ? 'neutral' : 'success'"
          [label]="levelLabel()"
        />
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <p class="m-0 text-fl-body">{{ headline() }}</p>
            @if (v.topology) {
              <p class="m-0 fl-mono text-fl-ink-muted" data-testid="cluster-ha-zones">
                {{ zonesLine() }}
              </p>
            }
          </div>
          @for (w of v.warnings; track w) {
            <fl-alert tone="warning" [title]="w" />
          }
          <div class="flex flex-wrap items-center gap-4 text-fl-body-sm">
            <button type="button" class="fl-link" (click)="open.set(!open())">
              {{ open() ? 'Hide details' : 'What it survives' }}
            </button>
            <a routerLink="../availability" class="fl-link" data-testid="cluster-ha-open-tab"
              >Locations and timings</a
            >
          </div>
          @if (open()) {
            <ul class="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="cluster-ha-details">
              @for (s of v.survives; track s) {
                <li><fl-status tone="success" [label]="'Survives ' + s" /></li>
              }
              @for (s of v.doesNotSurvive; track s) {
                <li><fl-status tone="neutral" [label]="'Does not survive ' + s" /></li>
              }
              @for (m of v.missing; track m.role + m.zone) {
                <li class="text-fl-body-sm text-fl-ink-muted">{{ m.why }}</li>
              }
            </ul>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class ClusterHaCardComponent {
  private readonly ha = inject(ClusterHaService);

  readonly clusterId = input.required<string | undefined>();
  readonly view = signal<ClusterHaView | null>(null);
  readonly open = signal(false);

  readonly levelLabel = computed(() => {
    const v = this.view();
    return v ? LEVEL[v.level] : '';
  });

  /** One line: what is still missing, or that nothing is. */
  readonly headline = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.unsupported) return v.unsupported;
    if (v.level === 'three-locations') return 'Survives the loss of a whole location.';
    const needs = v.missing.map((m) => ROLE[m.role] + ' in ' + m.zone);
    return `To survive a location it still needs ${needs.join(', ')}.`;
  });

  readonly zonesLine = computed(() =>
    (this.view()?.topology?.zones ?? [])
      .map((z) => `${z.zone}: ${z.role === 'data' ? 'data' : 'vote'}`)
      .join(' · '),
  );

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (!id) return;
      this.ha.get(id).subscribe({
        next: (v) => this.view.set(v),
        error: () => this.view.set(null),
      });
    });
  }
}
