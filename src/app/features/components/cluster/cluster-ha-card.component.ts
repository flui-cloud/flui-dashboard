import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideShieldAlert } from '@ng-icons/lucide';
import {
  ClusterHaService,
  ClusterHaView,
} from '../../service/cluster-ha.service';

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
  standalone: true,
  imports: [NgIconComponent, RouterLink],
  providers: [provideIcons({ lucideShieldCheck, lucideShieldAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div
        class="card-surface p-4 flex flex-col h-full"
        data-testid="cluster-ha-card"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5 text-label">
            <ng-icon
              [name]="
                v.level === 'standard'
                  ? 'lucideShieldAlert'
                  : 'lucideShieldCheck'
              "
              class="h-3.5 w-3.5"
            />
            High availability
          </div>
          <span
            class="text-xs font-medium"
            [class]="
              v.level === 'standard'
                ? 'text-muted-foreground'
                : 'text-emerald-600 dark:text-emerald-400'
            "
          >
            {{ levelLabel() }}
          </span>
        </div>
        <p class="m-0 text-sm">{{ headline() }}</p>
        @if (v.topology) {
          <p
            class="m-0 mt-1 text-xs text-muted-foreground"
            data-testid="cluster-ha-zones"
          >
            {{ zonesLine() }}
          </p>
        }
        @for (w of v.warnings; track w) {
          <p class="m-0 mt-1 text-xs text-amber-700 dark:text-amber-400">
            {{ w }}
          </p>
        }
        <div class="mt-3 flex items-center gap-4">
          <button
            type="button"
            class="text-xs text-primary hover:underline"
            (click)="open.set(!open())"
          >
            {{ open() ? 'Hide details' : 'What it survives' }}
          </button>
          <a
            routerLink="../availability"
            class="text-xs text-primary hover:underline"
            data-testid="cluster-ha-open-tab"
            >Locations and timings</a
          >
        </div>
        @if (open()) {
          <ul class="mt-2 space-y-1 text-xs" data-testid="cluster-ha-details">
            @for (s of v.survives; track s) {
              <li class="text-emerald-700 dark:text-emerald-400">
                Survives {{ s }}
              </li>
            }
            @for (s of v.doesNotSurvive; track s) {
              <li class="text-muted-foreground">Does not survive {{ s }}</li>
            }
            @for (m of v.missing; track m.role + m.zone) {
              <li class="text-muted-foreground">{{ m.why }}</li>
            }
          </ul>
        }
      </div>
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
    if (v.level === 'three-locations')
      return 'Survives the loss of a whole location.';
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
